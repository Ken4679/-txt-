# GUI Entry for ZipToTxt Desktop EXE
import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import zipfile
import hashlib
from typing import Optional, List

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    HAS_DND = True
except ImportError:
    HAS_DND = False

from core import (
    normalize_ai_path,
    parse_ai_blocks,
    is_sensitive_path,
    human_size,
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_ZIP_SINGLE_FILE_BYTES,
    TEXT_EXTENSIONS,
    TEXT_FILENAMES,
    AI_PRIMARY_PROMPT,
    AI_CONTINUE_PROMPT,
    AI_REVIEW_PROMPT
)

def decode_text(data: bytes) -> str:
    # UTF-8 BOM
    if data.startswith(b'\xef\xbb\xbf'):
        data = data[3:]
    elif data.startswith(b'\xff\xfe'):
        try:
            return data[2:].decode('utf-16le')
        except Exception:
            pass

    for enc in ('utf-8', 'gb18030', 'big5', 'shift_jis', 'windows-1252', 'latin1'):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode('utf-8', errors='replace')

def is_binary_bytes(filename: str, data: bytes) -> bool:
    name = os.path.basename(filename)
    ext = os.path.splitext(name)[1].lower()
    if name in TEXT_FILENAMES or ext in TEXT_EXTENSIONS:
        return False
    sample = data[:8192]
    if b'\x00' in sample:
        return True
    try:
        sample.decode('utf-8')
        return False
    except UnicodeDecodeError:
        try:
            sample.decode('gb18030')
            return False
        except UnicodeDecodeError:
            return True

def build_tree(paths: List[str], root_name: str) -> List[str]:
    tree = {}
    for p in paths:
        parts = p.split('/')
        curr = tree
        for part in parts:
            curr = curr.setdefault(part, {})

    lines = [f"{root_name}/"]
    def walk(node, prefix=""):
        items = sorted(node.keys())
        for idx, item in enumerate(items):
            is_last = (idx == len(items) - 1)
            connector = "└── " if is_last else "├── "
            next_prefix = prefix + ("    " if is_last else "│   ")
            lines.append(f"{prefix}{connector}{item}")
            if node[item]:
                walk(node[item], next_prefix)
    walk(tree, "")
    return lines

class ZipToTxtApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ZipToTxt - AI Code Workspace 3.1")
        self.root.geometry("820x620")
        self.root.minsize(680, 500)

        # Style
        self.style = ttk.Style()
        try:
            self.style.theme_use('clam')
        except Exception:
            pass

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.tab_export = ttk.Frame(self.notebook)
        self.tab_import = ttk.Frame(self.notebook)
        self.tab_help = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_export, text=" 01 · 导出仓库 (ZIP → TXT) ")
        self.notebook.add(self.tab_import, text=" 02 · 应用 AI 修改 (AI → Patch) ")
        self.notebook.add(self.tab_help, text=" 03 · 使用说明与规范 ")

        self.setup_export_tab()
        self.setup_import_tab()
        self.setup_help_tab()

        # Status Bar
        self.status_var = tk.StringVar(value="就绪 · 支持文件拖拽与离线处理")
        self.status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W, padding=(6, 3))
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def setup_export_tab(self):
        f = self.tab_export
        # Top selection
        top_frame = ttk.LabelFrame(f, text="选择源 ZIP 代码压缩包", padding=10)
        top_frame.pack(fill=tk.X, padx=10, pady=5)

        self.zip_path_var = tk.StringVar()
        entry = ttk.Entry(top_frame, textvariable=self.zip_path_var, state="readonly")
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))

        btn_browse = ttk.Button(top_frame, text="浏览选择...", command=self.on_browse_zip)
        btn_browse.pack(side=tk.RIGHT)

        # Options
        opt_frame = ttk.Frame(f)
        opt_frame.pack(fill=tk.X, padx=10, pady=5)

        self.filter_cache_var = tk.BooleanVar(value=True)
        chk_cache = ttk.Checkbutton(opt_frame, text="自动过滤 node_modules / .git / .venv / __pycache__ 等缓存", variable=self.filter_cache_var)
        chk_cache.pack(side=tk.LEFT)

        # Action Buttons
        act_frame = ttk.Frame(f)
        act_frame.pack(fill=tk.X, padx=10, pady=5)

        self.btn_export = ttk.Button(act_frame, text="开始生成 TXT 导出报告", command=self.on_start_export)
        self.btn_export.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_copy_prompt = ttk.Button(act_frame, text="复制 AI 主 Prompt", command=self.on_copy_primary_prompt)
        self.btn_copy_prompt.pack(side=tk.LEFT)

        # Log & Preview
        log_frame = ttk.LabelFrame(f, text="导出与解析进度日志", padding=10)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.export_log = tk.Text(log_frame, wrap=tk.WORD, font=("Consolas", 9))
        self.export_log.pack(fill=tk.BOTH, expand=True)

    def setup_import_tab(self):
        f = self.tab_import
        lbl_info = ttk.Label(f, text="在此粘贴 AI 响应内容（兼容 ### FILE: path / **FILE:** 等标记）：")
        lbl_info.pack(anchor=tk.W, padx=10, pady=(10, 2))

        self.import_text = tk.Text(f, wrap=tk.NONE, font=("Consolas", 9), height=14)
        self.import_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        act_frame = ttk.Frame(f)
        act_frame.pack(fill=tk.X, padx=10, pady=5)

        self.allow_sensitive_var = tk.BooleanVar(value=False)
        chk_sens = ttk.Checkbutton(act_frame, text="允许打包敏感文件 (.git, .env, 秘钥凭据)", variable=self.allow_sensitive_var)
        chk_sens.pack(side=tk.LEFT, padx=(0, 15))

        btn_parse = ttk.Button(act_frame, text="解析并生成 Patch ZIP 补丁包", command=self.on_generate_patch)
        btn_parse.pack(side=tk.LEFT)

    def setup_help_tab(self):
        f = self.tab_help
        txt = tk.Text(f, wrap=tk.WORD, font=("Segoe UI", 10), padx=15, pady=15)
        txt.pack(fill=tk.BOTH, expand=True)

        help_content = """ZipToTxt 使用指南与安全规范：

1. 导出仓库 (ZIP → TXT)
   - 选择或拖入 GitHub/本地代码库 ZIP 包。
   - 自动生成标准化目录树结构、SHA-256 哈希校验与完整源码。
   - 默认自动过滤 node_modules, .git, .venv, dist 等垃圾目录以节省 AI 上下文。

2. 应用 AI 修改 (AI → Patch ZIP)
   - 将 AI 输出的完整代码粘贴至第二页。
   - 点击“解析并生成 Patch ZIP 补丁包”，即可得到 ai_patch.zip。
   - 解压覆盖至原工程目录即可完成更新。

3. 安全防御体系
   - 防路径穿越 (Zip Slip) 防御：严格拦截包含 .. 的恶意路径。
   - Windows 保留字拦截：自动过滤 CON, PRN, AUX, NUL 等系统保留名。
   - 解压炸弹防护：单文件最大 256MB，解压总容量上限 1GB。
   - 100% 本地运算：完全在本地设备执行，绝不向外网传输任何源码。
"""
        txt.insert(tk.END, help_content)
        txt.config(state=tk.DISABLED)

    def on_browse_zip(self):
        path = filedialog.askopenfilename(filetypes=[("ZIP Files", "*.zip")])
        if path:
            self.zip_path_var.set(path)
            self.status_var.set(f"已选择文件: {os.path.basename(path)}")

    def on_copy_primary_prompt(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(AI_PRIMARY_PROMPT)
        messagebox.showinfo("提示", "AI 主 Prompt 已复制到剪贴板！")

    def on_start_export(self):
        path = self.zip_path_var.get()
        if not path or not os.path.isfile(path):
            messagebox.showerror("错误", "请先选择有效的 ZIP 压缩包文件！")
            return

        out_txt = os.path.splitext(path)[0] + ".txt"
        save_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            initialfile=os.path.basename(out_txt),
            filetypes=[("Text Files", "*.txt")]
        )
        if not save_path:
            return

        self.export_log.delete("1.0", tk.END)
        self.export_log.insert(tk.END, f"正在分析处理: {path}\n")
        self.btn_export.config(state=tk.DISABLED)

        threading.Thread(target=self._run_export, args=(path, save_path), daemon=True).start()

    def _run_export(self, zip_path: str, save_path: str):
        try:
            ignored_folders = {'node_modules', '.git', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next'}
            filter_ignored = self.filter_cache_var.get()

            with zipfile.ZipFile(zip_path, 'r') as z:
                infolist = z.infolist()
                valid_members = []
                for info in infolist:
                    if info.is_dir():
                        continue
                    name = info.filename.replace('\\', '/')
                    if filter_ignored and any(part.lower() in ignored_folders for part in name.split('/')):
                        continue
                    valid_members.append(info)

                if not valid_members:
                    raise ValueError("ZIP 中无有效文件")

                common_prefix = ""
                parts0 = valid_members[0].filename.replace('\\', '/').split('/')
                if len(parts0) > 1:
                    cand = parts0[0] + '/'
                    if all(m.filename.replace('\\', '/').startswith(cand) for m in valid_members):
                        common_prefix = cand

                root_disp = common_prefix.rstrip('/') if common_prefix else os.path.basename(zip_path).rsplit('.', 1)[0]
                rel_paths = []

                for m in valid_members:
                    raw = m.filename.replace('\\', '/')
                    rel = raw[len(common_prefix):] if common_prefix else raw
                    rel_paths.append(normalize_ai_path(rel))

                tree_lines = build_tree(rel_paths, root_disp)

                header = [
                    "=" * 100,
                    "REPOSITORY EXPORT",
                    "=" * 100,
                    f"SOURCE ZIP: {os.path.basename(zip_path)}",
                    f"FILE COUNT: {len(valid_members)}",
                    "=" * 100,
                    "DIRECTORY STRUCTURE",
                    "=" * 100,
                    "\n".join(tree_lines),
                    "",
                    "=" * 100,
                    "FILE CONTENTS",
                    "=" * 100,
                ]

                file_sections = []
                for idx, m in enumerate(valid_members):
                    rel = rel_paths[idx]
                    data = z.read(m)
                    h = hashlib.sha256(data).hexdigest()
                    is_bin = is_binary_bytes(rel, data)

                    sec = [
                        "",
                        "=" * 100,
                        f"FILE: {rel}",
                        f"SIZE: {human_size(len(data))} ({len(data)} bytes)",
                        f"SHA-256: {h}",
                    ]
                    if is_bin:
                        sec.append("TYPE: BINARY")
                        sec.append("CONTENT: NOT EMBEDDED (metadata only)")
                    else:
                        sec.append("TYPE: TEXT")
                        sec.append("=" * 100)
                        sec.append(decode_text(data))

                    file_sections.append("\n".join(sec))

                full_content = "\n".join(header) + "\n" + "\n".join(file_sections) + "\n"

                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(full_content)

            self.root.after(0, self._on_export_success, save_path, len(valid_members))
        except Exception as e:
            self.root.after(0, self._on_export_error, str(e))

    def _on_export_success(self, save_path, count):
        self.btn_export.config(state=tk.NORMAL)
        self.export_log.insert(tk.END, f"\n[成功] 已生成 TXT: {save_path}\n共收录 {count} 个文件\n")
        self.status_var.set(f"导出成功 · 共 {count} 个文件")
        messagebox.showinfo("成功", f"导出成功！\n文件已保存至：\n{save_path}")

    def _on_export_error(self, err_msg):
        self.btn_export.config(state=tk.NORMAL)
        self.export_log.insert(tk.END, f"\n[错误] {err_msg}\n")
        self.status_var.set("导出失败")
        messagebox.showerror("导出失败", f"处理失败: {err_msg}")

    def on_generate_patch(self):
        text = self.import_text.get("1.0", tk.END).strip()
        if not text:
            messagebox.showerror("错误", "请先粘贴 AI 输出内容！")
            return

        try:
            files_map = parse_ai_blocks(text)
            allow_sens = self.allow_sensitive_var.get()

            for path in files_map.keys():
                if is_sensitive_path(path) and not allow_sens:
                    raise ValueError(f"检测到受保护敏感文件: {path}，请勾选允许敏感文件后重试。")

            save_path = filedialog.asksaveasfilename(
                defaultextension=".zip",
                initialfile="ai_patch.zip",
                filetypes=[("ZIP Files", "*.zip")]
            )
            if not save_path:
                return

            with zipfile.ZipFile(save_path, 'w', zipfile.ZIP_DEFLATED) as z:
                for path, content in files_map.items():
                    z.writestr(path, content.encode('utf-8'))

            messagebox.showinfo("成功", f"成功生成补丁包！\n包含 {len(files_map)} 个修改文件：\n{save_path}")
            self.status_var.set(f"补丁生成成功 · 共 {len(files_map)} 个文件")
        except Exception as e:
            messagebox.showerror("生成补丁失败", str(e))
            self.status_var.set("生成补丁失败")

def main():
    if HAS_DND:
        root = TkinterDnD.Tk()
    else:
        root = tk.Tk()
    app = ZipToTxtApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
