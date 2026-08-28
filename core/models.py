# -*- coding: utf-8 -*-
"""
Typed data models for ZipToTxt.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from .constants import (
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_ZIP_SINGLE_FILE_BYTES,
)

class SecurityError(Exception):
    """Raised when security boundaries (ZipSlip, ZipBomb, Path Escaping) are breached."""
    pass

@dataclass
class ZipSecurityConfig:
    max_zip_bytes: int = MAX_ZIP_BYTES
    max_members: int = MAX_ZIP_MEMBERS
    max_uncompressed_bytes: int = MAX_ZIP_UNCOMPRESSED_BYTES
    max_single_file_bytes: int = MAX_ZIP_SINGLE_FILE_BYTES

@dataclass
class ZipFileEntry:
    path: str
    relative_path: str
    size: int
    is_binary: bool
    sha256: Optional[str] = None
    content: Optional[str] = None
    base64: Optional[str] = None

@dataclass
class ParsedAiBlock:
    path: str
    content: str
    language: Optional[str] = None
    size: int = 0
    is_sensitive: bool = False
    is_auto_closed: bool = False

@dataclass
class TokenStats:
    estimated_tokens: int
    gpt4o_tokens: int
    claude_tokens: int
    gemini_tokens: int
    deepseek_tokens: int
    characters: int
    lines: int
    words: int
    chinese_chars: int
    punctuation_chars: int
    context_usage: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "estimated_tokens": self.estimated_tokens,
            "gpt4o_tokens": self.gpt4o_tokens,
            "claude_tokens": self.claude_tokens,
            "gemini_tokens": self.gemini_tokens,
            "deepseek_tokens": self.deepseek_tokens,
            "characters": self.characters,
            "lines": self.lines,
            "words": self.words,
            "chinese_chars": self.chinese_chars,
            "punctuation_chars": self.punctuation_chars,
            "context_usage": self.context_usage,
        }

@dataclass
class ParseResult:
    files: List[ParsedAiBlock]
    warnings: List[str] = field(default_factory=list)
    auto_closed_count: int = 0

@dataclass
class RepoContextResult:
    txt_content: str
    ascii_tree: str
    file_count: int
    text_count: int
    binary_count: int
    total_lines: int
    estimated_tokens: int
    ignored_count: int
    entries: List[ZipFileEntry] = field(default_factory=list)
