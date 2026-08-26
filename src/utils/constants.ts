export const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.rst', '.py', '.pyw', '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx', '.java', '.kt', '.kts', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp',
  '.cs', '.go', '.rs', '.swift', '.m', '.mm', '.php', '.rb', '.lua', '.pl', '.pm',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.sql', '.html', '.htm',
  '.css', '.scss', '.sass', '.less', '.xml', '.json', '.jsonc', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.properties', '.env', '.gradle', '.cmake',
  '.vue', '.svelte', '.astro', '.sol', '.proto', '.graphql', '.gql', '.tf', '.hcl',
  '.r', '.dart', '.scala', '.erl', '.ex', '.exs', '.clj', '.cljs', '.edn'
]);

export const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'CMakeLists.txt', 'LICENSE', 'LICENSE.txt', 'LICENSE.md',
  'README', 'README.txt', 'README.md', '.gitignore', '.gitattributes',
  '.dockerignore', '.editorconfig', '.env', '.prettierrc', '.eslintrc',
  'pom.xml', 'build.gradle', 'package.json', 'tsconfig.json', 'Cargo.toml',
  'go.mod', 'go.sum', 'requirements.txt', 'pyproject.toml', 'Gemfile'
]);

export const SENSITIVE_FILE_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development', '.env.test', '.env.staging',
  'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'id_rsa.pub',
  'credentials.json', 'secrets.json', 'service-account.json', 'service_account.json', 'auth.json',
  '.npmrc', '.pypirc', '.netrc', '.htpasswd', '.dockercfg', 'config.json',
  'keystore.jks', 'master.key', 'client_secret.json', 'firebase-adminsdk.json'
]);

export const SENSITIVE_DIR_NAMES = new Set([
  '.git', '.ssh', '.aws', '.kube', '.gnupg', '.docker', '.subversion', '.gem'
]);

export const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

export const IGNORED_METADATA_FILES = new Set([
  '__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.Spotlight-V100', '.Trashes'
]);

export const COMMON_IGNORE_FOLDERS = [
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
];

export const MAX_ZIP_BYTES = 512 * 1024 * 1024; // 512 MB
export const MAX_ZIP_MEMBERS = 15_000;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
export const MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024; // 256 MB
export const MAX_AI_INPUT_BYTES = 35 * 1024 * 1024; // 35 MB
export const MAX_AI_FILES = 3_000;
export const MAX_AI_TOTAL_OUTPUT_BYTES = 120 * 1024 * 1024; // 120 MB
export const MAX_AI_SINGLE_OUTPUT_BYTES = 15 * 1024 * 1024; // 15 MB

export const AI_PRIMARY_PROMPT = `I am sharing a complete source-code repository exported into a TXT file.

Please implement this requirement:
[DESCRIBE YOUR REQUIREMENT HERE]

Rules:
1. Preserve the existing architecture unless necessary.
2. Only return files you modified or created.
3. For every changed file use exactly:
### FILE: relative/path/to/file.ext
\`\`\`language
complete file content
\`\`\`
4. Always return complete file content. Never use placeholders (e.g. do not use "...keep existing code...").
5. Preserve repository-relative paths.
6. If a file is long, continue in multiple messages without omitting content.`;

export const AI_CONTINUE_PROMPT = `Continue exactly where your previous response stopped.
Do not restart completed files. Do not summarize. Output remaining complete source code only.
Use:
### FILE: relative/path/to/file.ext
\`\`\`language
complete file content
\`\`\``;

export const DEFAULT_PROMPTS = {
  primary: AI_PRIMARY_PROMPT,
  continue: AI_CONTINUE_PROMPT,
  audit_cn: `你是一名兼具【顶级软件架构师】、【首席安全审计专家】与【生产交付负责人】三重身份的技术权威。你正在审计一份通过 TXT 格式全量导出的代码仓库。
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
\`\`\`编程语言
// 完整的、经过工业级加固后的源码
\`\`\`

### 04. 部署与冒烟测试清单 (Smoke Test Checklist)
- 提供 3-5 步清晰的验证步骤或单元测试建议，确保修复后无任何功能破坏或回归。`,
  audit_en: `You are a Principal Software Architect, Lead Security Auditor, and Production Release Gatekeeper auditing a complete repository exported in TXT format.
The codebase originates from AI rapid prototyping ("vibecoding"). While ostensibly functional, stochastic generation frequently leaves hidden architectural rot, resource leaks, race conditions, and critical security vulnerabilities.

Your absolute objective: Audit this entire codebase against rigorous, enterprise-grade production reliability standards and provide 100% complete, drop-in replacement remediation code.

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
\`\`\`language
// Complete, fully refactored, hardened production code
\`\`\`

### 04. Deployment & Smoke Test Checklist
- Provide 3-5 concrete verification steps/commands to ensure zero regressions after applying the patch.`
};

export const AI_AUDIT_PROMPT_CN = DEFAULT_PROMPTS.audit_cn;
export const AI_AUDIT_PROMPT_EN = DEFAULT_PROMPTS.audit_en;
export const AI_REVIEW_PROMPT = AI_AUDIT_PROMPT_CN;

