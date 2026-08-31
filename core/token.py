# -*- coding: utf-8 -*-
"""
Multi-Model Token Estimation Engine for ZipToTxt.
Simulates subword splitting, CJK tokenization weights, punctuation isolation,
and indentation token costs across GPT-4o (o200k), Claude 3.5, Gemini 1.5/2.0, and DeepSeek.
"""
import re
from typing import Dict, Any
from .models import TokenStats

def estimate_tokens(text: str) -> int:
    """Fast baseline token estimator."""
    if not text:
        return 0
    return max(1, int(len(text) / 3.8) + 1)

def estimate_tokens_detailed(text: str) -> Dict[str, Any]:
    """
    Detailed multi-model token estimation for LLM architectures.
    Returns a dictionary with model token estimations, text stats, and context window percentages.
    """
    if not text:
        return TokenStats(
            estimated_tokens=0,
            gpt4o_tokens=0,
            claude_tokens=0,
            gemini_tokens=0,
            deepseek_tokens=0,
            characters=0,
            lines=0,
            words=0,
            chinese_chars=0,
            punctuation_chars=0,
            context_usage={
                "gpt128k": 0.0,
                "claude200k": 0.0,
                "gemini1m": 0.0,
                "deepseek128k": 0.0,
            }
        )

    characters = len(text)
    line_array = text.splitlines()
    lines = len(line_array)

    chinese_count = 0
    punctuation_count = 0
    word_count = 0
    base_token_count = 0.0

    cjk_regex = re.compile(r'[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf\uf900-\ufaff]')
    punc_regex = re.compile(r'[!@#$%^&*()_+\-=[\]{};\':"\\|,.<>/?`~]')
    word_char_regex = re.compile(r'[a-zA-Z0-9]')

    for line in line_array:
        if not line:
            base_token_count += 1.0
            continue

        # Indentation handling (4 spaces = 1 token, 1 tab = 1 token)
        indent_match = re.match(r'^[ \t]+', line)
        if indent_match:
            indent_str = indent_match.group(0)
            spaces = indent_str.count(' ')
            tabs = indent_str.count('\t')
            base_token_count += (spaces + 3) // 4 + tabs

        trimmed = line.strip()
        if not trimmed:
            base_token_count += 1.0
            continue

        i = 0
        line_len = len(trimmed)
        while i < line_len:
            char = trimmed[i]

            if cjk_regex.match(char):
                chinese_count += 1
                base_token_count += 1.15
                i += 1
                continue

            if punc_regex.match(char):
                punctuation_count += 1
                base_token_count += 1.0
                i += 1
                continue

            if char in (' ', '\t'):
                s_count = 0
                while i < line_len and trimmed[i] in (' ', '\t'):
                    s_count += 1
                    i += 1
                base_token_count += (s_count + 2) // 3
                continue

            if word_char_regex.match(char):
                word_count += 1
                word_start = i
                while i < line_len and word_char_regex.match(trimmed[i]):
                    i += 1
                word = trimmed[word_start:i]

                # CamelCase and snake_case split
                camel_splits = [p for p in re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\d|$)|[0-9]+', word) if p]
                if not camel_splits:
                    camel_splits = [word]
                word_tokens = 0
                for part in camel_splits:
                    if len(part) <= 4:
                        word_tokens += 1
                    else:
                        word_tokens += (len(part) + 3) // 4
                base_token_count += max(1, word_tokens)
                continue

            base_token_count += 1.5
            i += 1

        base_token_count += 1.0

    raw_tokens = int(round(base_token_count))

    gpt4o_tokens = int(round(raw_tokens * 0.95))
    claude_tokens = int(round(raw_tokens * 1.02))
    gemini_tokens = int(round(raw_tokens * 0.97))
    deepseek_tokens = int(round(raw_tokens * 0.92))
    estimated_tokens = gpt4o_tokens

    return TokenStats(
        estimated_tokens=estimated_tokens,
        gpt4o_tokens=gpt4o_tokens,
        claude_tokens=claude_tokens,
        gemini_tokens=gemini_tokens,
        deepseek_tokens=deepseek_tokens,
        characters=characters,
        lines=lines,
        words=word_count,
        chinese_chars=chinese_count,
        punctuation_chars=punctuation_count,
        context_usage={
            "gpt128k": round((gpt4o_tokens / 128000.0) * 100.0, 2),
            "claude200k": round((claude_tokens / 200000.0) * 100.0, 2),
            "gemini1m": round((gemini_tokens / 1000000.0) * 100.0, 2),
            "deepseek128k": round((deepseek_tokens / 128000.0) * 100.0, 2),
        }
    )
