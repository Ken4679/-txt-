import JSZip from 'jszip';
import {
  TEXT_EXTENSIONS,
  TEXT_FILENAMES,
  MAX_ZIP_BYTES,
  MAX_ZIP_MEMBERS,
  MAX_ZIP_UNCOMPRESSED_BYTES,
  MAX_ZIP_SINGLE_FILE_BYTES,
} from './constants';
import {
  calculateSha256,
  humanSize,
  normalizeAiPath,
  arrayBufferToBase64,
  isIgnoredMetadataPath,
} from './security';
import { ZipFileEntry } from '../types';

export function isBinaryData(filename: string, buffer: ArrayBuffer): boolean {
  const name = filename.split('/').pop() || filename;
  const ext = '.' + name.split('.').pop()?.toLowerCase();

  // Known text file names or extensions
  if (TEXT_FILENAMES.has(name) || TEXT_EXTENSIONS.has(ext)) {
    return false;
  }

  const sampleSize = Math.min(buffer.byteLength, 8192);
  const sample = new Uint8Array(buffer, 0, sampleSize);

  // Check for null bytes (typical indicator of binary files)
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      return true;
    }
  }

  // Try UTF-8 decoding
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(sample);
    return false;
  } catch {
    // Try GB18030 / GBK fallback (common in Chinese codebases)
    try {
      const gbkDecoder = new TextDecoder('gb18030', { fatal: true });
      gbkDecoder.decode(sample);
      return false;
    } catch {
      return true;
    }
  }
}

export function decodeText(buffer: ArrayBuffer): string {
  // Strip BOM if present
  const bytes = new Uint8Array(buffer);
  let startOffset = 0;

  // UTF-8 BOM EF BB BF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    startOffset = 3;
  }
  // UTF-16 LE BOM FF FE
  else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    try {
      const decoder = new TextDecoder('utf-16le');
      return decoder.decode(buffer.slice(2));
    } catch {
      // Fall through
    }
  }

  const slice = startOffset > 0 ? buffer.slice(startOffset) : buffer;
  const encodings = ['utf-8', 'gb18030', 'big5', 'shift-jis', 'windows-1252'];

  for (const enc of encodings) {
    try {
      const decoder = new TextDecoder(enc, { fatal: true });
      return decoder.decode(slice);
    } catch {
      continue;
    }
  }

  const fallback = new TextDecoder('utf-8', { fatal: false });
  return fallback.decode(slice);
}

interface TreeNode {
  name: string;
  isDir: boolean;
  children: Map<string, TreeNode>;
}

export function buildDirectoryTree(paths: string[], rootName: string): string[] {
  const rootNode: TreeNode = {
    name: rootName,
    isDir: true,
    children: new Map(),
  };

  for (const p of paths) {
    const parts = p.split('/');
    let current = rootNode;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isDir = i < parts.length - 1;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          isDir,
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }
  }

  const lines: string[] = [`${rootName}/`];

  function walk(node: TreeNode, prefix: string) {
    const sorted = Array.from(node.children.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? 1 : -1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    for (let index = 0; index < sorted.length; index++) {
      const child = sorted[index];
      const isLast = index === sorted.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(`${prefix}${connector}${child.name}${child.isDir ? '/' : ''}`);
      if (child.isDir) {
        walk(child, nextPrefix);
      }
    }
  }

  walk(rootNode, '');
  return lines;
}

export interface ProcessZipOptions {
  includeBinary: boolean;
  filterIgnoredFolders?: boolean;
  ignoredFolderNames?: string[];
  onProgress?: (current: number, total: number, currentFileName: string) => void;
}

export async function processZipFile(
  file: File,
  options: ProcessZipOptions
): Promise<{ txtContent: string; entries: ZipFileEntry[]; fileCount: number; ignoredCount: number }> {
  const { includeBinary, filterIgnoredFolders = true, ignoredFolderNames = [], onProgress } = options;

  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(
      `ZIP 文件过大：${humanSize(file.size)}，超出单文件限制 ${humanSize(MAX_ZIP_BYTES)}。`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const fileObjects: { zipEntry: JSZip.JSZipObject; normalizedPath: string }[] = [];
  let totalUncompressed = 0;
  let ignoredCount = 0;

  const zipKeys = Object.keys(zip.files);
  if (zipKeys.length > MAX_ZIP_MEMBERS) {
    throw new Error(`ZIP 条目数过多：${zipKeys.length} 个，上限 ${MAX_ZIP_MEMBERS}。可能为 ZIP Bomb 炸弹。`);
  }

  // 1. Filter out directories, OS metadata and anti-traversal check
  for (const rawName of zipKeys) {
    const item = zip.files[rawName];
    if (item.dir) continue;

    // Ignore OS artifacts like __MACOSX, .DS_Store
    if (isIgnoredMetadataPath(rawName)) {
      ignoredCount++;
      continue;
    }

    const normalized = normalizeAiPath(item.name);

    // Optional folder filtering (e.g. node_modules, .git, .venv)
    if (filterIgnoredFolders && ignoredFolderNames.length > 0) {
      const parts = normalized.split('/');
      if (parts.some(p => ignoredFolderNames.includes(p.toLowerCase()))) {
        ignoredCount++;
        continue;
      }
    }

    fileObjects.push({ zipEntry: item, normalizedPath: normalized });
  }

  if (fileObjects.length === 0) {
    throw new Error('ZIP 压缩包中没有有效的文件可供导出。');
  }

  // Detect common root folder (e.g. repo-main/...)
  let commonPrefix = '';
  const firstParts = fileObjects[0].normalizedPath.split('/');
  if (firstParts.length > 1) {
    const candidate = firstParts[0] + '/';
    if (fileObjects.every(f => f.normalizedPath.startsWith(candidate))) {
      commonPrefix = candidate;
    }
  }

  const rootDisplayName = commonPrefix
    ? commonPrefix.replace(/\/$/, '')
    : file.name.replace(/\.zip$/i, '');

  const totalFiles = fileObjects.length;
  const entries: ZipFileEntry[] = [];

  // Sort files predictably
  fileObjects.sort((a, b) => {
    const relA = commonPrefix ? a.normalizedPath.slice(commonPrefix.length) : a.normalizedPath;
    const relB = commonPrefix ? b.normalizedPath.slice(commonPrefix.length) : b.normalizedPath;
    return relA.toLowerCase().localeCompare(relB.toLowerCase());
  });

  for (let i = 0; i < fileObjects.length; i++) {
    const { zipEntry, normalizedPath } = fileObjects[i];
    const relPath = commonPrefix ? normalizedPath.slice(commonPrefix.length) : normalizedPath;

    if (onProgress) {
      onProgress(i + 1, totalFiles, relPath);
    }

    const contentBuffer = await zipEntry.async('arraybuffer');
    const fileSize = contentBuffer.byteLength;

    if (fileSize > MAX_ZIP_SINGLE_FILE_BYTES) {
      throw new Error(`单文件解压后过大：${relPath} (${humanSize(fileSize)})`);
    }

    totalUncompressed += fileSize;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error(
        `解压后总数据大小超过 ${humanSize(MAX_ZIP_UNCOMPRESSED_BYTES)} 保护上限。`
      );
    }

    const sha256 = await calculateSha256(contentBuffer);
    const isBinary = isBinaryData(relPath, contentBuffer);

    let textContent: string | undefined;
    let base64Content: string | undefined;

    if (isBinary) {
      if (includeBinary) {
        base64Content = arrayBufferToBase64(contentBuffer);
      }
    } else {
      textContent = decodeText(contentBuffer);
    }

    entries.push({
      path: normalizedPath,
      relativePath: relPath,
      size: fileSize,
      isBinary,
      sha256,
      content: textContent,
      base64: base64Content,
    });
  }

  // Build directory tree
  const treeLines = buildDirectoryTree(
    entries.map(e => e.relativePath),
    rootDisplayName
  );

  // Assemble TXT export content
  const header = [
    '='.repeat(100),
    'REPOSITORY EXPORT',
    '='.repeat(100),
    '',
    `SOURCE ZIP: ${file.name}`,
    `FILE COUNT: ${entries.length}`,
    `BINARY MODE: ${includeBinary ? 'BASE64 INCLUDED' : 'METADATA ONLY'}`,
    '',
    '='.repeat(100),
    'DIRECTORY STRUCTURE',
    '='.repeat(100),
    '',
    treeLines.join('\n'),
    '',
    '',
    '='.repeat(100),
    'FILE CONTENTS',
    '='.repeat(100),
  ].join('\n');

  const fileSections: string[] = [];

  for (const entry of entries) {
    const secHeader = [
      '',
      '='.repeat(100),
      `FILE: ${entry.relativePath}`,
      `SIZE: ${humanSize(entry.size)} (${entry.size} bytes)`,
      `SHA-256: ${entry.sha256}`,
    ];

    if (entry.isBinary) {
      secHeader.push('TYPE: BINARY');
      if (includeBinary && entry.base64) {
        secHeader.push('ENCODING: BASE64');
        secHeader.push('='.repeat(100));
        // Chunk Base64 by 76 chars
        const chunks: string[] = [];
        for (let idx = 0; idx < entry.base64.length; idx += 76) {
          chunks.push(entry.base64.slice(idx, idx + 76));
        }
        secHeader.push(chunks.join('\n'));
      } else {
        secHeader.push('CONTENT: NOT EMBEDDED (metadata only)');
      }
    } else {
      secHeader.push('TYPE: TEXT');
      secHeader.push('='.repeat(100));
      secHeader.push(entry.content ?? '');
    }

    fileSections.push(secHeader.join('\n'));
  }

  const txtContent = `${header}\n${fileSections.join('\n')}\n`;

  return {
    txtContent,
    entries,
    fileCount: entries.length,
    ignoredCount,
  };
}
