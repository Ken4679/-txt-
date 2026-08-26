"""
Comprehensive smoke & security test suite for ZipToTxt core module.
"""
from core import (
    normalize_ai_path,
    parse_ai_blocks,
    is_sensitive_path,
    is_text_file,
    human_size,
    AI_PRIMARY_PROMPT,
    AI_CONTINUE_PROMPT,
    AI_REVIEW_PROMPT,
    AI_AUDIT_PROMPT_CN
)

def run_tests():
    # 1. Path normalization tests
    assert normalize_ai_path('src/main.py') == 'src/main.py'
    assert normalize_ai_path('.github/workflows/build.yml') == '.github/workflows/build.yml'
    assert normalize_ai_path('   `src/utils/tool.ts`   ') == 'src/utils/tool.ts'
    
    # 2. Path traversal security (Zip Slip)
    try:
        normalize_ai_path('../../etc/passwd')
        assert False, "Should block traversal"
    except Exception:
        pass

    try:
        normalize_ai_path('foo/../bar')
        assert False, "Should block traversal"
    except Exception:
        pass

    # 3. Sensitive files detection
    assert is_sensitive_path('.env') == True
    assert is_sensitive_path('.env.production') == True
    assert is_sensitive_path('id_rsa') == True
    assert is_sensitive_path('.git/config') == True
    assert is_sensitive_path('.github/workflows/ci.yml') == False
    assert is_sensitive_path('src/utils/tool.ts') == False

    # 4. Text file detection
    assert is_text_file('.github/CODEOWNERS') == True
    assert is_text_file('Dockerfile') == True
    assert is_text_file('main.py') == True
    assert is_text_file('image.png') == False

    # 5. AI block parsing & healing
    sample = """
### FILE: a.py
```python
print(1)
```

### FILE: .github/workflows/ci.yml
```yaml
name: CI
jobs:
  test:
    runs-on: ubuntu-latest
```
"""
    res = parse_ai_blocks(sample)
    assert 'a.py' in res
    assert res['a.py'] == 'print(1)'
    assert '.github/workflows/ci.yml' in res

    # 6. Truncated block auto-healing
    truncated_sample = "### FILE: b.py\n```python\ndef hello():\n    return 'world'"
    res_trunc = parse_ai_blocks(truncated_sample)
    assert 'b.py' in res_trunc
    assert "return 'world'" in res_trunc['b.py']

    print("All ZipToTxt Python core tests passed successfully!")

if __name__ == '__main__':
    run_tests()
