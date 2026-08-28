# -*- coding: utf-8 -*-
"""
Text decoding and language detection utilities for ZipToTxt.
"""
import os
from typing import Optional
from .constants import TEXT_EXTENSIONS, TEXT_FILENAMES

def is_text_file(filename: str) -> bool:
    """Checks whether a file path has a standard text file extension or name."""
    base_name = os.path.basename(filename)
    if base_name in TEXT_FILENAMES:
        return True
    _, ext = os.path.splitext(filename)
    return ext.lower() in TEXT_EXTENSIONS

def is_binary_data(filename: str, data: bytes) -> bool:
    """
    Determines if file content is binary by checking file type rules, null bytes,
    and multi-encoding decoding.
    """
    base_name = os.path.basename(filename)
    _, ext = os.path.splitext(filename)
    if base_name in TEXT_FILENAMES or ext.lower() in TEXT_EXTENSIONS:
        return False

    sample = data[:8192]
    if b'\x00' in sample:
        return True

    # Try UTF-8
    try:
        sample.decode('utf-8', errors='strict')
        return False
    except UnicodeDecodeError:
        pass

    # Try GB18030 / GBK fallback
    try:
        sample.decode('gb18030', errors='strict')
        return False
    except UnicodeDecodeError:
        return True

def decode_text(data: bytes) -> str:
    """
    Decodes byte stream into string, handling BOM and multi-byte encodings (UTF-8, GB18030, Big5, Shift-JIS, Latin1).
    """
    if not data:
        return ""

    # Strip UTF-8 BOM
    if data.startswith(b'\xef\xbb\xbf'):
        data = data[3:]
    # Strip UTF-16LE BOM
    elif data.startswith(b'\xff\xfe'):
        try:
            return data[2:].decode('utf-16le')
        except Exception:
            pass
    # Strip UTF-16BE BOM
    elif data.startswith(b'\xfe\xff'):
        try:
            return data[2:].decode('utf-16be')
        except Exception:
            pass

    for enc in ('utf-8', 'gb18030', 'big5', 'shift_jis', 'cp1252', 'latin-1'):
        try:
            return data.decode(enc, errors='strict')
        except UnicodeDecodeError:
            continue

    return data.decode('utf-8', errors='replace')

def get_file_language(file_path: str) -> str:
    """Infers markdown syntax highlighting language from file extension."""
    _, ext = os.path.splitext(file_path)
    ext = ext.lstrip('.').lower()
    mapping = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'pyw': 'python',
        'json': 'json',
        'jsonc': 'json',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'md': 'markdown',
        'markdown': 'markdown',
        'yml': 'yaml',
        'yaml': 'yaml',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'rs': 'rust',
        'go': 'go',
        'java': 'java',
        'kt': 'kotlin',
        'kts': 'kotlin',
        'c': 'c',
        'h': 'c',
        'cpp': 'cpp',
        'hpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'sql': 'sql',
        'xml': 'xml',
        'vue': 'vue',
        'svelte': 'svelte',
        'toml': 'toml',
        'ini': 'ini',
    }
    return mapping.get(ext, ext or 'text')
