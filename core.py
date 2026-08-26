# Core processing module for ZipToTxt (Enhanced with Security & High Fault-Tolerance)
import os
import re
import urllib.parse
from typing import Dict, List, Tuple, Optional, Set

MAX_ZIP_BYTES = 512 * 1024 * 1024
MAX_ZIP_MEMBERS = 15_000
MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024
MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024
MAX_AI_INPUT_BYTES = 35 * 1024 * 1024
MAX_AI_FILES = 3_000
MAX_AI_TOTAL_OUTPUT_BYTES = 120 * 1024 * 1024
MAX_AI_SINGLE_OUTPUT_BYTES = 15 * 1024 * 1024

SENSITIVE_DIR_NAMES = {'.git', '.ssh', '.aws', '.kube', '.gnupg', '.docker', '.subversion', '.gem'}
SENSITIVE_FILE_NAMES = {
    '.env', '.env.local', '.env.production', '.env.development', '.env.test', '.env.staging',
    'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'id_rsa.pub',
    'credentials.json', 'secrets.json', 'service-account.json', 'service_account.json', 'auth.json',
    '.npmrc', '.pypirc', '.netrc', '.htpasswd', '.dockercfg', 'config.json',
    'keystore.jks', 'master.key', 'client_secret.json', 'firebase-adminsdk.json'
}

WINDOWS_RESERVED_NAMES = {
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
}

TEXT_EXTENSIONS = {
    '.txt', '.md', '.markdown', '.rst', '.py', '.pyw', '.js', '.jsx', '.mjs', '.cjs',
    '.ts', '.tsx', '.java', '.kt', '.kts', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp',
    '.cs', '.go', '.rs', '.swift', '.m', '.mm', '.php', '.rb', '.lua', '.pl', '.pm',
    '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.sql', '.html', '.htm',
    '.css', '.scss', '.sass', '.less', '.xml', '.json', '.jsonc', '.yaml', '.yml',
    '.toml', '.ini', '.cfg', '.conf', '.properties', '.env', '.gradle', '.cmake',
    '.vue', '.svelte', '.astro', '.sol', '.proto', '.graphql', '.gql', '.tf', '.hcl',
    '.r', '.dart', '.scala', '.erl', '.ex', '.exs', '.clj', '.cljs', '.edn'
}

TEXT_FILENAMES = {
    'Dockerfile', 'Makefile', 'CMakeLists.txt', 'LICENSE', 'LICENSE.txt', 'LICENSE.md',
    'README', 'README.txt', 'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
    '.gitignore', '.gitattributes', '.gitmodules', '.gitlab-ci.yml', '.gitpod.yml',
    '.dockerignore', '.editorconfig', '.env', '.prettierrc', '.eslintrc', '.eslintignore',
    'CODEOWNERS', 'FUNDING.yml', 'dependabot.yml', 'action.yml', 'action.yaml',
    'pom.xml', 'build.gradle', 'package.json', 'tsconfig.json', 'Cargo.toml', 'Cargo.lock',
    'go.mod', 'go.sum', 'requirements.txt', 'pyproject.toml', 'Gemfile', 'Gemfile.lock',
    'Pipfile', 'Pipfile.lock', 'yarn.lock', 'pnpm-lock.yaml', 'package-lock.json',
    'Procfile', 'CNAME', 'docker-compose.yml', 'docker-compose.yaml', 'nginx.conf'
}

def human_size(value: int) -> str:
    size = float(value)
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0 or unit == 'TB':
            return f"{int(size)} B" if unit == 'B' else f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

def is_text_file(filename: str) -> bool:
    base = os.path.basename(filename)
    if base in TEXT_FILENAMES:
        return True
    _, ext = os.path.splitext(filename)
    return ext.lower() in TEXT_EXTENSIONS


def normalize_ai_path(raw_path: str) -> str:
    if not raw_path:
        raise ValueError("文件路径不能为空")

    # Strip dangerous zero-width, bidi, and null characters
    clean = re.sub(r'[\u0000\u200B-\u200F\u202A-\u202E\uFEFF]', '', raw_path).strip()

    # URL decode checks
    if '%' in clean:
        try:
            clean = urllib.parse.unquote(clean)
        except Exception:
            pass

    path = clean.replace('\\', '/').strip().strip('`"\'*#').strip()
    if not path or '\0' in path:
        raise ValueError(f"非法文件路径: {raw_path!r}")

    path = path.lstrip('/')
    if re.match(r'^[A-Za-z]:', path) or path.startswith('//') or path.startswith('\\\\'):
        raise ValueError(f"必须使用相对路径: {raw_path!r}")

    parts = [p for p in path.split('/') if p and p != '.']
    if not parts or any(p == '..' or p == '%2e%2e' for p in parts):
        raise ValueError(f"不允许路径穿越: {raw_path!r}")

    for part in parts:
        base = part.split('.')[0].upper()
        if base in WINDOWS_RESERVED_NAMES:
            raise ValueError(f"禁止使用 Windows 保留设备名: {part}")

    return '/'.join(parts)

def is_sensitive_path(rel_path: str) -> bool:
    try:
        norm = normalize_ai_path(rel_path)
        parts = norm.split('/')
        if any(p.lower() in SENSITIVE_DIR_NAMES for p in parts):
            return True
        name = parts[-1].lower()
        if name in SENSITIVE_FILE_NAMES or name.startswith('.env.'):
            return True
        if name.endswith(('.pem', '.key', '.pfx', '.p12')) or 'id_rsa' in name or 'id_ed25519' in name:
            return True
        return False
    except Exception:
        return True

def parse_ai_blocks(raw_text: str) -> Dict[str, str]:
    if len(raw_text.encode('utf-8')) > MAX_AI_INPUT_BYTES:
        raise ValueError(f"AI 输入超过 {human_size(MAX_AI_INPUT_BYTES)}")

    lines = raw_text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    marker_patterns = [
        re.compile(r'^\s*(?:#{1,6}\s*)?FILE\s*:\s*[`"\'*]?(.+?)[`"\'*]?\s*$', re.IGNORECASE),
        re.compile(r'^\s*\*\*(?:FILE|File|FilePath)\s*:\s*\*\*\s*[`"\'*]?(.+?)[`"\'*]?\s*$', re.IGNORECASE),
        re.compile(r'^\s*\*\*(?:FILE|File|FilePath)\s*:\s*[`"\'*]?(.+?)[`"\'*]?\*\*\s*$', re.IGNORECASE),
        re.compile(r'^\s*(?://|/\*|<!--|#)\s*FILE\s*:\s*[`"\'*]?(.+?)[`"\'*]?(?:\s*\*\/|\s*-->)?\s*$', re.IGNORECASE),
        re.compile(r'^\s*\[\s*FILE(?:\s*:)?\s*[`"\'*]?(.+?)[`"\'*]?\s*\]\s*$', re.IGNORECASE),
    ]

    inline_fence = re.compile(r'^\s*```(?:[A-Za-z0-9_+.#-]+)?(?:\s+|:)(?:file=|path=)?["\'`]?([A-Za-z0-9_./\\-]+)["\'`]?\s*$', re.IGNORECASE)
    fence = re.compile(r'^\s*```(?:[A-Za-z0-9_+.#-]+)?\s*$')
    close = re.compile(r'^\s*```\s*$')

    blocks: List[Tuple[str, str]] = []
    current: Optional[str] = None
    buffer: List[str] = []
    in_block = False

    def flush():
        nonlocal current, buffer, in_block
        if current is not None:
            content = '\n'.join(buffer)
            if len(content.encode('utf-8')) > MAX_AI_SINGLE_OUTPUT_BYTES:
                raise ValueError(f"AI 单文件过大: {current}")
            blocks.append((current, content))
        current = None
        buffer = []
        in_block = False

    for line in lines:
        if not in_block:
            # Inline fence check
            m_inline = inline_fence.match(line)
            if m_inline and '.' in m_inline.group(1):
                try:
                    current = normalize_ai_path(m_inline.group(1))
                    in_block = True
                    continue
                except Exception:
                    pass

            # Header marker check
            matched_candidate = None
            for p in marker_patterns:
                m = p.match(line)
                if m and m.group(1):
                    cand = m.group(1).strip()
                    if cand and not cand.startswith('http'):
                        try:
                            matched_candidate = normalize_ai_path(cand)
                            break
                        except Exception:
                            pass

            if matched_candidate:
                current = matched_candidate
                continue

            if current is not None:
                if fence.match(line):
                    in_block = True
                    continue
                # Skip chatty lines
                continue
            continue

        if close.match(line):
            flush()
        else:
            buffer.append(line)

    # Auto-close trailing unclosed fence if present
    if in_block and current is not None:
        flush()

    if not blocks:
        raise ValueError("未识别到任何有效文件块。格式: ### FILE: path\\n```lang\\ncode\\n```")

    merged: Dict[str, str] = {}
    for path, content in blocks:
        if path in merged:
            merged[path] = merged[path] + '\n' + content
        else:
            merged[path] = content

    return merged
