# ZipToTxt · AI Code Workspace (v3.1)

<p align="center">
  <img src="public/app-icon.png" width="128" height="128" alt="ZipToTxt Logo" style="border-radius: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);" />
</p>

<p align="center">
  <strong>专为大语言模型上下文吞吐与工程自动化设计的「代码仓库 ⇄ 单一 TXT ⇄ AI 代码补丁」双向工作台</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v3.1.0-6366f1?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Web-38bdf8?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square" alt="Python" />
  <img src="https://img.shields.io/badge/React-18%20%2B%20TypeScript-blueviolet?style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/Security-ZipBomb%20%26%20ZipSlip%20Protected-emerald?style=flat-square" alt="Security" />
  <img src="https://img.shields.io/badge/License-MIT-slate?style=flat-square" alt="License" />
</p>

---

## 🌟 项目简介

在将完整 GitHub 仓库或工程源码输入给大语言模型（如 Claude 3.5 Sonnet、GPT-4o、Gemini 1.5 Pro/Flash、DeepSeek-V3 等）时，开发者常面临 **“多文件上传琐碎”、“格式排版紊乱”、“Token 消耗不可控”** 以及 **“AI 返回修改代码后难以批量写回本地”** 的痛点。

**ZipToTxt** 提供了完整的双向闭环解决方案：
1. **正向导出（ZIP → TXT）**：将任意仓库 ZIP 压缩包一键解析为包含**完整目录树、多语言代码正文、二进制文件哈希/Base64** 的结构化纯文本，自动生成适配各主流 AI 的优化 Prompt。
2. **反向打补丁（AI Markdown → Patch ZIP）**：智能解析 AI 返回的标准 Markdown 代码块，实时预览 Diff 差异对比，一键将改动文件复原为严格目录树并打包为 `patch.zip`。

项目同时提供 **高性能 Web 端工作台** 与 **原生 Windows 单文件免安装客户端（`ZipToTxt.exe`）**。

---

## ✨ 核心特性

### 1. 📦 正向导出：仓库 ZIP → 结构化 TXT
- **一键拖拽与极速解析**：支持直接拖拽任意 `.zip` 压缩包（自动跳过 GitHub 单一根目录前缀）。
- **智能工程目录树**：自动生成 ASCII 树状结构图，清晰展现项目层级。
- **智能文本与二进制识别**：内置 60+ 种常用编程语言扩展名与配置白名单，精准识别 UTF-8/GBK 文本文件。
- **二进制文件处理机制**：默认记录路径、体积及 SHA-256 校验和；支持一键开启 **Base64 完整嵌入**。
- **Token 智能估算与统计**：实时统计文件总数、代码总行数、预估 LLM Token 开销（4 字符/Token 模型）。
- **Prompt 自动化装配**：预置精准指令模板，约束大模型按统一规范输出改动文件，杜绝伪代码或截断代码。

### 2. 🧩 反向导入：AI Markdown → 补丁 ZIP
- **全自动代码块解析**：精准提取形如 `### FILE: relative/path/to/file.ext` 的 Markdown 代码围栏。
- **自动容错与闭合保护**：针对 AI 偶尔遗漏闭合 ```` ``` ```` 的边界情况提供自动修复机制。
- **Monaco 智能代码编辑器**：提供语法高亮、迷你地图、多文件切换、只读保护与实时编辑。
- **多维度改动对比（Diff）**：支持文件状态标记（新增/修改/敏感）、行数差异统计与变更核验。
- **一键生成补丁归档**：只将 AI 变更的文件按原始目录结构精准打包为 `patch.zip`，避免全量覆盖污染。

### 3. 🛡️ 工业级安全审计引擎
- **ZIP 炸弹（Zip Bomb）主动拦截**：
  - 限制最大压缩包体积（512 MB）、解压膨胀上限（1 GB）、最大条目数（15,000）及单文件上限（256 MB）。
- **路径穿越（Zip Slip）防护**：
  - 严格校验相对路径，拦截 `../`、`..\\`、绝对路径及 Windows 保留设备名称（`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`）。
- **符号链接（Symlink Attack）拦截**：
  - 拒绝一切软链接/硬链接引用，防止恶意逃逸读取宿主机敏感文件。
- **敏感凭证过滤**：
  - 自动检测并标记 `.git`、`.env*`、`id_rsa`、`keystore.jks`、`service-account.json` 等私钥与凭证文件。

---

## 🖥️ 两种使用方式

### 方式 A：Web 工作台（在线 / 本地开发）
基于 **React 18 + TypeScript + Tailwind CSS + Monaco Editor + WebAssembly JSZip** 构建。
- **纯前端客户端计算**：所有 ZIP 解压、文本解析与补丁打包均在浏览器本地内存运行，**源码绝不上传任何第三方服务器**，隐私 100% 安全。
- **即开即用**：支持跨平台现代浏览器（Chrome、Edge、Safari、Firefox）。

#### 本地启动 Web 端
```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务
npm run dev

# 3. 生产打包
npm run build
```

---

### 方式 B：Windows 原生桌面客户端（`ZipToTxt.exe`）
基于 **Python 3.10+ / PySide6 (Qt6)** 构建，独立单文件分发，免安装直接运行。
- **现代化深色主题与高分屏优化**：基于 Qt6 硬件加速与 Slate Dark 专业暗色调，4K / 150% / 200% 高分屏无损矢量缩放。
- **Windows 原生拖拽与多任务线程**：基于 Qt 内核事件循环原生支持 `.zip`、`.txt`、`.md` 拖拽载入，后台 Worker 线程无卡顿处理大型代码仓库。
- **任务栏与高清图标适配**：注册原生 Windows `AppUserModelID`，多分辨率 `app.ico` 完美适配资源管理器与任务栏。

#### 客户端源码运行
```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动桌面端
python main.py
```

#### 本地打包单文件 EXE
```bash
# 安装指定版本 PyInstaller
pip install pyinstaller==6.22.2

# 执行打包命令（自动打包图标与 PySide6 核心模块）
pyinstaller --clean --noconfirm `
  --onefile `
  --windowed `
  --name "ZipToTxt" `
  --icon="app.ico" `
  --add-data "app.ico;." `
  --add-data "app_icon.png;." `
  main.py
```
打包产物位于 `dist/ZipToTxt.exe`。

---

## 🤖 AI 交互标准规范（Prompt 规范）

为确保大模型能被本工具 100% 精准反向解析，请在提问时要求 AI 严格遵守如下输出格式：

### 推荐 Prompt 模板
```markdown
我正在与你共享一个由工具导出的完整项目仓库上下文 TXT。

请帮我实现以下需求：
[在此详细描述您的业务需求、Bug 修复或功能重构]

【输出规范】：
1. 保持项目现有架构与代码规范；
2. 仅输出你修改过或新创建的文件；
3. 每个文件必须且仅能使用以下 Markdown 格式输出（禁止省略代码或使用 `...` 占位）：

### FILE: path/to/file.ext
```language
// 完整的、可直接运行的文件代码
```
```

### AI 输出示例
```markdown
已根据需求修改了后端入口并新增了工具类：

### FILE: src/main.py
```python
import os
from utils.helper import format_message

def run():
    print(format_message("Service started successfully!"))

if __name__ == "__main__":
    run()
```

### FILE: src/utils/helper.py
```python
def format_message(msg: str) -> str:
    return f"[ZipToTxt] {msg}"
```
```

---

## 🚀 GitHub Actions 持续集成与发布

本项目自带完善的 GitHub CI/CD 工作流（位于 `.github/workflows/build.yml`）：

1. **自动构建**：
   - 每当代码推送到 `main` 分支或提交 Pull Request 时，GitHub Actions 会自动在 Windows 虚拟机上打包生成最新的 `ZipToTxt.exe`。
   - 可以在 GitHub 仓库的 **Actions → Artifacts** 中直接下载构建产物。
2. **自动化 Release 发布**：
   - 触发版本 Tag 推送（例如 `git tag v3.1.0 && git push origin v3.1.0`）；
   - GitHub Actions 会自动创建 GitHub Release，并将 `ZipToTxt.exe` 作为 Release 附件供公开下载。

---

## 📁 目录结构

```text
├── .github/workflows/
│   └── build.yml             # GitHub Actions 自动化构建与 Release 脚本
├── public/
│   ├── app-icon.png          # 极简现代高清应用图标 (PNG)
│   ├── app-icon.ico          # Windows 多分辨率系统图标 (ICO)
│   └── favicon.ico           # Web 网页 Favicon
├── src/
│   ├── assets/               # 矢量与图像资源
│   ├── components/
│   │   ├── ExportPage.tsx    # 01 · 仓库转 TXT 导出工作台
│   │   ├── ImportPage.tsx    # 02 · AI 补丁解析与 ZIP 生成工作台
│   │   ├── SecurityAuditPage.tsx # 03 · 实时安全审计与敏感凭证扫描
│   │   ├── HelpPage.tsx      # 04 · 使用说明与规范指南
│   │   └── Sidebar.tsx       # 全局侧边栏导航组件
│   ├── types.ts              # 全局 TypeScript 接口定义
│   ├── App.tsx               # Web 端主入口应用
│   └── main.tsx              # React DOM 渲染入口
├── core.py                   # Python 核心解析与安全审计引擎 (CLI/GUI 共用)
├── main.py                   # Python PySide6 (Qt6) Windows 桌面端 GUI 应用程序
├── test_core.py              # Python 单元测试套件 (ZipSlip/ZipBomb/Parser 安全审计)
├── requirements.txt          # Python 依赖清单 (PySide6)
├── package.json              # Node.js / React 依赖配置
└── README.md                 # 项目详细中英文技术文档
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。欢迎提交 Issue 或 Pull Request！
