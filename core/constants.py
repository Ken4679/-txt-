# -*- coding: utf-8 -*-
"""
Constants and limits for ZipToTxt security and processing engine.
"""

# Security Thresholds
MAX_ZIP_BYTES = 512 * 1024 * 1024               # 512 MB input zip limit
MAX_ZIP_MEMBERS = 15_000                         # 15,000 files limit
MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024 # 1.0 GB total uncompressed limit
MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024    # 256 MB single file limit
MAX_AI_INPUT_BYTES = 35 * 1024 * 1024            # 35 MB input markdown limit
MAX_AI_FILES = 3_000                             # 3,000 parsed files limit
MAX_AI_TOTAL_OUTPUT_BYTES = 120 * 1024 * 1024    # 120 MB total parsed output limit
MAX_AI_SINGLE_OUTPUT_BYTES = 15 * 1024 * 1024    # 15 MB single parsed output limit

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

IGNORED_METADATA_FILES = {
    '__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.Spotlight-V100', '.Trashes'
}

COMMON_IGNORE_FOLDERS = [
    'node_modules',
    '.git',
    '.venv',
    'venv',
    '__pycache__',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'target',
    'coverage',
    '.cache'
]

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
请以严苛的【工业级生产上线（Zero-Bug & High-Reliability）】标准进行端到端全方位深度审计，并针对所有瑕疵直接输出【100% 完整、可直接打补丁替换上线的生产级源代码】。

【输出格式严格规范】
1. 生产就绪度判定 (Production Readiness Verdict)
2. 严重缺陷矩阵 (Critical Defect Matrix)
3. 可直接投产的完整代码修复 (Production-Ready Code Patch):
### FILE: 文件的相对路径
```编程语言
// 完整的、经过工业级加固后的源码
```
4. 部署与冒烟测试清单 (Smoke Test Checklist)"""

AI_AUDIT_PROMPT_EN = """You are a Principal Software Architect and Lead Security Auditor auditing a complete repository exported in TXT format.
Audit this entire codebase against rigorous enterprise-grade production reliability standards and provide 100% complete, drop-in replacement remediation code.

Format:
### FILE: relative/path/to/file.ext
```language
// Complete, fully refactored, hardened production code
```"""

AI_REVIEW_PROMPT = AI_AUDIT_PROMPT_CN
