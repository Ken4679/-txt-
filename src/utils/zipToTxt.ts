import JSZip from 'jszip';
import {
  TEXT_EXTENSIONS,
  TEXT_FILENAMES,
  MAX_ZIP_BYTES,
  MAX_ZIP_MEMBERS,
  MAX_ZIP_UNCOMPRESSED_BYTES,
  MAX_ZIP_SINGLE_FILE_BYTES,
  COMMON_IGNORE_FOLDERS,
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

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.floor(text.length / 3.8) + 1;
}

export function getFileLanguage(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    pyw: 'python',
    json: 'json',
    jsonc: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    sql: 'sql',
    xml: 'xml',
    vue: 'vue',
    svelte: 'svelte',
    toml: 'toml',
    ini: 'ini',
  };

  return map[ext] || ext || 'text';
}

export interface ProcessZipResult {
  txtContent: string;
  asciiTree: string;
  entries: ZipFileEntry[];
  fileCount: number;
  textCount: number;
  binaryCount: number;
  totalLines: number;
  estimatedTokens: number;
  ignoredCount: number;
}

export interface ProcessZipOptions {
  includeBinary: boolean;
  filterIgnoredFolders?: boolean;
  ignoredFolderNames?: string[];
  customIgnorePatterns?: string[];
  onProgress?: (current: number, total: number, currentFileName: string) => void;
}

export interface DirectFileInput {
  relativePath: string;
  file: File;
}

/**
 * Process a list of direct files (e.g. from folder drop or webkitdirectory input)
 */
export async function processFolderFiles(
  folderFiles: DirectFileInput[],
  options: ProcessZipOptions,
  rootDisplayName = 'project'
): Promise<ProcessZipResult> {
  const {
    includeBinary,
    filterIgnoredFolders = true,
    ignoredFolderNames = COMMON_IGNORE_FOLDERS,
    customIgnorePatterns = [],
    onProgress,
  } = options;

  let ignoredCount = 0;
  const validFiles: { normalizedPath: string; file: File }[] = [];

  for (const item of folderFiles) {
    if (isIgnoredMetadataPath(item.relativePath)) {
      ignoredCount++;
      continue;
    }

    const normalized = normalizeAiPath(item.relativePath);

    if (filterIgnoredFolders && ignoredFolderNames.length > 0) {
      const parts = normalized.split('/');
      if (parts.some(p => ignoredFolderNames.includes(p.toLowerCase()))) {
        ignoredCount++;
        continue;
      }
    }

    if (customIgnorePatterns.length > 0) {
      const isCustomIgnored = customIgnorePatterns.some(pat => {
        const p = pat.trim().toLowerCase();
        return p && (normalized.toLowerCase().includes(p) || normalized.toLowerCase().endsWith(p));
      });
      if (isCustomIgnored) {
        ignoredCount++;
        continue;
      }
    }

    validFiles.push({ normalizedPath: normalized, file: item.file });
  }

  if (validFiles.length === 0) {
    throw new Error('所选文件夹中未找到有效的代码或文本文件。');
  }

  // Detect common root folder
  let commonPrefix = '';
  const firstParts = validFiles[0].normalizedPath.split('/');
  if (firstParts.length > 1) {
    const candidate = firstParts[0] + '/';
    if (validFiles.every(f => f.normalizedPath.startsWith(candidate))) {
      commonPrefix = candidate;
    }
  }

  const effectiveRootName = rootDisplayName || (commonPrefix ? commonPrefix.replace(/\/$/, '') : 'project');

  validFiles.sort((a, b) => {
    const relA = commonPrefix ? a.normalizedPath.slice(commonPrefix.length) : a.normalizedPath;
    const relB = commonPrefix ? b.normalizedPath.slice(commonPrefix.length) : b.normalizedPath;
    return relA.toLowerCase().localeCompare(relB.toLowerCase());
  });

  const totalFiles = validFiles.length;
  const entries: ZipFileEntry[] = [];
  let totalLines = 0;
  let textCount = 0;
  let binaryCount = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const { normalizedPath, file } = validFiles[i];
    const relPath = commonPrefix ? normalizedPath.slice(commonPrefix.length) : normalizedPath;

    if (onProgress) {
      onProgress(i + 1, totalFiles, relPath);
    }

    const contentBuffer = await file.arrayBuffer();
    const fileSize = contentBuffer.byteLength;

    if (fileSize > MAX_ZIP_SINGLE_FILE_BYTES) {
      throw new Error(`单文件过大：${relPath} (${humanSize(fileSize)})`);
    }

    const sha256 = await calculateSha256(contentBuffer);
    const isBinary = isBinaryData(relPath, contentBuffer);

    let textContent: string | undefined;
    let base64Content: string | undefined;

    if (isBinary) {
      binaryCount++;
      if (includeBinary) {
        base64Content = arrayBufferToBase64(contentBuffer);
      }
    } else {
      textCount++;
      textContent = decodeText(contentBuffer);
      const linesInFile = textContent.split(/\r\n|\r|\n/).length;
      totalLines += linesInFile;
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

  const treeLines = buildDirectoryTree(
    entries.map(e => e.relativePath),
    effectiveRootName
  );
  const asciiTree = treeLines.join('\n');

  const txtParts: string[] = [];
  txtParts.push('================================================================================');
  txtParts.push('ZIPIFY REPOSITORY CONTEXT EXPORT');
  txtParts.push('================================================================================\n');
  txtParts.push('DIRECTORY STRUCTURE:');
  txtParts.push(asciiTree);
  txtParts.push('\n================================================================================');
  txtParts.push('REPOSITORY SOURCE CODE FILES');
  txtParts.push('================================================================================\n');

  for (const entry of entries) {
    if (entry.isBinary) {
      if (includeBinary && entry.base64) {
        txtParts.push(`### FILE: ${entry.relativePath} [BASE64_BINARY]`);
        txtParts.push('```base64');
        txtParts.push(entry.base64);
        txtParts.push('```\n');
      } else {
        txtParts.push(`### FILE: ${entry.relativePath} [BINARY FILE: ${humanSize(entry.size)}, SHA-256: ${entry.sha256}]\n`);
      }
    } else {
      const lang = getFileLanguage(entry.relativePath);
      txtParts.push(`### FILE: ${entry.relativePath}`);
      txtParts.push(`\`\`\`${lang}`);
      txtParts.push(entry.content ?? '');
      txtParts.push('```\n');
    }
  }

  const txtContent = txtParts.join('\n');
  const estimatedTokens = estimateTokens(txtContent);

  return {
    txtContent,
    asciiTree,
    entries,
    fileCount: entries.length,
    textCount,
    binaryCount,
    totalLines,
    estimatedTokens,
    ignoredCount,
  };
}

export async function processZipFile(
  file: File,
  options: ProcessZipOptions
): Promise<ProcessZipResult> {
  const {
    includeBinary,
    filterIgnoredFolders = true,
    ignoredFolderNames = COMMON_IGNORE_FOLDERS,
    customIgnorePatterns = [],
    onProgress,
  } = options;

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

    if (customIgnorePatterns.length > 0) {
      const isCustomIgnored = customIgnorePatterns.some(pat => {
        const p = pat.trim().toLowerCase();
        return p && (normalized.toLowerCase().includes(p) || normalized.toLowerCase().endsWith(p));
      });
      if (isCustomIgnored) {
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
  let totalLines = 0;
  let textCount = 0;
  let binaryCount = 0;

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
      binaryCount++;
      if (includeBinary) {
        base64Content = arrayBufferToBase64(contentBuffer);
      }
    } else {
      textCount++;
      textContent = decodeText(contentBuffer);
      const linesInFile = textContent.split(/\r\n|\r|\n/).length;
      totalLines += linesInFile;
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
  const asciiTree = treeLines.join('\n');

  // Assemble TXT export content matching core.py standard format
  const txtParts: string[] = [];
  txtParts.push('================================================================================');
  txtParts.push('ZIPIFY REPOSITORY CONTEXT EXPORT');
  txtParts.push('================================================================================\n');
  txtParts.push('DIRECTORY STRUCTURE:');
  txtParts.push(asciiTree);
  txtParts.push('\n================================================================================');
  txtParts.push('REPOSITORY SOURCE CODE FILES');
  txtParts.push('================================================================================\n');

  for (const entry of entries) {
    if (entry.isBinary) {
      if (includeBinary && entry.base64) {
        txtParts.push(`### FILE: ${entry.relativePath} [BASE64_BINARY]`);
        txtParts.push('```base64');
        txtParts.push(entry.base64);
        txtParts.push('```\n');
      } else {
        txtParts.push(`### FILE: ${entry.relativePath} [BINARY FILE: ${humanSize(entry.size)}, SHA-256: ${entry.sha256}]\n`);
      }
    } else {
      const lang = getFileLanguage(entry.relativePath);
      txtParts.push(`### FILE: ${entry.relativePath}`);
      txtParts.push(`\`\`\`${lang}`);
      txtParts.push(entry.content ?? '');
      txtParts.push('```\n');
    }
  }

  const txtContent = txtParts.join('\n');
  const estimatedTokens = estimateTokens(txtContent);

  return {
    txtContent,
    asciiTree,
    entries,
    fileCount: entries.length,
    textCount,
    binaryCount,
    totalLines,
    estimatedTokens,
    ignoredCount,
  };
}

export function assemblePromptWithContext(
  promptTemplate: string,
  userRequirement: string,
  repoContextTxt: string
): string {
  let prompt = promptTemplate;
  if (userRequirement && userRequirement.trim()) {
    prompt = prompt.replace(/\[DESCRIBE YOUR REQUIREMENT HERE\]/i, userRequirement.trim());
    prompt = prompt.replace(/\[在此详细描述您的业务需求.*?\]/i, userRequirement.trim());
  }

  return `${prompt}\n\n${repoContextTxt}`;
}