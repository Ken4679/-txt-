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
 * 编译缓存的正则模式（性能优化）
 * 避免在每次解析时重新编译正则表达式
 */
const COMPILED_PATTERNS = {
  // 标准 Markdown 标题: ### FILE: path 或 ## FILE: path 或 # FILE: path
  header1: /^\s*(?:#{1,6}\s*)?FILE\s*:\s*[`"']?(.+?)[`"']?\s*$/i,
  // Markdown 粗体标题: **FILE:** path 或 **File:** `path`
  header2: /^\s*\*\*(?:FILE|File|FilePath|Path)\s*:\s*\*\*\s*[`"']?(.+?)[`"']?\s*$/i,
  // Markdown 粗体包装: **FILE: path** 或 **File: path**
  header3: /^\s*\*\*(?:FILE|File|FilePath|Path)\s*:\s*[`"']?(.+?)[`"']?\*\*\s*$/i,
  // 代码注释标签: // FILE: path, /* FILE: path */, <!-- FILE: path -->, # FILE: path
  header4: /^\s*(?:\/\/|\/\*|<!--|#)\s*(?:FILE|File|FilePath)\s*:\s*[`"']?(.+?)[`"']?(?:\s*\*\/|\s*-->)?\s*$/i,
  // 括号标签: [FILE: path], [FILE] path, [File: path]
  header5: /^\s*\[\s*(?:FILE|File|FilePath)(?:\s*:)?\s*[`"']?(.+?)[`"']?\s*\]\s*$/i,
  // FilePath: path 或 File: path 或 Target File: path
  header6: /^\s*(?:FilePath|File Path|Target File|File)\s*:\s*[`"']?(.+?)[`"']?\s*$/i,
  // 内联围栏: ```python:src/main.py 或 ```ts file="src/app.ts"
  inlineFence: /^\s*```(?:[A-Za-z0-9_+.#-]+)?(?:\s+|:)(?:file=|path=)?["'`]?([A-Za-z0-9_./\\-]+)["'`]?\s*$/i,
  standardFenceStart: /^\s*```(?:[A-Za-z0-9_+.#-]+)?\s*$/,
  fenceEnd: /^\s*```\s*$/,
};

const FILE_HEADER_PATTERNS = [
  COMPILED_PATTERNS.header1,
  COMPILED_PATTERNS.header2,
  COMPILED_PATTERNS.header3,
  COMPILED_PATTERNS.header4,
  COMPILED_PATTERNS.header5,
  COMPILED_PATTERNS.header6,
];

export interface ParseResult {
  files: ParsedAiFile[];
  warnings: string[];
  autoClosedCount: number;
}

/**
 * 规范化内容以进行准确的差异比较
 * 处理：CRLF/LF 统一、行尾空白、多空行规范化
 * 
 * 场景示例：
 * - 原文件使用 4 个空格缩进，AI 生成 2 个空格 → 规范化后逻辑相同
 * - 原文件 CRLF，AI 生成 LF → 规范化后一致
 * - 行尾有不同数量的空白 → 全部移除
 * 
 * @param content 需要规范化的内容
 * @returns 规范化后的内容（用于准确比较）
 */
export function normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')           // 统一 CRLF 为 LF
    .replace(/\r/g, '\n')             // 统一 CR 为 LF
    .replace(/[ \t]+$/gm, '')         // 移除行尾空白
    .replace(/\n\n+/g, '\n\n')        // 规范化多个空行为单个
    .trim();                           // 移除首尾空白
}

/**
 * 高容错的 AI 生成代码输出解析器
 * 
 * 功能特性：
 * - 支持 7 种 AI Markdown 标记格式
 * - 自动修复截断代码块（Token 限制导致未闭合）
 * - 智能合并同一文件的分片输出
 * - 多层路径安全验证
 * - 详细的错误诊断提示
 * 
 * @param rawText AI 生成的完整 Markdown 文本
 * @returns 解析结果（文件、警告、自动闭合计数）
 * @throws Error 当输入无效或超过限制时
 */
export function parseAiBlocks(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    throw new Error('输入内容为空，请粘贴 AI 生成的代码块。');
  }

  const encoder = new TextEncoder();
  const rawBytesLen = encoder.encode(rawText).length;

  if (rawBytesLen > MAX_AI_INPUT_BYTES) {
    throw new Error(
      `AI 输出内容过大 (${humanSize(rawBytesLen)})，超过处理上限 ${humanSize(MAX_AI_INPUT_BYTES)}。\n\n` +
      `建议：使用多次请求分批粘贴，或要求 AI 只保留关键部分。`
    );
  }

  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const warnings: string[] = [];
  const rawBlocks: { path: string; content: string; language?: string; autoClosed?: boolean }[] = [];

  let currentPath: string | null = null;
  let detectedLang: string | undefined = undefined;
  let buffer: string[] = [];
  let inCodeBlock = false;
  let autoClosedCount = 0;
  let lineIndex = 0;

  function flushBlock(isAutoClosed = false) {
    if (currentPath !== null) {
      const content = buffer.join('\n');
      const contentLen = encoder.encode(content).length;

      if (contentLen > MAX_AI_SINGLE_OUTPUT_BYTES) {
        throw new Error(
          `文件内容过大: ${currentPath}\n` +
          `大小: ${humanSize(contentLen)}, 上限: ${humanSize(MAX_AI_SINGLE_OUTPUT_BYTES)}\n\n` +
          `建议：分割此文件为多个较小文件或请求 AI 只保留必要代码`
        );
      }

      rawBlocks.push({
        path: currentPath,
        content,
        language: detectedLang,
        autoClosed: isAutoClosed,
      });

      if (isAutoClosed) {
        autoClosedCount++;
        warnings.push(
          `⚠️ 文件 [${currentPath}] 第 ${lineIndex} 行：代码围栏未闭合，已自动闭合。\n` +
          `   原因：AI 输出达到了 Token 上下文限制。\n` +
          `   建议：使用 AI 的"继续生成"功能获取剩余代码。`
        );
      }
    }
    currentPath = null;
    buffer = [];
    inCodeBlock = false;
    detectedLang = undefined;
  }

  for (; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (!inCodeBlock) {
      // 1. 检查内联围栏：```python:src/main.py
      const inlineMatch = line.match(COMPILED_PATTERNS.inlineFence);
      if (inlineMatch && inlineMatch[1].includes('.')) {
        try {
          const parsedPath = normalizeAiPath(inlineMatch[1]);
          currentPath = parsedPath;
          const langPart = line.trim().replace(/^```/, '').split(/[:\s]/)[0];
          detectedLang = langPart || undefined;
          inCodeBlock = true;
          continue;
        } catch {
          // 路径规范化失败，继续尝试其他匹配
        }
      }

      // 2. 检查文件标记
      let matchedPath: string | null = null;
      for (const pattern of FILE_HEADER_PATTERNS) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim();
          // 验证候选路径看起来合法（必须包含文件扩展名或目录分隔符）
          if (candidate.length > 0 && !candidate.startsWith('http') && !candidate.includes('://')) {
            try {
              matchedPath = normalizeAiPath(candidate);
              break;
            } catch {
              // 忽略触发假阳性的会话短语
            }
          }
        }
      }

      if (matchedPath) {
        currentPath = matchedPath;
        continue;
      }

      // 3. 如果有待处理的文件路径，检查此行是否打开代码块
      if (currentPath !== null) {
        const fenceMatch = line.match(COMPILED_PATTERNS.standardFenceStart);
        if (fenceMatch) {
          const langMatch = line.trim().replace(/^```/, '').trim();
          if (langMatch) {
            detectedLang = langMatch;
          }
          inCodeBlock = true;
          continue;
        }
        // 如果行为空或是简短的聊天文本（如 "Here is the code:"），忽略并继续等待围栏
        continue;
      }

      continue;
    }

    // 当前在代码块内
    if (COMPILED_PATTERNS.fenceEnd.test(line)) {
      flushBlock(false);
    } else {
      buffer.push(line);
    }
  }

  // 处理 AI 响应在仍在代码围栏内时结束的情况（Token 限制截断）
  if (inCodeBlock && currentPath !== null) {
    flushBlock(true);
  }

  if (rawBlocks.length === 0) {
    throw new Error(
      '❌ 未能从输入中识别出任何有效的文件代码块。\n\n' +
      '✅ 请确认 AI 输出包含以下格式之一：\n' +
      '  • ### FILE: src/example.py\n' +
      '  • **FILE:** src/example.py\n' +
      '  • ```python:src/example.py\n' +
      '  • [FILE: src/example.py]\n\n' +
      '📝 完整的代码示例：\n' +
      '### FILE: src/main.py\n' +
      '```python\n' +
      'def hello():\n' +
      '    print("Hello, World!")\n' +
      '```'
    );
  }

  // 合并分片块（如果同一文件跨多个块返回）
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
    throw new Error(
      `❌ 识别到的文件数过多 (${mergedMap.size})，超过最大允许限制 ${MAX_AI_FILES}。\n\n` +
      `建议：分批上传不同部分的代码，或在 Prompt 中要求 AI 只修改关键文件。`
    );
  }

  const files: ParsedAiFile[] = [];

  for (const [path, data] of mergedMap.entries()) {
    const size = encoder.encode(data.content).length;
    totalBytes += size;

    if (totalBytes > MAX_AI_TOTAL_OUTPUT_BYTES) {
      throw new Error(
        `❌ AI 输出总代码体积超过上限\n` +
        `已处理: ${humanSize(totalBytes)}, 上限: ${humanSize(MAX_AI_TOTAL_OUTPUT_BYTES)}\n\n` +
        `建议：分多次请求获取不同部分的代码修改。`
      );
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
 * 将解析的文件打包为标准 ZIP 补丁存档
 * 支持敏感文件过滤和压缩级别控制
 * 
 * @param files 解析的文件列表
 * @param options 打包选项（允许敏感文件、压缩级别）
 * @param selectedPaths 要包含的文件路径集合
 * @returns Promise<Blob> ZIP 压缩包
 * @throws Error 当敏感文件被拦截或无有效文件时
 */
export async function generatePatchZip(
  files: ParsedAiFile[],
  options?: { allowSensitive?: boolean; compressionLevel?: number } | boolean,
  selectedPaths?: Set<string>
): Promise<Blob> {
  const allowSensitive = typeof options === 'boolean' ? options : !!options?.allowSensitive;
  const compressionLevel = typeof options === 'object' && options?.compressionLevel ? options.compressionLevel : 9;

  const zip = new JSZip();
  let fileCount = 0;
  const blockedFiles: string[] = [];

  for (const file of files) {
    if (selectedPaths && !selectedPaths.has(file.relativePath)) {
      continue;
    }
    if (file.isSensitive && !allowSensitive) {
      blockedFiles.push(file.relativePath);
      continue;
    }
    zip.file(file.relativePath, file.content);
    fileCount++;
  }

  if (blockedFiles.length > 0 && !allowSensitive) {
    throw new Error(
      `❌ ${blockedFiles.length} 个敏感文件被安全策略拦截：\n` +
      blockedFiles.map(f => `  • ${f}`).join('\n') +
      `\n\n如需打包请勾选"允许敏感凭据文件"权限。`
    );
  }

  if (fileCount === 0) {
    throw new Error('❌ 没有选择任何文件进行打包。');
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });
}

export const parseAiOutput = parseAiBlocks;
export const createPatchZip = generatePatchZip;
