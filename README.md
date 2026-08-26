# ZipToTxt

一个用于“GitHub ZIP → 单 TXT → AI 修改代码 → 文件/补丁 ZIP”的 Windows GUI 工具。

## 功能

- ZIP 文件拖拽
- 自动安全解压
- 递归读取整个 repository
- 输出目录树
- 文本源码完整写入 TXT
- 二进制文件默认记录路径、大小、SHA-256
- 可选：将二进制文件完整 Base64 嵌入 TXT
- 复制 AI Prompt
- 解析 AI 的 `### FILE: relative/path` Markdown 输出
- 将 AI 修改恢复成目录结构
- 只打包 AI 修改文件为 patch ZIP
- 临时文件使用系统 TEMP
- 路径穿越保护
- GitHub Actions 自动构建单文件 Windows EXE

## GitHub Actions

把本项目直接上传到 GitHub。

之后打开：

`Actions → Build Windows EXE`

构建成功后，在 Artifacts 里下载：

`ZipToTxt-Windows`

如果创建 tag，例如：

```bash
git tag v3.0.0
git push origin v3.0.0
```

GitHub Actions 会额外创建一个 Release 并附带 `ZipToTxt.exe`。

## 本地运行

```bash
pip install -r requirements.txt
python main.py
```

## 本地打包

```bash
pip install pyinstaller==6.22.2
pyinstaller --clean --noconfirm --onefile --windowed --additional-hooks-dir=. main.py
```

输出：

`dist/ZipToTxt.exe`

## AI 输出格式

推荐让 AI 使用：

```text
### FILE: src/main.py
```python
print("hello")
```

### FILE: config/settings.json
```json
{
  "enabled": true
}
```
```

不要让 AI 使用 `...` 或“保持其余代码不变”，否则恢复出来的文件会不完整。

# ZipToTxt 3.1 security + UI update

替换 `main.py` 和 `core.py`，并用 `.github/workflows/build.yml` 替换工作流。

主要变化：
- ZIP Bomb 防护：大小、条目数、单文件大小、总解压大小限制。
- ZIP 路径穿越与符号链接拒绝。
- AI 输入/输出大小和文件数量限制。
- AI 文件路径严格要求 Markdown code fence。
- `.git`、`.env`、密钥文件默认保护。
- 写入前检查符号链接路径。
- 临时补丁目录使用 `tempfile.mkdtemp()`。
- 修复拖拽文件解析 fallback。
- 默认输出目录不再错误地落到当前目录。
- UI 重做为侧边栏 + 卡片 + 大型拖拽区 + 编辑器 + 操作面板。
- CI 将普通构建权限降为 `contents: read`，Release job 单独申请 `contents: write`。
