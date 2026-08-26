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

AI_PRIMARY_PROMPT = """I am sharing a complete source-code repository exported into a TXT file.

Please implement this requirement:
[DESCRIBE YOUR REQUIREMENT HERE]

Rules:
1. Preserve the existing architecture unless necessary.
2. Only return files you modified or created.
3. For every changed file use exactly:
### FILE: relative/path/to/file.ext
```language
complete file content
```
4. Always return complete file content. Never use placeholders (e.g. do not use "...keep existing code...").
5. Preserve repository-relative paths.
6. If a file is long, continue in multiple messages without omitting content."""

AI_CONTINUE_PROMPT = """Continue exactly where your previous response stopped.
Do not restart completed files. Do not summarize. Output remaining complete source code only.
Use:
### FILE: relative/path/to/file.ext
```language
complete file content
```"""

AI_AUDIT_PROMPT_CN = """你是一名兼具【顶级软件架构师】、【首席安全审计专家】与【生产交付负责人】三重身份的技术权威。你正在审计一份通过 TXT 格式全量导出的代码仓库。
该项目为 AI 辅助敏捷编程（Vibe Coding）产物，尽管功能逻辑貌似闭环，但由于大模型概率采样特性，极大概率潜藏【架构坏味道】、【静默异常】、【资源泄漏】与【致命安全漏洞】。

你的唯一使命：以严苛的【工业级生产上线（Zero-Bug & High-Reliability）】标准进行端到端全方位深度审计，并针对所有瑕疵直接输出【100% 完整、可直接打补丁替换上线的生产级源代码】。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【审计维度与检查矩阵】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 架构严谨性与高内聚低耦合 (Architecture & Code Smells)：
   - 依赖边界：排查模块交叉依赖、循环引用、上帝类/过度膨胀函数，检查单一职责原则（SRP）。
   - 数据流与状态：排查竞态条件（Race Conditions）、状态失真、未清理的全局副作用、不可达死代码。
2. 功能完备性与防御性编码 (Completeness & Edge Cases)：
   - 异常处理：彻底排查静默吞异常（空的 catch 块）、未捕获的异步 Promise rejection、未校验的 API 返回格式。
   - 边界极限：排查 Null/Undefined 解构崩溃、空数组/超大集合、网络断连重试、并发请求幂等性。
   - 资源管理：排查未释放的定时器（setInterval）、未注销的 EventListener、未断开的 WebSockets/DB 连接池及内存堆积。
3. 生产级安全加固 (Security Hardening & OWASP Top 10)：
   - 注入防御：SQL注入、命令执行（exec/eval/spawn）、XSS、SSRF、模版注入。
   - 路径与文件安全：Zip Slip 路径逃逸、绝对路径覆盖、危险后缀上传、ReDoS 正则拒绝服务。
   - 凭据与鉴权：硬编码 Secret/Token/Private Key、越权漏洞（IDOR）、缺失 CORS/CSP 与安全 Header。
4. 生产可用性与可观测性 (Resilience & Observability)：
   - 超时与熔断保护、高频请求防抖节流（Debounce/Throttle）、关键链路结构化日志输出。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【输出格式严格规范】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
你必须按以下四部分严格结构化输出：

### 01. 生产就绪度判定 (Production Readiness Verdict)
- 给出明确结论：【可直接上线】 / 【需修复后上线 (Conditional)】 / 【严禁上线 (Blocked)】
- 给出 1-2 句核心理由。

### 02. 严重缺陷矩阵 (Critical Defect Matrix)
按优先级列出（P0 致命阻断, P1 高风险, P2 中等瑕疵）：
- [缺陷级别] 文件路径:函数名
  - 根因分析：...
  - 潜在危害与触发场景：...
  - 修复策略：...

### 03. 可直接投产的完整代码修复 (Production-Ready Code Patch)
★ 黄金法则：针对每一个需要修改的文件，输出 100% 完整的源代码！绝对严禁使用 “// ... 保留其他原代码” 或省略号！
★ 格式必须严格遵循 ZipToTxt 解析器标准：
### FILE: 文件的相对路径
```编程语言
// 完整的、经过工业级加固后的源码
```

### 04. 部署与冒烟测试清单 (Smoke Test Checklist)
- 提供 3-5 步清晰的验证步骤或单元测试建议，确保修复后无任何功能破坏或回归。"""

AI_REVIEW_PROMPT = AI_AUDIT_PROMPT_CN

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
