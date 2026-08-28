# -*- coding: utf-8 -*-
"""
ZipToTxt Core Package - Industrial Grade Security, Repo Serialization & AI Patching.
"""

from .constants import (
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_ZIP_SINGLE_FILE_BYTES,
    MAX_AI_INPUT_BYTES,
    MAX_AI_FILES,
    MAX_AI_TOTAL_OUTPUT_BYTES,
    MAX_AI_SINGLE_OUTPUT_BYTES,
    TEXT_EXTENSIONS,
    TEXT_FILENAMES,
    SENSITIVE_FILE_NAMES,
    SENSITIVE_DIR_NAMES,
    WINDOWS_RESERVED_NAMES,
    IGNORED_METADATA_FILES,
    AI_PRIMARY_PROMPT,
    AI_CONTINUE_PROMPT,
    AI_REVIEW_PROMPT,
    AI_AUDIT_PROMPT_CN,
    AI_AUDIT_PROMPT_EN,
)

from .models import (
    SecurityError,
    ZipSecurityConfig,
    ZipFileEntry,
    ParsedAiBlock,
    TokenStats,
    ParseResult,
    RepoContextResult,
)

from .security import (
    normalize_ai_path,
    is_safe_relative_path,
    is_sensitive_path,
    is_ignored_metadata_path,
    human_size,
    calculate_sha256,
)

from .text import (
    is_binary_data,
    is_text_file,
    decode_text,
    get_file_language,
)

from .token import (
    estimate_tokens,
    estimate_tokens_detailed,
)

from .archive import (
    safe_extract_zip,
    generate_ascii_tree,
    scan_and_format_repo,
)

from .parser import (
    parse_ai_blocks,
    parse_ai_output,
)

from .patch import (
    create_patch_zip,
    write_parsed_files_to_dir,
)

__all__ = [
    "MAX_ZIP_BYTES",
    "MAX_ZIP_MEMBERS",
    "MAX_ZIP_UNCOMPRESSED_BYTES",
    "MAX_ZIP_SINGLE_FILE_BYTES",
    "MAX_AI_INPUT_BYTES",
    "MAX_AI_FILES",
    "MAX_AI_TOTAL_OUTPUT_BYTES",
    "MAX_AI_SINGLE_OUTPUT_BYTES",
    "TEXT_EXTENSIONS",
    "TEXT_FILENAMES",
    "SENSITIVE_FILE_NAMES",
    "SENSITIVE_DIR_NAMES",
    "WINDOWS_RESERVED_NAMES",
    "IGNORED_METADATA_FILES",
    "AI_PRIMARY_PROMPT",
    "AI_CONTINUE_PROMPT",
    "AI_REVIEW_PROMPT",
    "AI_AUDIT_PROMPT_CN",
    "AI_AUDIT_PROMPT_EN",
    "SecurityError",
    "ZipSecurityConfig",
    "ZipFileEntry",
    "ParsedAiBlock",
    "TokenStats",
    "ParseResult",
    "RepoContextResult",
    "normalize_ai_path",
    "is_safe_relative_path",
    "is_sensitive_path",
    "is_ignored_metadata_path",
    "human_size",
    "calculate_sha256",
    "is_binary_data",
    "is_text_file",
    "decode_text",
    "get_file_language",
    "estimate_tokens",
    "estimate_tokens_detailed",
    "safe_extract_zip",
    "generate_ascii_tree",
    "scan_and_format_repo",
    "parse_ai_blocks",
    "parse_ai_output",
    "create_patch_zip",
    "write_parsed_files_to_dir",
]
