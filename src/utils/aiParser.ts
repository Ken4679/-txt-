import JSZip from 'jszip';
import {
  MAX_AI_INPUT_BYTES,
  MAX_AI_FILES,
  MAX_AI_TOTAL_OUTPUT_BYTES,
  MAX_AI_SINGLE_OUTPUT_BYTES,
} from './constants';
import { humanSize, normalizeAiPath, isSensitivePath } from './security';
import { ParsedAiFile } from '../types';

/**
 * Regex patterns matching various AI file declaration formats
 */
const FILE_HEADER_PATTERNS = [
  // Standard Markdown headers: ### FILE: path or ## FILE: path or # FILE: path
  /^\s*(?:#{1,6}\s*)?FILE\s*:\s*[`"']?(.+?)[`"']?\s*$/i,
  // Markdown bold headers: **FILE:** path or **File:** `path`
  /^\s*\*\*(?:FILE|File|FilePath|Path)\s*:\s*\*\*\s*[`"']?(.+?)[`"']?\s*$/i,
  // Markdown bold wrapper: **FILE: path** or **File: path**
  /^\s*\*\*(?:FILE|File|FilePath|Path)\s*:\s*[`"']?(.+?)[`"']?\*\*\s*$/i,
  // Code comment tags: // FILE: path, /* FILE: path */, <!-- FILE: path -->, # FILE: path
  /^\s*(?:\/\/|\/\*|<!--|#)\s*(?:FILE|File|FilePath)\s*:\s*[`"']?(.+?)[`"']?(?:\s*\*\/|\s*-->)?\s*$/i,
  // Bracketed tags: [FILE: path], [FILE] path, [File: path]
  /^\s*\[\s*(?:FILE|File|FilePath)(?:\s*:)?\s*[`"']?(.+?)[`"']?\s*\]\s*$/i,
  // FilePath: path or File: path or Target File: path
  /^\s*(?:FilePath|File Path|Target File|File)\s*:\s*[`"']?(.+?)[`"']?\s*$/i,
];

// Inline fence pattern: ```python:src/main.py or ```ts file="src/app.ts" or ```tsx path=src/app.tsx
const INLINE_FENCE_PATTERN = /^\s*```(?:[A-Za-z0-9_+.#-]+)?(?:\s+|:)(?:file=|path=)?["'`]?([A-Za-z0-9_./\\-]+)["'`]?\s*$/i;
const STANDARD_FENCE_START = /^\s*```(?:[A-Za-z0-9_+.#-]+)?\s*$/;
const FENCE_END = /^\s*```\s*$/;

export interface ParseResult {
  files: ParsedAiFile[];
  warnings: string[];
  autoClosedCount: number;
}

/**
 * Highly tolerant parser for AI-generated code outputs.
 */
export function parseAiBlocks(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    throw new Error('输入内容为空，请粘贴 AI 生成的代码块。');
  }

  const encoder = new TextEncoder();
  const rawBytesLen = encoder.encode(rawText).length;

  if (rawBytesLen > MAX_AI_INPUT_BYTES) {
    throw new Error(`AI 输出内容过大 (${humanSize(rawBytesLen)})，超过处理上限 ${humanSize(MAX_AI_INPUT_BYTES)}。请分批粘贴。`);
  }

  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const warnings: string[] = [];
  const rawBlocks: { path: string; content: string; language?: string; autoClosed?: boolean }[] = [];

  let currentPath: string | null = null;
  let detectedLang: string | undefined = undefined;
  let buffer: string[] = [];
  let inCodeBlock = false;
  let autoClosedCount = 0;

  function flushBlock(isAutoClosed = false) {
    if (currentPath !== null) {
      const content = buffer.join('\n');
      const contentLen = encoder.encode(content).length;
      if (contentLen > MAX_AI_SINGLE_OUTPUT_BYTES) {
        throw new Error(`文件内容过大: ${currentPath} (${humanSize(contentLen)})`);
      }
      rawBlocks.push({
        path: currentPath,
        content,
        language: detectedLang,
        autoClosed: isAutoClosed,
      });
      if (isAutoClosed) {
        autoClosedCount++;
        warnings.push(`文件 [${currentPath}] 因代码围栏未闭合已自动闭合（可能由于 AI 输出达到了 Token 截断限制）。`);
      }
    }
    currentPath = null;
    buffer = [];
    inCodeBlock = false;
    detectedLang = undefined;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inCodeBlock) {
      // 1. Check for inline fence: ```python:src/main.py
      const inlineMatch = line.match(INLINE_FENCE_PATTERN);
      if (inlineMatch && inlineMatch[1].includes('.')) {
        try {
          const parsedPath = normalizeAiPath(inlineMatch[1]);
          currentPath = parsedPath;
          const langPart = line.trim().replace(/^```/, '').split(/[:\s]/)[0];
          detectedLang = langPart || undefined;
          inCodeBlock = true;
          continue;
        } catch {
          // If normalization fails, proceed to regular matching
        }
      }

      // 2. Check for File header markers
      let matchedPath: string | null = null;
      for (const pattern of FILE_HEADER_PATTERNS) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim();
          // Verify candidate looks like a valid relative path (must contain file extension or directory divider)
          if (candidate.length > 0 && !candidate.startsWith('http') && !candidate.includes('://')) {
            try {
              matchedPath = normalizeAiPath(candidate);
              break;
            } catch {
              // Ignore conversational phrases that triggered false-positive header matches
            }
          }
        }
      }

      if (matchedPath) {
        currentPath = matchedPath;
        continue;
      }

      // 3. If we have a pending currentPath, check if this line opens a code block
      if (currentPath !== null) {
        const fenceMatch = line.match(STANDARD_FENCE_START);
        if (fenceMatch) {
          const langMatch = line.trim().replace(/^```/, '').trim();
          if (langMatch) {
            detectedLang = langMatch;
          }
          inCodeBlock = true;
          continue;
        }
        // If line is empty or brief chat like "Here is the code:", ignore and keep waiting for fence
        continue;
      }

      continue;
    }

    // Currently IN code block
    if (FENCE_END.test(line)) {
      flushBlock(false);
    } else {
      buffer.push(line);
    }
  }

  // Handle case where AI response ended while still inside a code fence (token limit cut off)
  if (inCodeBlock && currentPath !== null) {
    flushBlock(true);
  }

  if (rawBlocks.length === 0) {
    throw new Error(
      '未能从输入中识别出任何有效的文件代码块。\n\n请确认 AI 输出包含类似标准格式：\n### FILE: src/example.py\n```python\n完整源码\n```'
    );
  }

  // Merge partitioned blocks if same file was returned across multiple chunks
  const mergedMap = new Map<string, { content: string; language?: string; isAutoClosed: boolean }>();
  let totalBytes = 0;

  for (const block of rawBlocks) {
    const existing = mergedMap.get(block.path);
    if (existing) {
      existing.content = existing.content + '\n' + block.content;
      if (!existing.language && block.language) {
        existing.language = block.language;
      }
      if (block.autoClosed) {
        existing.isAutoClosed = true;
      }
    } else {
      mergedMap.set(block.path, {
        content: block.content,
        language: block.language,
        isAutoClosed: !!block.autoClosed,
      });
    }
  }

  if (mergedMap.size > MAX_AI_FILES) {
    throw new Error(`识别到的文件数过多 (${mergedMap.size})，超过最大允许限制 ${MAX_AI_FILES}。`);
  }

  const files: ParsedAiFile[] = [];

  for (const [path, data] of mergedMap.entries()) {
    const size = encoder.encode(data.content).length;
    totalBytes += size;
    if (totalBytes > MAX_AI_TOTAL_OUTPUT_BYTES) {
      throw new Error(`AI 输出总代码体积超过上限 ${humanSize(MAX_AI_TOTAL_OUTPUT_BYTES)}。`);
    }

    files.push({
      relativePath: path,
      content: data.content,
      size,
      isSensitive: isSensitivePath(path),
      language: data.language,
      isAutoClosed: data.isAutoClosed,
    });
  }

  return {
    files,
    warnings,
    autoClosedCount,
  };
}

/**
 * Packs parsed files into a standard ZIP patch archive
 */
export async function generatePatchZip(
  files: ParsedAiFile[],
  options?: { allowSensitive?: boolean; compressionLevel?: number } | boolean,
  selectedPaths?: Set<string>
): Promise<Blob> {
  const allowSensitive = typeof options === 'boolean' ? options : !!options?.allowSensitive;
  const compressionLevel = typeof options === 'object' && options?.compressionLevel ? options.compressionLevel : 9;

  const zip = new JSZip();

  for (const file of files) {
    if (selectedPaths && !selectedPaths.has(file.relativePath)) {
      continue;
    }
    if (file.isSensitive && !allowSensitive) {
      throw new Error(`受保护敏感文件已被安全策略拦截：${file.relativePath}。如需打包请勾选允许敏感文件。`);
    }
    zip.file(file.relativePath, file.content);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });
}

export const parseAiOutput = parseAiBlocks;
export const createPatchZip = generatePatchZip;
