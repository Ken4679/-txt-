# Core processing module for ZipToTxt (Enhanced with Security & High Fault-Tolerance)
import os
import re
import io
import sys
import base64
import zipfile
import tempfile
import urllib.parse
import hashlib
from typing import Dict, List, Tuple, Optional, Set, Any

# Security Thresholds
MAX_ZIP_BYTES = 512 * 1024 * 1024
MAX_ZIP_MEMBERS = 15_000
MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024
MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024
MAX_AI_INPUT_BYTES = 35 * 1024 * 1024
MAX_AI_FILES = 3_000
MAX_AI_TOTAL_OUTPUT_BYTES = 120 * 1024 * 1024
MAX_AI_SINGLE_OUTPUT_BYTES = 15 * 1024 * 1024

class SecurityError(Exception):
    pass

class ZipSecurityConfig:
    def __init__(self, max_zip_bytes=MAX_ZIP_BYTES, max_members=MAX_ZIP_MEMBERS,
                 max_uncompressed_bytes=MAX_ZIP_UNCOMPRESSED_BYTES,
                 max_single_file_bytes=MAX_ZIP_SINGLE_FILE_BYTES):
        self.max_zip_bytes = max_zip_bytes
        self.max_members = max_members
        self.max_uncompressed_bytes = max_uncompressed_bytes
        self.max_single_file_bytes = max_single_file_bytes

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

# ====================== Prompt 模板（使用三单引号，防止内部双引号干扰） ======================
AI_PRIMARY_PROMPT = '''I am sharing a complete source-code repository exported into a TXT file.

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
6. If a file is long, continue in multiple messages without omitting content.
'''

AI_CONTINUE_PROMPT = '''Continue exactly where your previous response stopped.
Do not restart completed files. Do not summarize or explain. Output remaining complete source code files only.
Format:
### FILE: relative/path/to/file.ext
```language
complete file content
```'''

AI_AUDIT_PROMPT_CN = '''你是一名兼具【顶级软件架构师】、【首席安全审计专家】与【生产交付负责人】三重身份的技术权威。你正在审计一份通过 TXT 格式全量导出的代码仓库。
该项目包含 AI 辅助敏捷编程产物，请以严苛的【工业级生产上线（Zero-Bug & High-Reliability）】标准进行端到端全方位深度审计，并针对所有瑕疵直接输出【100% 完整、可直接打补丁替换上线的生产级源代码】。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【审计维度与检查矩阵】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 架构严谨性与代码异味 (Architecture & Code Smells)：
   - 依赖边界：排查模块循环引用、上帝类/过度膨胀函数、单一职责原则（SRP）。
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
- 提供 3-5 步清晰的验证步骤或单元测试建议，确保修复后无任何功能破坏或回归。'''

AI_AUDIT_PROMPT_EN = '''You are a Principal Software Architect, Lead Security Auditor, and Production Release Gatekeeper auditing a complete repository exported in TXT format.
Your objective: Audit this entire codebase against rigorous, enterprise-grade production reliability standards and provide 100% complete, drop-in replacement remediation code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【AUDIT METHODOLOGY & SCOPE】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ARCHITECTURE & CODE SMELLS:
   - Modularity: Eliminate tight coupling, circular dependencies, God-objects, and SRP violations.
   - State & Concurrency: Spot race conditions, desynchronized states, unhandled side-effects, and unreachable code.
2. FUNCTIONAL RESILIENCE & DEFENSIVE PROGRAMMING:
   - Exception Handling: Eliminate swallowed errors (empty catch blocks), unhandled promise rejections, unchecked external payloads.
   - Boundary Defense: Handle null/undefined destructuring, edge inputs, offline reconnection, network retry idempotency.
   - Resource Safety: Prevent unclosed sockets/file descriptors, lingering intervals/listeners, database connection leaks, and memory retention.
3. ENTERPRISE SECURITY & OWASP TOP 10 HARDENING:
   - Injection vectors: SQLi, command injection (exec/eval/system), stored/reflected XSS, SSRF.
   - Filesystem Safety: Zip Slip / path traversal escapes, dangerous file extensions, ReDoS regexes.
   - Access & Credentials: Strip hardcoded secrets/keys, patch authorization bypasses (IDOR), verify CORS/CSP policies.
4. OBSERVABILITY & RESILIENCE:
   - Request timeouts, backoff/jitter retries, throttling/debouncing, and structured diagnostic logging.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【STRICT OUTPUT FORMAT】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Structure your response into the following 4 sections:

### 01. Production Readiness Verdict
- Output explicit status: [READY FOR PROD] / [CONDITIONAL - FIXES REQUIRED] / [BLOCKED]
- Provide a concise executive rationale.

### 02. Critical Defect Matrix (Categorized by P0, P1, P2)
- [Severity] File Path:Function Name
  - Root Cause: ...
  - Impact & Trigger Condition: ...
  - Remediation Approach: ...

### 03. Actionable Production-Ready Replacement Code
★ STRICT RULE: For every modified file, output the 100% COMPLETE, production-hardened source code! NEVER truncate or use placeholders like "// keep existing logic" or "...".
★ You MUST strictly format each file block for ZipToTxt compatibility:
### FILE: relative/path/to/file.ext
```language
// Complete, fully refactored, hardened production code
```

### 04. Deployment & Smoke Test Checklist
- Provide 3-5 concrete verification steps/commands to ensure zero regressions after applying the patch.'''

# ============================
# 核心功能函数
# ============================

def normalize_ai_path(raw_path: str) -> str:
    if not raw_path or not isinstance(raw_path, str):
        raise SecurityError("文件路径不能为空")
    path = re.sub(r'[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]', '', raw_path).strip()
    decoded = path
    for _ in range(3):
        if re.search(r'%[0-9a-fA-F]{2}', decoded):
            try:
                nxt = urllib.parse.unquote(decoded)
                if nxt == decoded:
                    break
                decoded = nxt
            except:
                break
        else:
            break
    path = decoded
    path = path.replace('\\', '/').strip()
    path = re.sub(r'^[`"\'*\s#]+|[`"\'*\s#]+$', '', path)
    if not path:
        raise SecurityError(f"非法空文件路径: {raw_path}")
    path = re.sub(r'^/+', '', path)
    if re.match(r'^[A-Za-z]:', path) or path.startswith('//') or path.startswith('\\\\'):
        raise SecurityError(f"禁止绝对路径或网络路径: {raw_path}")
    parts = [p for p in path.split('/') if p and p != '.']
    for part in parts:
        if part == '..' or part.lower() == '%2e%2e' or '..' in part:
            raise SecurityError(f"检测到路径穿越 (Zip Slip): {raw_path}")
        base = part.split('.')[0].upper()
        if base in WINDOWS_RESERVED_NAMES:
            raise SecurityError(f"禁止系统保留设备名: {part} ({raw_path})")
    return '/'.join(parts)

def is_safe_relative_path(path: str) -> bool:
    try:
        normalize_ai_path(path)
        return True
    except SecurityError:
        return False

def is_sensitive_path(rel_path: str) -> bool:
    try:
        norm = normalize_ai_path(rel_path)
        parts = norm.split('/')
        if any(p in SENSITIVE_DIR_NAMES for p in parts):
            return True
        fname = parts[-1].lower()
        if fname in SENSITIVE_FILE_NAMES:
            return True
        if (fname.startswith('.env') or
            fname.endswith(('.pem', '.key', '.pfx', '.p12')) or
            'id_rsa' in fname or 'id_ed25519' in fname or
            'service_account' in fname or 'service-account' in fname):
            return True
        return False
    except:
        return True

def is_text_file(filename: str, sample_bytes: Optional[bytes] = None) -> bool:
    name = os.path.basename(filename)
    ext = os.path.splitext(name)[1].lower()
    if name in TEXT_FILENAMES or ext in TEXT_EXTENSIONS:
        return True
    if sample_bytes is None:
        return False
    if b'\x00' in sample_bytes:
        return False
    try:
        sample_bytes.decode('utf-8')
        return True
    except UnicodeDecodeError:
        try:
            sample_bytes.decode('gb18030')
            return True
        except:
            return False

def estimate_tokens(text: str) -> int:
    return len(text) // 4 + 1

def human_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    for unit in ('KB', 'MB', 'GB', 'TB'):
        size /= 1024.0
        if size < 1024:
            return f"{size:.1f} {unit}"
    return f"{size:.1f} PB"

def safe_extract_zip(zip_path: str, target_dir: str, config: Optional[ZipSecurityConfig] = None) -> Tuple[str, List[str]]:
    if config is None:
        config = ZipSecurityConfig()
    if os.path.getsize(zip_path) > config.max_zip_bytes:
        raise SecurityError(f"ZIP体积 {human_size(os.path.getsize(zip_path))} 超过限制 {human_size(config.max_zip_bytes)}")
    extracted_files = []
    with zipfile.ZipFile(zip_path, 'r') as zf:
        members = zf.infolist()
        if len(members) > config.max_members:
            raise SecurityError(f"条目数 {len(members)} 超过上限 {config.max_members}")
        total_uncompressed = 0
        for m in members:
            if m.is_dir():
                continue
            if m.external_attr & 0xF000 == 0xA000:
                raise SecurityError(f"符号链接被拦截: {m.filename}")
            norm = normalize_ai_path(m.filename)
            if m.file_size > config.max_single_file_bytes:
                raise SecurityError(f"单文件过大: {m.filename} ({human_size(m.file_size)})")
            total_uncompressed += m.file_size
            if total_uncompressed > config.max_uncompressed_bytes:
                raise SecurityError(f"解压总量 {human_size(total_uncompressed)} 超过上限 {human_size(config.max_uncompressed_bytes)}")
            target_path = os.path.join(target_dir, norm)
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with open(target_path, 'wb') as f:
                f.write(zf.read(m))
            extracted_files.append(norm)
    return target_dir, extracted_files

def get_file_language(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    mapping = {
        '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
        '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp',
        '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby',
        '.sh': 'bash', '.bat': 'batch', '.ps1': 'powershell',
        '.html': 'html', '.css': 'css', '.scss': 'scss', '.json': 'json',
        '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml', '.sql': 'sql',
        '.md': 'markdown', '.txt': 'text'
    }
    return mapping.get(ext, 'text')

def scan_and_format_repo(directory: str, base64_binaries: bool = False, exclude_patterns: List[str] = None) -> Tuple[str, List[Dict]]:
    exclude_patterns = exclude_patterns or []
    files_info = []
    txt_parts = []
    for root, dirs, files in os.walk(directory):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), directory).replace('\\', '/')
            if any(re.search(p, rel) for p in exclude_patterns):
                continue
            full = os.path.join(root, f)
            size = os.path.getsize(full)
            with open(full, 'rb') as fp:
                data = fp.read()
            is_text = is_text_file(f, data[:8192])
            sha256 = hashlib.sha256(data).hexdigest()
            info = {'path': rel, 'size': size, 'is_text': is_text, 'sha256': sha256, 'lines': 0}
            if is_text:
                try:
                    content = data.decode('utf-8', errors='replace')
                except:
                    content = data.decode('gb18030', errors='replace')
                info['lines'] = len(content.splitlines())
                txt_parts.append(f"### FILE: {rel}")
                txt_parts.append(f"```{get_file_language(rel)}")
                txt_parts.append(content)
                txt_parts.append("```\n")
            else:
                if base64_binaries:
                    b64 = base64.b64encode(data).decode()
                    txt_parts.append(f"### FILE: {rel} [BASE64_BINARY]")
                    txt_parts.append("```base64")
                    txt_parts.append(b64)
                    txt_parts.append("```\n")
                else:
                    txt_parts.append(f"### FILE: {rel} [BINARY FILE: {human_size(size)}, SHA-256: {sha256}]\n")
            files_info.append(info)
    return "\n".join(txt_parts), files_info

def generate_ascii_tree(directory: str, exclude_patterns: List[str] = None) -> str:
    exclude_patterns = exclude_patterns or []
    lines = []
    root_name = os.path.basename(directory) or 'repo'
    lines.append(f"{root_name}/")
    def walk(dir_path, prefix):
        items = sorted(os.listdir(dir_path))
        items = [i for i in items if not any(re.search(p, i) for p in exclude_patterns)]
        for idx, name in enumerate(items):
            full = os.path.join(dir_path, name)
            is_last = (idx == len(items) - 1)
            connector = "└── " if is_last else "├── "
            lines.append(f"{prefix}{connector}{name}{'/' if os.path.isdir(full) else ''}")
            if os.path.isdir(full):
                next_prefix = prefix + ("    " if is_last else "│   ")
                walk(full, next_prefix)
    walk(directory, "")
    return "\n".join(lines)

def assemble_prompt(prompt_template: str, user_requirement: str, repo_txt: str) -> str:
    if user_requirement:
        prompt_template = re.sub(r'\[DESCRIBE YOUR REQUIREMENT HERE\]', user_requirement, prompt_template, flags=re.I)
        prompt_template = re.sub(r'\[在此详细描述您的业务需求.*?\]', user_requirement, prompt_template, flags=re.I)
    return prompt_template + "\n\n" + repo_txt

def parse_ai_output(markdown_text: str) -> Dict[str, Dict[str, str]]:
    blocks = re.findall(r'###\s*FILE:\s*(.+?)\n```(?:\w+)?\n(.*?)```', markdown_text, re.DOTALL)
    files = {}
    for path, content in blocks:
        path = normalize_ai_path(path.strip())
        files[path] = content.strip()
    return {'files': files}

def create_patch_zip(files_dict: Dict[str, str], output_path: str) -> None:
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for rel_path, content in files_dict.items():
            zf.writestr(rel_path, content)

def write_parsed_files_to_dir(files_dict: Dict[str, str], target_dir: str) -> None:
    for rel_path, content in files_dict.items():
        norm = normalize_ai_path(rel_path)
        target_path = os.path.join(target_dir, norm)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(content)
