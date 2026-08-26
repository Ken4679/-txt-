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
    ".txt", ".md", ".markdown", ".rst", ".py", ".pyw", ".js", ".jsx", ".mjs", ".cjs",
    ".ts", ".tsx", ".java", ".kt", ".kts", ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp",
    ".cs", ".go", ".rs", ".swift", ".m", ".mm", ".php", ".rb", ".lua", ".pl", ".pm",
    ".sh", ".bash", ".zsh", ".fish", ".bat", ".cmd", ".ps1", ".sql", ".html", ".htm",
    ".css", ".scss", ".sass", ".less", ".xml", ".json", ".jsonc", ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".conf", ".properties", ".env", ".gradle", ".cmake",
    ".vue", ".svelte",
}
TEXT_FILENAMES = {
    "Dockerfile", "Makefile", "CMakeLists.txt", "LICENSE", "LICENSE.txt",
    "README", "README.txt", "README.md", ".gitignore", ".gitattributes",
    ".dockerignore", ".editorconfig", ".env",
}
SENSITIVE_FILE_NAMES = {
    ".env", ".env.local", ".env.production", ".env.development",
    "id_rsa", "id_ed25519", "credentials.json", "secrets.json",
}
SENSITIVE_DIR_NAMES = {".git", ".ssh"}

MAX_ZIP_BYTES = 512 * 1024 * 1024
MAX_ZIP_MEMBERS = 10_000
MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024
MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024
MAX_AI_INPUT_BYTES = 25 * 1024 * 1024
MAX_AI_FILES = 2_000
MAX_AI_TOTAL_OUTPUT_BYTES = 100 * 1024 * 1024
MAX_AI_SINGLE_OUTPUT_BYTES = 10 * 1024 * 1024


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
        subprocess.Popen(["open", str(path)], check=False)
    else:
        subprocess.Popen(["xdg-open", str(path)], check=False)


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
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
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


def normalize_ai_path(raw_path: str) -> str:
    path = raw_path.replace("\\", "/").strip().strip("`").strip()
    if not path or "\x00" in path:
        raise ValueError(f"非法文件路径：{raw_path!r}")
    path = re.sub(r"^/+", "", path)
    if re.match(r"^[A-Za-z]:", path) or path.startswith("//"):
        raise ValueError(f"必须使用相对路径：{raw_path}")
    parts = [p for p in path.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts):
        raise ValueError(f"不允许使用 .. 路径：{raw_path}")
    return "/".join(parts)


def _is_zip_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return (mode & 0o170000) == 0o120000


def safe_extract_zip(zip_path: Path, extract_dir: Path):
    zip_path = Path(zip_path)
    extract_dir = Path(extract_dir).resolve()
    size = zip_path.stat().st_size
    if size > MAX_ZIP_BYTES:
        raise ValueError(f"ZIP 文件过大：{human_size(size)}，上限 {human_size(MAX_ZIP_BYTES)}。")

    with zipfile.ZipFile(zip_path, "r") as archive:
        infos = archive.infolist()
        if len(infos) > MAX_ZIP_MEMBERS:
            raise ValueError(f"ZIP 条目过多：{len(infos)}，上限 {MAX_ZIP_MEMBERS}。")

        total = 0
        normalized = []
        for info in infos:
            rel = normalize_ai_path(info.filename)
            if _is_zip_symlink(info):
                raise ValueError(f"ZIP 中禁止包含符号链接：{info.filename}")
            target = (extract_dir / rel).resolve()
            try:
                target.relative_to(extract_dir)
            except ValueError:
                raise ValueError(f"ZIP 中存在非法路径：{info.filename}")
            if not info.is_dir():
                if info.file_size > MAX_ZIP_SINGLE_FILE_BYTES:
                    raise ValueError(f"ZIP 单文件过大：{rel}")
                total += info.file_size
                if total > MAX_ZIP_UNCOMPRESSED_BYTES:
                    raise ValueError(
                        f"ZIP 解压总大小超过 {human_size(MAX_ZIP_UNCOMPRESSED_BYTES)}。"
                    )
            normalized.append((info, rel))

        for info, rel in normalized:
            target = extract_dir / rel
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            written = 0
            with archive.open(info, "r") as source, target.open("wb") as destination:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_ZIP_SINGLE_FILE_BYTES:
                        raise ValueError(f"ZIP 解压时超出单文件限制：{rel}")
                    destination.write(chunk)


def find_repository_root(temp_dir: Path) -> Path:
    entries = list(temp_dir.iterdir())
    return entries[0] if len(entries) == 1 and entries[0].is_dir() else temp_dir


def build_tree(root: Path) -> list[str]:
    lines = [f"{root.name}/"]
    def walk(directory: Path, prefix: str):
        children = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        for index, child in enumerate(children):
            last = index == len(children) - 1
            connector = "└── " if last else "├── "
            next_prefix = prefix + ("    " if last else "│   ")
            lines.append(f"{prefix}{connector}{child.name}{'/' if child.is_dir() else ''}")
            if child.is_dir():
                walk(child, next_prefix)
    walk(root, "")
    return lines


def process_zip_to_txt(zip_path: Path, output_txt_path: Path, include_binary: bool,
                       status_callback: Callable[[str], None],
                       progress_callback: Callable[[int, int], None] | None = None):
    temp_dir = Path(tempfile.mkdtemp(prefix="ZipToTxt_"))
    try:
        status_callback("正在检查并安全解压 ZIP…")
        safe_extract_zip(zip_path, temp_dir)
        root = find_repository_root(temp_dir)
        files = sorted(
            [p for p in root.rglob("*") if p.is_file()],
            key=lambda p: p.relative_to(root).as_posix().lower(),
        )
        total = len(files)
        output_txt_path = Path(output_txt_path)
        output_txt_path.parent.mkdir(parents=True, exist_ok=True)

        with output_txt_path.open("w", encoding="utf-8", newline="\n") as out:
            out.write("=" * 100 + "\nREPOSITORY EXPORT\n" + "=" * 100 + "\n\n")
            out.write(f"SOURCE ZIP: {Path(zip_path).name}\nFILE COUNT: {total}\n")
            out.write(f"BINARY MODE: {'BASE64 INCLUDED' if include_binary else 'METADATA ONLY'}\n")
            out.write("\n" + "=" * 100 + "\nDIRECTORY STRUCTURE\n" + "=" * 100 + "\n\n")
            out.write("\n".join(build_tree(root)))
            out.write("\n\n" + "=" * 100 + "\nFILE CONTENTS\n" + "=" * 100 + "\n")

            for index, path in enumerate(files, start=1):
                relative = path.relative_to(root).as_posix()
                size = path.stat().st_size
                status_callback(f"正在处理 {index}/{total} · {relative}")
                out.write("\n" + "=" * 100 + "\n")
                out.write(f"FILE: {relative}\nSIZE: {human_size(size)} ({size} bytes)\n")
                out.write(f"SHA-256: {sha256_file(path)}\n")
                if is_binary_file(path):
                    out.write("TYPE: BINARY\n")
                    if include_binary:
                        out.write("ENCODING: BASE64\n" + "=" * 100 + "\n")
                        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
                        for start in range(0, len(encoded), 76):
                            out.write(encoded[start:start + 76] + "\n")
                    else:
                        out.write("CONTENT: NOT EMBEDDED (metadata only)\n")
                else:
                    out.write("TYPE: TEXT\n" + "=" * 100 + "\n")
                    out.write(read_text_content(path) + "\n")
                if progress_callback:
                    progress_callback(index, total)
        status_callback(f"完成 · {total} 个文件")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def parse_ai_blocks(raw_text: str) -> dict[str, str]:
    if len(raw_text.encode("utf-8")) > MAX_AI_INPUT_BYTES:
        raise ValueError(f"AI 输出超过 {human_size(MAX_AI_INPUT_BYTES)}，请分段粘贴。")

    lines = raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    marker = re.compile(r"^\s*(?:#{1,6}\s*)?FILE\s*:\s*(.+?)\s*$", re.I)
    fence = re.compile(r"^\s*```(?:[A-Za-z0-9_+.#-]+)?\s*$")
    close = re.compile(r"^\s*```\s*$")
    blocks = []
    current = None
    buffer = []
    waiting = False
    collecting = False

    def flush():
        nonlocal current, buffer, waiting, collecting
        if current is not None:
            content = "\n".join(buffer)
            if len(content.encode("utf-8")) > MAX_AI_SINGLE_OUTPUT_BYTES:
                raise ValueError(f"AI 文件过大：{current}")
            blocks.append((current, content))
        current, buffer, waiting, collecting = None, [], False, False

    for line in lines:
        if not collecting:
            match = marker.match(line)
            if match:
                if current is not None:
                    raise ValueError(f"文件块缺少结束代码围栏：{current}")
                current = normalize_ai_path(match.group(1))
                waiting = True
                continue
            if current is not None and waiting:
                if not line.strip():
                    continue
                if not fence.match(line):
                    raise ValueError(f"文件 {current} 缺少 Markdown code fence。")
                waiting, collecting = False, True
                continue
            continue

        if close.match(line):
            flush()
        else:
            buffer.append(line)

    if current is not None:
        raise ValueError(f"文件块缺少结束代码围栏：{current}")
    if not blocks:
        raise ValueError(
            "没有检测到有效文件块。\n\n格式：\n"
            "### FILE: src/example.py\n```python\n完整代码\n```"
        )

    merged = {}
    total = 0
    for rel, content in blocks:
        merged[rel] = merged.get(rel, "") + (("\n" if merged.get(rel) else "") + content)
        total += len(content.encode("utf-8"))
        if total > MAX_AI_TOTAL_OUTPUT_BYTES:
            raise ValueError(f"AI 输出总大小超过 {human_size(MAX_AI_TOTAL_OUTPUT_BYTES)}。")
    if len(merged) > MAX_AI_FILES:
        raise ValueError(f"AI 输出文件过多：{len(merged)}。")
    return merged


def build_ai_patch(raw_text: str) -> dict[str, str]:
    return parse_ai_blocks(raw_text)


def is_sensitive_path(rel_path: str) -> bool:
    parts = normalize_ai_path(rel_path).split("/")
    if any(p.lower() in SENSITIVE_DIR_NAMES for p in parts):
        return True
    name = parts[-1].lower()
    return name in {x.lower() for x in SENSITIVE_FILE_NAMES} or name.startswith(".env.")


def existing_sensitive_files(files: dict[str, str], target_dir: Path) -> list[str]:
    target = Path(target_dir).resolve()
    return [rel for rel in files if is_sensitive_path(rel) and (target / rel).exists()]


def write_ai_files(files: dict[str, str], target_dir: Path, *, allow_sensitive=False,
                   overwrite=True) -> int:
    target_root = Path(target_dir).resolve()
    target_root.mkdir(parents=True, exist_ok=True)
    for rel_path, content in files.items():
        rel_path = normalize_ai_path(rel_path)
        if is_sensitive_path(rel_path) and not allow_sensitive:
            raise ValueError(f"检测到受保护文件：{rel_path}")
        if len(content.encode("utf-8")) > MAX_AI_SINGLE_OUTPUT_BYTES:
            raise ValueError(f"文件过大：{rel_path}")
        full = (target_root / rel_path).resolve()
        try:
            full.relative_to(target_root)
        except ValueError:
            raise ValueError(f"非法文件路径：{rel_path}")
        current = target_root
        for part in rel_path.split("/"):
            current /= part
            if current.exists() and current.is_symlink():
                raise ValueError(f"拒绝写入符号链接路径：{rel_path}")
        if full.exists() and not overwrite:
            raise FileExistsError(f"文件已存在：{rel_path}")
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8", newline="\n")
    return len(files)


def create_patch_zip(files: dict[str, str], zip_path: Path) -> int:
    temp_dir = Path(tempfile.mkdtemp(prefix="ZipToTxt_patch_"))
    try:
        count = write_ai_files(files, temp_dir, allow_sensitive=True)
        zip_path = Path(zip_path)
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in temp_dir.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(temp_dir).as_posix())
        return count
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
