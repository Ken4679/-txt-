/**
 * Industrial-grade Multi-Model Token Estimator
 * Approximates Byte-Pair Encoding (BPE) tokenization for GPT-4o (o200k), Claude 3.5, Gemini 1.5, and DeepSeek/Qwen.
 */

export interface TokenEstimation {
  estimatedTokens: number;
  gpt4oTokens: number;
  claudeTokens: number;
  geminiTokens: number;
  deepseekTokens: number;
  characters: number;
  lines: number;
  words: number;
  chineseChars: number;
  punctuationChars: number;
  contextUsage: {
    gpt128k: number; // Percentage
    claude200k: number;
    gemini1m: number;
    deepseek128k: number;
  };
}

/**
 * Accurately estimates tokens across major LLM architectures by simulating BPE subword splitting,
 * punctuation isolation, indentation packing, and CJK tokenization rules.
 */
export function estimateTokensDetailed(text: string): TokenEstimation {
  if (!text) {
    return {
      estimatedTokens: 0,
      gpt4oTokens: 0,
      claudeTokens: 0,
      geminiTokens: 0,
      deepseekTokens: 0,
      characters: 0,
      lines: 0,
      words: 0,
      chineseChars: 0,
      punctuationChars: 0,
      contextUsage: {
        gpt128k: 0,
        claude200k: 0,
        gemini1m: 0,
        deepseek128k: 0,
      },
    };
  }

  const characters = text.length;
  const lines = text.split(/\r\n|\r|\n/).length;

  let chineseCount = 0;
  let punctuationCount = 0;
  let whitespaceCount = 0;
  let wordCount = 0;

  // Track subword units
  let baseTokenCount = 0;

  // Regex rules for BPE approximation in source code & bilingual text
  const cjkRegex = /[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf\uf900-\ufaff]/;
  const puncRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
  const wordCharRegex = /[a-zA-Z0-9]/;

  // Process text line by line to accurately simulate whitespace/indentation tokenization
  const lineArray = text.split(/\r\n|\r|\n/);

  for (const line of lineArray) {
    if (!line) {
      baseTokenCount += 1; // Empty line / newline
      continue;
    }

    // 1. Indentation handling (common in code: 4 spaces = 1 token, 1 tab = 1 token)
    const indentMatch = line.match(/^[ \t]+/);
    if (indentMatch) {
      const indentStr = indentMatch[0];
      const spaces = (indentStr.match(/ /g) || []).length;
      const tabs = (indentStr.match(/\t/g) || []).length;
      baseTokenCount += Math.ceil(spaces / 4) + tabs;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      baseTokenCount += 1;
      continue;
    }

    // 2. Tokenize line content into tokens
    let i = 0;
    while (i < trimmed.length) {
      const char = trimmed[i];

      // CJK characters: modern tokenizers (o200k, DeepSeek) take ~1 to 1.3 tokens per Chinese char
      if (cjkRegex.test(char)) {
        chineseCount++;
        baseTokenCount += 1.15;
        i++;
        continue;
      }

      // Punctuation / Operators: each symbol is typically 1 individual token
      if (puncRegex.test(char)) {
        punctuationCount++;
        baseTokenCount += 1.0;
        i++;
        continue;
      }

      // Whitespace inside line
      if (char === ' ' || char === '\t') {
        whitespaceCount++;
        // Groups of spaces
        let sCount = 0;
        while (i < trimmed.length && (trimmed[i] === ' ' || trimmed[i] === '\t')) {
          sCount++;
          i++;
        }
        baseTokenCount += Math.ceil(sCount / 3);
        continue;
      }

      // Words / Identifiers / Numbers: camelCase and snake_case subwords
      if (wordCharRegex.test(char)) {
        wordCount++;
        let word = '';
        while (i < trimmed.length && wordCharRegex.test(trimmed[i])) {
          word += trimmed[i];
          i++;
        }

        // Subword splitting estimation:
        // Short words (< 4 chars) = 1 token
        // Longer words = ~1 token per 3.6 characters
        // CamelCase transitions: e.g. "getUserById" -> "get", "User", "By", "Id"
        const camelSplits = word.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z]+)(?=[A-Z][a-z])|_/).filter(Boolean);
        let wordTokens = 0;
        for (const part of camelSplits) {
          if (part.length <= 4) {
            wordTokens += 1;
          } else {
            wordTokens += Math.ceil(part.length / 3.6);
          }
        }
        baseTokenCount += Math.max(1, wordTokens);
        continue;
      }

      // Other Unicode / Emojis
      baseTokenCount += 1.5;
      i++;
    }

    // Newline token
    baseTokenCount += 1;
  }

  const rawTokens = Math.round(baseTokenCount);

  // Model-specific adjustments based on tokenizer vocabularies
  const gpt4oTokens = Math.round(rawTokens * 0.95); // o200k has 200k vocabulary, highly dense
  const claudeTokens = Math.round(rawTokens * 1.02); // Claude 3.5 Sonnet tokenizer
  const geminiTokens = Math.round(rawTokens * 0.97); // Gemini sentencepiece
  const deepseekTokens = Math.round(rawTokens * 0.92); // DeepSeek Byte-fallback (compact Chinese/Code)

  const estimatedTokens = gpt4oTokens;

  return {
    estimatedTokens,
    gpt4oTokens,
    claudeTokens,
    geminiTokens,
    deepseekTokens,
    characters,
    lines,
    words: wordCount,
    chineseChars: chineseCount,
    punctuationChars: punctuationCount,
    contextUsage: {
      gpt128k: Number(((gpt4oTokens / 128000) * 100).toFixed(2)),
      claude200k: Number(((claudeTokens / 200000) * 100).toFixed(2)),
      gemini1m: Number(((geminiTokens / 1000000) * 100).toFixed(2)),
      deepseek128k: Number(((deepseekTokens / 128000) * 100).toFixed(2)),
    },
  };
}
