# -*- coding: utf-8 -*-
"""
Archive scanning, formatting, and safe extraction module for ZipToTxt.
"""
import os
import io
import base64
import zipfile
import logging
from typing import Dict, List, Tuple, Optional, Set, Any, Callable
from .constants import (
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_ZIP_SINGLE_FILE_BYTES,
    COMMON_IGNORE_FOLDERS,
)
from .models import (
    SecurityError,
    ZipSecurityConfig,
    ZipFileEntry,
    RepoContextResult,
)
from .security import (
    normalize_ai_path,
    human_size,
    calculate_sha256,
    is_ignored_metadata_path,
)
from .text import (
    is_binary_data,
    decode_text,
    get_file_language,
)
from .token import estimate_tokens

logger = logging.getLogger(__name__)

def generate_ascii_tree(paths: List[str], root_name: str = "project") -> str:
    """Builds a formatted ASCII directory tree from a list of relative file paths."""
    tree: Dict[str, Any] = {}
    for p in paths:
        parts = p.split('/')
        curr = tree
        for part in parts:
            if part not in curr:
                curr[part] = {}
            curr = curr[part]

    lines = [f"{root_name}/"]

    def walk(node: Dict[str, Any], prefix: str = ""):
        keys = sorted(node.keys(), key=lambda k: (len(node[k]) == 0, k.lower()))
        for i, k in enumerate(keys):
            is_last = (i == len(keys) - 1)
            connector = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "
            is_dir = len(node[k]) > 0
            lines.append(f"{prefix}{connector}{k}{'/' if is_dir else ''}")
            if is_dir:
                walk(node[k], prefix + child_prefix)

    walk(tree)
    return "\n".join(lines)

def safe_extract_zip(
    zip_path_or_bytes: Any,
    target_dir: str,
    config: Optional[ZipSecurityConfig] = None
) -> List[str]:
    """
    Safely extracts a ZIP archive to target_dir with strict Zip Slip, Symlink,
    and Zip Bomb limits. Returns list of extracted normalized relative paths.
    """
    if config is None:
        config = ZipSecurityConfig()

    target_dir = os.path.abspath(target_dir)
    os.makedirs(target_dir, exist_ok=True)

    if isinstance(zip_path_or_bytes, (bytes, bytearray)):
        if len(zip_path_or_bytes) > config.max_zip_bytes:
            raise SecurityError(f"ZIP byte size ({human_size(len(zip_path_or_bytes))}) exceeds limit {human_size(config.max_zip_bytes)}")
        zf = zipfile.ZipFile(io.BytesIO(zip_path_or_bytes), 'r')
    else:
        file_size = os.path.getsize(zip_path_or_bytes)
        if file_size > config.max_zip_bytes:
            raise SecurityError(f"ZIP file size ({human_size(file_size)}) exceeds limit {human_size(config.max_zip_bytes)}")
        zf = zipfile.ZipFile(zip_path_or_bytes, 'r')

    infolist = zf.infolist()
    if len(infolist) > config.max_members:
        raise SecurityError(f"ZIP contains {len(infolist)} entries, exceeding limit {config.max_members}")

    total_uncompressed = 0
    extracted_files: List[str] = []

    try:
        for member in infolist:
            if member.is_dir():
                continue

            if is_ignored_metadata_path(member.filename):
                continue

            # Symlink detection (UNIX symlink flag 0o120000)
            if (member.external_attr >> 16) & 0o120000 == 0o120000:
                raise SecurityError(f"Symlinks inside ZIP archives are forbidden for security: {member.filename}")

            if member.file_size > config.max_single_file_bytes:
                raise SecurityError(f"Single file {member.filename} ({human_size(member.file_size)}) exceeds limit {human_size(config.max_single_file_bytes)}")

            total_uncompressed += member.file_size
            if total_uncompressed > config.max_uncompressed_bytes:
                raise SecurityError(f"Total uncompressed ZIP size exceeds limit {human_size(config.max_uncompressed_bytes)}")

            norm_rel_path = normalize_ai_path(member.filename)
            dest_path = os.path.abspath(os.path.join(target_dir, norm_rel_path))

            if not dest_path.startswith(target_dir + os.sep) and dest_path != target_dir:
                raise SecurityError(f"Path escape attempt (Zip Slip) detected: {member.filename}")

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with zf.open(member) as src, open(dest_path, 'wb') as dst:
                while True:
                    chunk = src.read(64 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)

            extracted_files.append(norm_rel_path)

        return extracted_files
    finally:
        zf.close()

def scan_and_format_repo(
    zip_path_or_bytes: Any,
    include_binary: bool = False,
    filter_ignored_folders: bool = True,
    ignored_folders: Optional[List[str]] = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Scans a ZIP archive or a directory folder, producing structured AI context text
    with ASCII directory tree, sha256 digests, and token estimations.
    Returns: (formatted_txt, ascii_tree, metadata_dict)
    """
    if ignored_folders is None:
        ignored_folders = COMMON_IGNORE_FOLDERS
    ignored_folders_lower = set(f.lower() for f in ignored_folders)

    # 1. Directory scanning mode
    if isinstance(zip_path_or_bytes, str) and os.path.isdir(zip_path_or_bytes):
        root_dir = os.path.abspath(zip_path_or_bytes)
        root_name = os.path.basename(root_dir) or "project"

        valid_files: List[Tuple[str, str]] = [] # (abs_path, rel_path)
        ignored_count = 0

        for root, dirs, files in os.walk(root_dir):
            # In-place directory filtering
            if filter_ignored_folders:
                pruned = [d for d in dirs if d.lower() in ignored_folders_lower or d.startswith('.')]
                ignored_count += len(pruned)
                dirs[:] = [d for d in dirs if d.lower() not in ignored_folders_lower and not d.startswith('.')]

            for fname in files:
                if is_ignored_metadata_path(fname):
                    ignored_count += 1
                    continue
                abs_fpath = os.path.join(root, fname)
                rel_fpath = os.path.relpath(abs_fpath, root_dir).replace('\\', '/')
                try:
                    norm_path = normalize_ai_path(rel_fpath)
                except SecurityError:
                    ignored_count += 1
                    continue

                if filter_ignored_folders:
                    parts = norm_path.split('/')
                    if any(p.lower() in ignored_folders_lower for p in parts):
                        ignored_count += 1
                        continue

                valid_files.append((abs_fpath, norm_path))

        if not valid_files:
            raise ValueError(f"No valid source code files found in directory: {root_dir}")

        if len(valid_files) > MAX_ZIP_MEMBERS:
            raise SecurityError(f"Directory file count ({len(valid_files)}) exceeds maximum limit {MAX_ZIP_MEMBERS}")

        valid_files.sort(key=lambda x: x[1].lower())
        total_files = len(valid_files)
        entries: List[ZipFileEntry] = []
        text_count = 0
        binary_count = 0
        total_lines = 0
        total_uncompressed = 0

        for idx, (abs_fpath, rel_path) in enumerate(valid_files):
            if progress_callback:
                progress_callback(idx + 1, total_files, rel_path)

            file_size = os.path.getsize(abs_fpath)
            if file_size > MAX_ZIP_SINGLE_FILE_BYTES:
                raise SecurityError(f"File {rel_path} size ({human_size(file_size)}) exceeds limit {human_size(MAX_ZIP_SINGLE_FILE_BYTES)}")

            total_uncompressed += file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise SecurityError(f"Total uncompressed directory size exceeds limit {human_size(MAX_ZIP_UNCOMPRESSED_BYTES)}")

            with open(abs_fpath, 'rb') as f:
                raw_bytes = f.read()

            sha256 = calculate_sha256(raw_bytes)
            is_bin = is_binary_data(rel_path, raw_bytes)

            text_content: Optional[str] = None
            b64_content: Optional[str] = None

            if is_bin:
                binary_count += 1
                if include_binary:
                    b64_content = base64.b64encode(raw_bytes).decode('ascii')
            else:
                text_count += 1
                text_content = decode_text(raw_bytes)
                total_lines += len(text_content.splitlines())

            entries.append(ZipFileEntry(
                path=rel_path,
                relative_path=rel_path,
                size=file_size,
                is_binary=is_bin,
                sha256=sha256,
                content=text_content,
                base64=b64_content
            ))

        ascii_tree = generate_ascii_tree([e.relative_path for e in entries], root_name)

        txt_parts = [
            "=" * 80,
            "ZIPIFY REPOSITORY CONTEXT EXPORT",
            "=" * 80 + "\n",
            "DIRECTORY STRUCTURE:",
            ascii_tree,
            "\n" + "=" * 80,
            "REPOSITORY SOURCE CODE FILES",
            "=" * 80 + "\n"
        ]

        for e in entries:
            if e.is_binary:
                if include_binary and e.base64:
                    txt_parts.append(f"### FILE: {e.relative_path} [BASE64_BINARY]")
                    txt_parts.append("```base64")
                    txt_parts.append(e.base64)
                    txt_parts.append("```\n")
                else:
                    txt_parts.append(f"### FILE: {e.relative_path} [BINARY FILE: {human_size(e.size)}, SHA-256: {e.sha256}]\n")
            else:
                lang = get_file_language(e.relative_path)
                txt_parts.append(f"### FILE: {e.relative_path}")
                txt_parts.append(f"```{lang}")
                txt_parts.append(e.content or "")
                txt_parts.append("```\n")

        txt_content = "\n".join(txt_parts)
        est_tokens = estimate_tokens(txt_content)

        metadata = {
            "file_count": len(entries),
            "text_count": text_count,
            "binary_count": binary_count,
            "total_lines": total_lines,
            "estimated_tokens": est_tokens,
            "ignored_count": ignored_count,
            "root_name": root_name,
        }

        return txt_content, ascii_tree, metadata

    # 2. ZIP Archive scanning mode
    if isinstance(zip_path_or_bytes, (bytes, bytearray)):
        zf = zipfile.ZipFile(io.BytesIO(zip_path_or_bytes), 'r')
        archive_name = "project"
    else:
        zf = zipfile.ZipFile(zip_path_or_bytes, 'r')
        archive_name = os.path.splitext(os.path.basename(str(zip_path_or_bytes)))[0]

    try:
        infolist = zf.infolist()
        if len(infolist) > MAX_ZIP_MEMBERS:
            raise SecurityError(f"ZIP entries count ({len(infolist)}) exceeds maximum limit {MAX_ZIP_MEMBERS}")

        valid_members: List[Tuple[zipfile.ZipInfo, str]] = []
        ignored_count = 0

        for m in infolist:
            if m.is_dir():
                continue

            if is_ignored_metadata_path(m.filename):
                ignored_count += 1
                continue

            # Symlink check
            if (m.external_attr >> 16) & 0o120000 == 0o120000:
                raise SecurityError(f"Symlinks inside ZIP archives are forbidden: {m.filename}")

            norm_path = normalize_ai_path(m.filename)

            if filter_ignored_folders and ignored_folders:
                parts = norm_path.split('/')
                if any(p.lower() in ignored_folders for p in parts):
                    ignored_count += 1
                    continue

            valid_members.append((m, norm_path))

        if not valid_members:
            raise ValueError("No valid source code files found in the ZIP archive.")

        # Common root prefix detection
        common_prefix = ""
        first_parts = valid_members[0][1].split('/')
        if len(first_parts) > 1:
            candidate = first_parts[0] + '/'
            if all(norm.startswith(candidate) for _, norm in valid_members):
                common_prefix = candidate

        root_display_name = common_prefix.rstrip('/') if common_prefix else archive_name

        # Sort members predictably
        valid_members.sort(key=lambda x: (x[1][len(common_prefix):] if common_prefix else x[1]).lower())

        total_files = len(valid_members)
        entries: List[ZipFileEntry] = []
        text_count = 0
        binary_count = 0
        total_lines = 0
        total_uncompressed = 0

        for idx, (m, norm_path) in enumerate(valid_members):
            rel_path = norm_path[len(common_prefix):] if common_prefix else norm_path
            if progress_callback:
                progress_callback(idx + 1, total_files, rel_path)

            raw_bytes = zf.read(m)
            file_size = len(raw_bytes)

            if file_size > MAX_ZIP_SINGLE_FILE_BYTES:
                raise SecurityError(f"File {rel_path} size ({human_size(file_size)}) exceeds limit {human_size(MAX_ZIP_SINGLE_FILE_BYTES)}")

            total_uncompressed += file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise SecurityError(f"Total uncompressed ZIP size exceeds limit {human_size(MAX_ZIP_UNCOMPRESSED_BYTES)}")

            sha256 = calculate_sha256(raw_bytes)
            is_bin = is_binary_data(rel_path, raw_bytes)

            text_content: Optional[str] = None
            b64_content: Optional[str] = None

            if is_bin:
                binary_count += 1
                if include_binary:
                    b64_content = base64.b64encode(raw_bytes).decode('ascii')
            else:
                text_count += 1
                text_content = decode_text(raw_bytes)
                total_lines += len(text_content.splitlines())

            entries.append(ZipFileEntry(
                path=norm_path,
                relative_path=rel_path,
                size=file_size,
                is_binary=is_bin,
                sha256=sha256,
                content=text_content,
                base64=b64_content
            ))

        ascii_tree = generate_ascii_tree([e.relative_path for e in entries], root_display_name)

        txt_parts = [
            "=" * 80,
            "ZIPIFY REPOSITORY CONTEXT EXPORT",
            "=" * 80 + "\n",
            "DIRECTORY STRUCTURE:",
            ascii_tree,
            "\n" + "=" * 80,
            "REPOSITORY SOURCE CODE FILES",
            "=" * 80 + "\n"
        ]

        for e in entries:
            if e.is_binary:
                if include_binary and e.base64:
                    txt_parts.append(f"### FILE: {e.relative_path} [BASE64_BINARY]")
                    txt_parts.append("```base64")
                    txt_parts.append(e.base64)
                    txt_parts.append("```\n")
                else:
                    txt_parts.append(f"### FILE: {e.relative_path} [BINARY FILE: {human_size(e.size)}, SHA-256: {e.sha256}]\n")
            else:
                lang = get_file_language(e.relative_path)
                txt_parts.append(f"### FILE: {e.relative_path}")
                txt_parts.append(f"```{lang}")
                txt_parts.append(e.content or "")
                txt_parts.append("```\n")

        txt_content = "\n".join(txt_parts)
        est_tokens = estimate_tokens(txt_content)

        metadata = {
            "file_count": len(entries),
            "text_count": text_count,
            "binary_count": binary_count,
            "total_lines": total_lines,
            "estimated_tokens": est_tokens,
            "ignored_count": ignored_count,
            "root_name": root_display_name,
        }

        return txt_content, ascii_tree, metadata
    finally:
        zf.close()
