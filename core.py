import base64
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Callable


TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".rst",
    ".py", ".pyw",
    ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
    ".java", ".kt", ".kts",
    ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp",
    ".cs",
    ".go", ".rs", ".swift", ".m", ".mm",
    ".php", ".rb", ".lua", ".pl", ".pm",
    ".sh", ".bash", ".zsh", ".fish",
    ".bat", ".cmd", ".ps1",
    ".sql",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".xml", ".json", ".jsonc",
    ".yaml", ".yml", ".toml",
    ".ini", ".cfg", ".conf", ".properties",
    ".env",
    ".dockerignore", ".gitattributes", ".gitignore", ".editorconfig",
    ".gradle", ".cmake",
    ".vue", ".svelte",
}

TEXT_FILENAMES = {
    "Dockerfile",
    "Makefile",
    "CMakeLists.txt",
    "LICENSE",
    "LICENSE.txt",
    "README",
    "README.txt",
    "README.md",
    ".gitignore",
    ".gitattributes",
    ".dockerignore",
    ".editorconfig",
    ".env",
}

def get_app_data_dir() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "ZipToTxt"
    return Path.home() / ".zip_to_txt"

def choose_default_output(zip_path: Path) -> Path:
    return zip_path.with_suffix(".txt")

def open_folder(path: Path):
    path = Path(path)
    if os.name == "nt":
        os.startfile(str(path))
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])

def is_binary_file(path: Path, sample_size: int = 8192) -> bool:
    if path.name in TEXT_FILENAMES or path.suffix.lower() in TEXT_EXTENSIONS:
        return False

    try:
        sample = path.read_bytes()[:sample_size]
    except OSError:
        return True

    if b"\x00" in sample:
        return True

    for encoding in ("utf-8", "gb18030"):
        try:
            sample.decode(encoding)
            return False
        except UnicodeDecodeError:
            pass

    return True

def read_text_content(path: Path) -> str:
    data = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "utf-16", "utf-16-le", "utf-16-be", "big5"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()

def human_size(value: int) -> str:
    size = float(value)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} PB"

def safe_extract_zip(zip_path: Path, extract_dir: Path):
    extract_dir = extract_dir.resolve()

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            target = (extract_dir / info.filename).resolve()
            try:
                target.relative_to(extract_dir)
            except ValueError:
                raise ValueError(f"ZIP 中存在非法路径：{info.filename}")

        zf.extractall(extract_dir)

def find_repository_root(temp_dir: Path) -> Path:
    entries = [p for p in temp_dir.iterdir()]
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return temp_dir

def build_tree(root: Path) -> list[str]:
    lines = [f"{root.name}/"]

    def walk(directory: Path, prefix: str):
        children = sorted(
            directory.iterdir(),
            key=lambda p: (not p.is_dir(), p.name.lower()),
        )
        for index, child in enumerate(children):
            last = index == len(children) - 1
            connector = "└── " if last else "├── "
            next_prefix = prefix + ("    " if last else "│   ")
            if child.is_dir():
                lines.append(f"{prefix}{connector}{child.name}/")
                walk(child, next_prefix)
            else:
                lines.append(f"{prefix}{connector}{child.name}")

    walk(root, "")
    return lines

def process_zip_to_txt(
    zip_path: Path,
    output_txt_path: Path,
    include_binary: bool,
    status_callback: Callable[[str], None],
    progress_callback: Callable[[int, int], None] | None = None,
):
    zip_path = Path(zip_path)
    output_txt_path = Path(output_txt_path)

    temp_dir = Path(tempfile.mkdtemp(prefix="ZipToTxt_"))
    try:
        status_callback("正在安全解压 ZIP...")
        safe_extract_zip(zip_path, temp_dir)
        root = find_repository_root(temp_dir)

        status_callback("正在扫描目录...")
        files = sorted(
            [p for p in root.rglob("*") if p.is_file()],
            key=lambda p: p.relative_to(root).as_posix().lower(),
        )
        total = len(files)

        output_txt_path.parent.mkdir(parents=True, exist_ok=True)

        with output_txt_path.open("w", encoding="utf-8", newline="\n") as out:
            out.write("=" * 100 + "\n")
            out.write("REPOSITORY EXPORT\n")
            out.write("=" * 100 + "\n\n")
            out.write(f"SOURCE ZIP: {zip_path.name}\n")
            out.write(f"FILE COUNT: {total}\n")
            out.write(
                f"BINARY MODE: {'BASE64 INCLUDED' if include_binary else 'METADATA ONLY'}\n"
            )

            out.write("\n" + "=" * 100 + "\n")
            out.write("DIRECTORY STRUCTURE\n")
            out.write("=" * 100 + "\n\n")
            out.write("\n".join(build_tree(root)))
            out.write("\n\n" + "=" * 100 + "\n")
            out.write("FILE CONTENTS\n")
            out.write("=" * 100 + "\n")

            for index, path in enumerate(files, start=1):
                relative = path.relative_to(root).as_posix()
                size = path.stat().st_size

                status_callback(f"正在处理 [{index}/{total}] {relative}")
                out.write("\n" + "=" * 100 + "\n")
                out.write(f"FILE: {relative}\n")
                out.write(f"SIZE: {human_size(size)} ({size} bytes)\n")
                out.write(f"SHA-256: {sha256_file(path)}\n")

                if is_binary_file(path):
                    out.write("TYPE: BINARY\n")
                    if include_binary:
                        out.write("ENCODING: BASE64\n")
                        out.write("=" * 100 + "\n")
                        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
                        for start in range(0, len(encoded), 76):
                            out.write(encoded[start:start + 76] + "\n")
                    else:
                        out.write("CONTENT: NOT EMBEDDED (metadata only)\n")
                else:
                    out.write("TYPE: TEXT\n")
                    out.write("=" * 100 + "\n")
                    out.write(read_text_content(path))
                    if not out.name:  # unreachable; keeps no-op out of content logic
                        pass
                    out.write("\n")

                if progress_callback:
                    progress_callback(index, total)

        status_callback(f"完成：共导出 {total} 个文件。")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def normalize_ai_path(raw_path: str) -> str:
    path = raw_path.strip().strip("`").strip()
    path = path.replace("\\", "/")
    path = re.sub(r"^/+", "", path)

    if not path or path in {".", ".."}:
        raise ValueError(f"非法文件路径：{raw_path}")

    pure_parts = [part for part in path.split("/") if part not in ("", ".")]
    if any(part == ".." for part in pure_parts):
        raise ValueError(f"不允许使用 .. 路径：{raw_path}")

    # Windows drive paths and UNC paths are not valid repository-relative paths.
    if re.match(r"^[A-Za-z]:", path) or path.startswith("//"):
        raise ValueError(f"必须使用仓库相对路径：{raw_path}")

    return "/".join(pure_parts)

def parse_ai_blocks(raw_text: str) -> dict[str, str]:
    """
    解析：
    ### FILE: path/to/file.py
    ```python
    ...
    ```
    允许普通的“### FILE:”标记，也允许前导说明文字。
    如果同一路径出现多次，则按出现顺序拼接，方便 continue 分段输出。
    """
    lines = raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    marker = re.compile(r"^\s*(?:#{1,6}\s*)?FILE\s*:\s*(.+?)\s*$", re.IGNORECASE)

    blocks: list[tuple[str, str]] = []
    current_path = None
    collecting = False
    fence_char = None
    buffer: list[str] = []

    def flush():
        nonlocal current_path, collecting, fence_char, buffer
        if current_path is not None:
            blocks.append((current_path, "\n".join(buffer)))
        current_path = None
        collecting = False
        fence_char = None
        buffer = []

    for line in lines:
        if not collecting:
            match = marker.match(line)
            if match:
                if current_path is not None:
                    flush()
                current_path = normalize_ai_path(match.group(1))
                # 支持 FILE 后面直接跟代码，也支持下一行代码 fence。
                collecting = False
                fence_char = None
                buffer = []
                continue

            if current_path is not None:
                # 在 FILE 标记后，等待代码 fence。
                if line.strip().startswith("```"):
                    collecting = True
                    fence_char = "```"
                elif line.strip() == "":
                    continue
                else:
                    # 允许未加 Markdown fence 的连续文本，但要避免把下一个标题吞进去。
                    collecting = True
                    buffer.append(line)
                continue

        else:
            if line.strip().startswith("```"):
                flush()
            else:
                buffer.append(line)

    flush()

    merged: dict[str, str] = {}
    for rel_path, content in blocks:
        if rel_path in merged and merged[rel_path]:
            merged[rel_path] += "\n" + content
        else:
            merged[rel_path] = content

    return merged

def build_ai_patch(raw_text: str) -> dict[str, str]:
    files = parse_ai_blocks(raw_text)
    if not files:
        raise ValueError(
            "没有检测到有效文件块。\n\n"
            "请确保 AI 输出至少包含：\n"
            "### FILE: src/example.py\n"
            "```python\n"
            "完整代码\n"
            "```"
        )
    return files
