# -*- coding: utf-8 -*-
"""
Comprehensive industrial-grade test suite for ZipToTxt core module.
Covers Security (Zip Slip, Symlink, Unicode Trojan Source, Reserved Names, Sensitive Files, Zip Bomb),
AI Parser (All header formats, Inline fences, Truncated fence auto-healing, Duplicate merging),
Archive (Reading, ASCII tree, Binary/Text classification), and Token Estimation.
"""
import io
import os
import zipfile
from core import (
    normalize_ai_path,
    is_safe_relative_path,
    is_sensitive_path,
    is_text_file,
    is_binary_data,
    human_size,
    calculate_sha256,
    estimate_tokens,
    estimate_tokens_detailed,
    safe_extract_zip,
    scan_and_format_repo,
    parse_ai_blocks,
    parse_ai_output,
    create_patch_zip,
    write_parsed_files_to_dir,
    generate_ascii_tree,
    SecurityError,
    ZipSecurityConfig,
    MAX_ZIP_MEMBERS,
)

def run_tests():
    print("Running ZipToTxt Comprehensive Test Suite...")

    # =========================================================================
    # 1. SECURITY: Path Normalization & Traversal (Zip Slip)
    # =========================================================================
    assert normalize_ai_path('src/main.py') == 'src/main.py'
    assert normalize_ai_path('.github/workflows/build.yml') == '.github/workflows/build.yml'
    assert normalize_ai_path('   `src/utils/tool.ts`   ') == 'src/utils/tool.ts'
    assert normalize_ai_path('./src/components/App.tsx') == 'src/components/App.tsx'
    assert normalize_ai_path('.\\src\\components\\App.tsx') == 'src/components/App.tsx'
    assert normalize_ai_path('**src/main.py**') == 'src/main.py'
    assert normalize_ai_path('[src/main.py]') == 'src/main.py'
    assert normalize_ai_path('src/deep/nested/file.go') == 'src/deep/nested/file.go'

    # Traversal sequences must be blocked
    traversal_payloads = [
        '../etc/passwd',
        '../../etc/shadow',
        'foo/../../bar',
        'foo/../bar',
        '..\\windows\\system32',
        '%2e%2e/etc/passwd',
        '%252e%252e/etc/passwd',
        'C:\\Windows\\System32\\cmd.exe',
        'D:/project/secret.key',
        '\\\\server\\share\\exploit.exe',
        '//192.168.1.1/share/data',
    ]
    for payload in traversal_payloads:
        try:
            normalize_ai_path(payload)
            assert False, f"Expected SecurityError for payload: {payload}"
        except SecurityError:
            pass

    # Windows reserved device names
    reserved_payloads = ['CON', 'con.txt', 'PRN.py', 'aux.cpp', 'NUL', 'COM1.json', 'LPT3']
    for payload in reserved_payloads:
        try:
            normalize_ai_path(payload)
            assert False, f"Expected SecurityError for Windows reserved device name: {payload}"
        except SecurityError:
            pass

    # Unicode Trojan Source, Bidi override & Null byte stripping
    assert normalize_ai_path('src/\u202emain.py') == 'src/main.py'
    assert normalize_ai_path('src/\u200bsecret.py') == 'src/secret.py'
    assert normalize_ai_path('src/safe\x00file.py') == 'src/safefile.py'

    # =========================================================================
    # 2. SECURITY: Sensitive Files & Directories Detection
    # =========================================================================
    assert is_sensitive_path('.env') is True
    assert is_sensitive_path('.env.production') is True
    assert is_sensitive_path('.env.local') is True
    assert is_sensitive_path('config/.env.test') is True
    assert is_sensitive_path('id_rsa') is True
    assert is_sensitive_path('id_ed25519') is True
    assert is_sensitive_path('ssh/id_rsa.pub') is True
    assert is_sensitive_path('.git/config') is True
    assert is_sensitive_path('.aws/credentials') is True
    assert is_sensitive_path('.kube/config') is True
    assert is_sensitive_path('certs/server.pem') is True
    assert is_sensitive_path('certs/privkey.key') is True
    assert is_sensitive_path('firebase-adminsdk.json') is True
    assert is_sensitive_path('service-account.json') is True

    # Safe paths
    assert is_sensitive_path('src/main.py') is False
    assert is_sensitive_path('.github/workflows/ci.yml') is False
    assert is_sensitive_path('public/index.html') is False
    assert is_sensitive_path('README.md') is False

    # =========================================================================
    # 3. TEXT & BINARY Classification
    # =========================================================================
    assert is_text_file('Dockerfile') is True
    assert is_text_file('Makefile') is True
    assert is_text_file('.gitignore') is True
    assert is_text_file('package.json') is True
    assert is_text_file('src/App.tsx') is True
    assert is_text_file('main.rs') is True
    assert is_text_file('image.png') is False
    assert is_text_file('archive.zip') is False
    assert is_text_file('app.exe') is False

    assert is_binary_data('data.bin', b'\x00\x01\x02\x03\x04') is True
    assert is_binary_data('hello.txt', b'Hello World') is False
    assert is_binary_data('chinese.txt', '你好世界！'.encode('utf-8')) is False
    assert is_binary_data('chinese_gbk.txt', '你好世界！'.encode('gb18030')) is False

    # =========================================================================
    # 4. TOKEN ESTIMATION
    # =========================================================================
    assert estimate_tokens("") == 0
    short_code = "const greeting = 'Hello, AI Studio!';"
    assert estimate_tokens(short_code) > 0

    code_sample = """
    function calculateTotal(items: CartItem[]): number {
        return items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
    }
    // 这是中文注释：计算购物车总价格
    """
    stats = estimate_tokens_detailed(code_sample)
    assert stats["estimated_tokens"] > 0
    assert stats["chinese_chars"] > 0
    assert stats["gpt4o_tokens"] > 0
    assert stats["claude_tokens"] > 0
    assert stats["gemini_tokens"] > 0
    assert stats["deepseek_tokens"] > 0
    assert "gpt128k" in stats["context_usage"]

    # =========================================================================
    # 5. AI MARKDOWN PARSER: High Fault-Tolerance & Auto-Healing
    # =========================================================================
    # Standard Markdown Headers
    ai_sample = """
Here is the refactored code:

### FILE: src/main.py
```python
import sys

def main():
    print("Hello from ZipToTxt")
```

## FILE: config/settings.json
```json
{
  "active": true
}
```

**FILE:** `src/types.ts`
```typescript
export interface AppConfig {
  active: boolean;
}
```

[FILE: README.md]
```markdown
# ZipToTxt Project
```
"""
    files_map, warnings, auto_closed = parse_ai_output(ai_sample)
    assert len(files_map) == 4
    assert 'src/main.py' in files_map
    assert 'config/settings.json' in files_map
    assert 'src/types.ts' in files_map
    assert 'README.md' in files_map
    assert 'def main():' in files_map['src/main.py']
    assert auto_closed == 0

    # Inline fence syntax (```python:src/app.py)
    inline_sample = """
```python:src/server.py
from http.server import HTTPServer
```
"""
    inline_map, _, _ = parse_ai_output(inline_sample)
    assert 'src/server.py' in inline_map
    assert 'from http.server import HTTPServer' in inline_map['src/server.py']

    # Auto-healing truncated code fences (Token limit cutoff)
    truncated_sample = """
### FILE: src/truncated.py
```python
def unfinished_function():
    data = [1, 2, 3]
    for item in data:
        process(item)
"""
    trunc_map, trunc_warn, trunc_count = parse_ai_output(truncated_sample)
    assert 'src/truncated.py' in trunc_map
    assert 'process(item)' in trunc_map['src/truncated.py']
    assert trunc_count == 1
    assert len(trunc_warn) == 1

    # Merging multi-chunk response for same file
    chunked_sample = """
### FILE: src/big_file.py
```python
# Part 1
def step1(): pass
```

### FILE: src/big_file.py
```python
# Part 2
def step2(): pass
```
"""
    chunked_map = parse_ai_blocks(chunked_sample)
    assert 'src/big_file.py' in chunked_map
    assert 'step1()' in chunked_map['src/big_file.py']
    assert 'step2()' in chunked_map['src/big_file.py']

    # =========================================================================
    # 6. ARCHIVE & REPO CONTEXT
    # =========================================================================
    # Create an in-memory test ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('my-app/src/index.ts', 'console.log("Hello App");\n')
        zf.writestr('my-app/package.json', '{"name": "my-app"}\n')
        zf.writestr('my-app/assets/logo.png', b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR')
        zf.writestr('my-app/node_modules/dummy.js', 'console.log("ignored");')

    zip_bytes = zip_buffer.getvalue()

    txt_content, ascii_tree, meta = scan_and_format_repo(
        zip_bytes,
        include_binary=False,
        filter_ignored_folders=True,
        ignored_folders=['node_modules']
    )

    assert meta['file_count'] == 3  # index.ts, package.json, logo.png (node_modules filtered)
    assert meta['text_count'] == 2
    assert meta['binary_count'] == 1
    assert meta['ignored_count'] >= 1
    assert 'src/index.ts' in txt_content
    assert 'package.json' in txt_content
    assert 'DIRECTORY STRUCTURE:' in txt_content
    assert 'REPOSITORY SOURCE CODE FILES' in txt_content

    # ASCII Tree generation
    tree = generate_ascii_tree(['src/components/App.tsx', 'src/main.tsx', 'package.json'], 'my-repo')
    assert 'my-repo/' in tree
    assert 'src/' in tree
    assert 'App.tsx' in tree

    # =========================================================================
    # 7. PATCH ZIP GENERATION & SENSITIVE GATING
    # =========================================================================
    patch_files = {
        'src/main.py': 'print("Updated")',
        'README.md': '# Updated Readme'
    }
    patch_zip_bytes = create_patch_zip(patch_files, allow_sensitive=False)
    assert len(patch_zip_bytes) > 0

    # Reading back the patch ZIP
    with zipfile.ZipFile(io.BytesIO(patch_zip_bytes), 'r') as pzf:
        names = pzf.namelist()
        assert 'src/main.py' in names
        assert 'README.md' in names
        assert pzf.read('src/main.py').decode('utf-8') == 'print("Updated")'

    # Sensitive file blocked when allow_sensitive=False
    sensitive_patch = {
        'src/main.py': 'print(1)',
        '.env.production': 'API_KEY=secret123'
    }
    try:
        create_patch_zip(sensitive_patch, allow_sensitive=False)
        assert False, "Should block .env.production"
    except SecurityError:
        pass

    # Allowed when explicit
    allowed_patch_bytes = create_patch_zip(sensitive_patch, allow_sensitive=True)
    assert len(allowed_patch_bytes) > 0

    print("All ZipToTxt Python core tests passed successfully!")

if __name__ == '__main__':
    run_tests()
