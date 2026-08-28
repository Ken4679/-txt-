# -*- coding: utf-8 -*-
"""
Security validation module for ZipToTxt.
Defends against Zip Slip, Zip Bomb, Symlink escaping, Windows device names,
Unicode Trojan Source / Bidi overrides, and sensitive credential exposure.
"""
import hashlib
import logging
import re
import urllib.parse
from typing import Union
from .constants import (
    SENSITIVE_DIR_NAMES,
    SENSITIVE_FILE_NAMES,
    WINDOWS_RESERVED_NAMES,
    IGNORED_METADATA_FILES,
)
from .models import SecurityError

logger = logging.getLogger(__name__)

def human_size(num_bytes: Union[int, float]) -> str:
    """Formats bytes into human readable binary units."""
    size = float(num_bytes)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0 or unit == 'TB':
            return f"{int(size)} B" if unit == 'B' else f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

def calculate_sha256(data: bytes) -> str:
    """Calculates SHA-256 hex digest for byte payload."""
    return hashlib.sha256(data).hexdigest()

def normalize_ai_path(raw_path: str) -> str:
    """
    Sanitizes, normalizes and validates file paths to prevent directory traversal (Zip Slip),
    Unicode Trojan Source, Windows reserved device names, null-byte injection, and absolute paths.
    """
    if not raw_path or not isinstance(raw_path, str):
        raise SecurityError("Path cannot be empty.")

    # 1. Clean hidden control chars, zero-width spaces, bidi overrides, null bytes
    cleaned = re.sub(r'[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\ufeff]', '', raw_path).strip()

    # 2. Iteratively decode multi-level URL encoded sequences (e.g. %252e%252e, %2e%2e, %2f, %5c)
    decoded = cleaned
    for _ in range(3):
        if '%' in decoded:
            try:
                nxt = urllib.parse.unquote(decoded)
                if nxt == decoded:
                    break
                decoded = nxt
            except Exception:
                break
        else:
            break
    path = decoded

    # 3. Replace backslashes with forward slashes and strip markdown quotes/brackets
    path = path.replace('\\', '/')
    path = re.sub(r'^[`"\'\s*#\[\(]+|[`"\'\s*#\]\)]+$', '', path).strip()

    if not path:
        raise SecurityError(f"Invalid empty file path from raw input: {raw_path!r}")

    # Disallow UNC network shares and Windows drive letters (C:, D:, //server/...)
    if re.match(r'^[A-Za-z]:', path) or path.startswith('//'):
        raise SecurityError(f"Absolute or UNC network paths are forbidden: {raw_path}")

    # 4. Remove leading slashes and relative './' prefixes
    path = re.sub(r'^/+', '', path)
    while path.startswith('./'):
        path = re.sub(r'^/+', '', path[2:])

    if not path:
        raise SecurityError(f"Path resolved to empty relative path: {raw_path}")

    # 5. Strict Zip Slip check on components
    raw_parts = path.split('/')
    parts = []
    for part in raw_parts:
        trimmed = part.strip()
        if not trimmed or trimmed == '.':
            continue
        if trimmed == '..' or trimmed.lower() == '%2e%2e' or '..' in trimmed:
            raise SecurityError(f"Directory traversal sequence (Zip Slip) detected: {raw_path}")
        parts.append(trimmed)

    if not parts:
        raise SecurityError(f"Path resolved to empty directory root: {raw_path}")

    # 6. Check Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    for part in parts:
        base_name = part.split('.')[0].upper()
        if base_name in WINDOWS_RESERVED_NAMES:
            raise SecurityError(f"Windows reserved device name is forbidden: {part} in {raw_path}")

    return "/".join(parts)

def is_safe_relative_path(path: str) -> bool:
    """Returns True if the path is safe from traversal and reserved names."""
    try:
        normalize_ai_path(path)
        return True
    except SecurityError:
        return False

def is_sensitive_path(rel_path: str) -> bool:
    """Checks if the path contains sensitive keys, env vars, or private configuration."""
    try:
        norm = normalize_ai_path(rel_path)
        parts = norm.split('/')
        if any(p.lower() in SENSITIVE_DIR_NAMES for p in parts):
            return True
        file_name = parts[-1].lower()
        if file_name in SENSITIVE_FILE_NAMES:
            return True
        if (
            file_name.startswith('.env') or
            file_name.endswith(('.pem', '.key', '.pfx', '.p12')) or
            'id_rsa' in file_name or
            'id_ed25519' in file_name or
            'service_account' in file_name or
            'service-account' in file_name
        ):
            return True
        return False
    except Exception:
        return True

def is_ignored_metadata_path(rel_path: str) -> bool:
    """Checks if the path is OS metadata (e.g. __MACOSX, .DS_Store, Thumbs.db)."""
    parts = rel_path.split('/')
    for p in parts:
        if p in IGNORED_METADATA_FILES or p.startswith('._') or p == '__MACOSX':
            return True
    return False
