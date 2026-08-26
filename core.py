# Core processing module for ZipToTxt (Enhanced with Security & High Fault-Tolerance)
import os
import re
import io
import sys
import base64
import zipfile
import tempfile
import urllib.parse
from typing import Dict, List, Tuple, Optional, Set, Any

# Security Thresholds
MAX_ZIP_BYTES = 512 * 1024 * 1024               # 512 MB input zip limit
MAX_ZIP_MEMBERS = 15_000                         # 15,000 files limit
MAX_ZIP_UNCOMPRESSED_BYTES = 1 * 1024 * 1024 * 1024 # 1.0 GB total uncompressed limit
MAX_ZIP_SINGLE_FILE_BYTES = 256 * 1024 * 1024    # 256 MB single file limit
MAX_AI_INPUT_BYTES = 35 * 1024 * 1024            # 35 MB input markdown limit
MAX_AI_FILES = 3_000                             # 3,000 parsed files limit
MAX_AI_TOTAL_OUTPUT_BYTES = 120 * 1024 * 1024    # 120 MB total parsed output limit
MAX_AI_SINGLE_OUTPUT_BYTES = 15 * 1024 * 1024    # 15 MB single parsed output limit

class SecurityError(Exception):
    """Raised when security boundaries (ZipSlip, ZipBomb, Path Escaping) are breached."""
    pass

class ZipSecurityConfig:
    def __init__(
        self,
        max_zip_bytes: int = MAX_ZIP_BYTES,
        max_members: int = MAX_ZIP_MEMBERS,
        max_uncompressed_bytes: int = MAX_ZIP_UNCOMPRESSED_BYTES,
        max_single_file_bytes: int = MAX_ZIP_SINGLE_FILE_BYTES
    ):
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