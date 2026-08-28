# -*- coding: utf-8 -*-
"""
Patch generation and directory write utilities for ZipToTxt.
"""
import os
import io
import zipfile
import logging
from typing import Dict, List, Optional
from .models import SecurityError
from .security import normalize_ai_path, is_sensitive_path

logger = logging.getLogger(__name__)

def create_patch_zip(
    files_dict: Dict[str, str],
    allow_sensitive: bool = False,
    output_path: Optional[str] = None
) -> bytes:
    """
    Packs parsed AI file modifications into a standard compressed Patch ZIP archive.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel_path, content in files_dict.items():
            norm_path = normalize_ai_path(rel_path)
            if is_sensitive_path(norm_path) and not allow_sensitive:
                raise SecurityError(f"Sensitive file blocked by security policy: {norm_path}. Enable sensitive files permission to include.")
            
            data = content.encode('utf-8')
            zf.writestr(norm_path, data)

    zip_bytes = buf.getvalue()

    if output_path:
        out_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(out_dir, exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(zip_bytes)

    return zip_bytes

def write_parsed_files_to_dir(
    files_dict: Dict[str, str],
    target_dir: str,
    allow_sensitive: bool = False
) -> List[str]:
    """
    Writes parsed files directly to target_dir with strict path containment checks.
    """
    target_dir = os.path.abspath(target_dir)
    os.makedirs(target_dir, exist_ok=True)
    written: List[str] = []

    for rel_path, content in files_dict.items():
        norm_path = normalize_ai_path(rel_path)
        if is_sensitive_path(norm_path) and not allow_sensitive:
            raise SecurityError(f"Sensitive file blocked: {norm_path}")

        full_dest = os.path.abspath(os.path.join(target_dir, norm_path))
        if not full_dest.startswith(target_dir + os.sep) and full_dest != target_dir:
            raise SecurityError(f"Path escape attempt (Zip Slip) detected: {rel_path}")

        os.makedirs(os.path.dirname(full_dest), exist_ok=True)
        with open(full_dest, 'w', encoding='utf-8') as f:
            f.write(content)

        written.append(norm_path)

    return written
