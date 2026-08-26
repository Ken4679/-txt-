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
