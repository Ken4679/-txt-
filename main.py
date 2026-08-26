import logging
import re
import threading
from pathlib import Path
import tkinter as tk
from tkinter import BooleanVar, END, StringVar, Text, filedialog, messagebox, ttk

from tkinterdnd2 import DND_FILES, TkinterDnD

from core import (
    build_ai_patch,
    choose_default_output,
    create_patch_zip,
    existing_sensitive_files,
    get_app_data_dir,
    human_size,
    open_folder,
    process_zip_to_txt,
    read_text_content,
    write_ai_files,
)

APP_NAME = "ZipToTxt"
APP_VERSION = "3.1.0"

LOG_DIR = get_app_data_dir() / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(filename=LOG_DIR / "error.log", level=logging.ERROR,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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
4. Always return complete file content. Never use placeholders.
5. Preserve repository-relative paths.
6. If a file is long, continue in multiple messages without omitting content.
"""

AI_CONTINUE_PROMPT = """Continue exactly where your previous response stopped.
Do not restart completed files. Do not summarize. Output remaining complete source code only.
Use:
### FILE: relative/path/to/file.ext
```language
complete file content
```
"""

AI_REVIEW_PROMPT = """Review the attached repository TXT as a senior software engineer.
Identify architecture, entry points, dependencies, bugs, security concerns, and packaging concerns.
Do not rewrite the repository. Provide a concise review and a concrete implementation plan.
"""

class App(TkinterDnD.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME} · AI Code Workspace")
        self.geometry("1180x780")
        self.minsize(980, 680)
        self.configure(bg="#f5f7fb")

        self.zip_var = StringVar()
        self.txt_var = StringVar()
        self.output_dir_var = StringVar()
        self.status_var = StringVar(value="就绪")
        self.page_var = StringVar(value="导出仓库")
        self.include_binary_var = BooleanVar(value=False)
        self.open_after_var = BooleanVar(value=True)
        self.allow_sensitive_var = BooleanVar(value=False)

        self._style()
        self._build_shell()
        self._show_page("export")

    def _style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(".", font=("Segoe UI", 10))
        style.configure("TButton", padding=(13, 8), borderwidth=0)
        style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"), padding=(16, 11))
        style.configure("Secondary.TButton", padding=(11, 8))
        style.configure("TEntry", padding=8)
        style.configure("TNotebook", borderwidth=0)
        style.configure("TProgressbar", thickness=7)
        style.configure("Card.TFrame", background="#ffffff")
        style.configure("Sidebar.TFrame", background="#111827")
        style.configure("Sidebar.TLabel", background="#111827", foreground="#d1d5db")
        style.configure("SidebarTitle.TLabel", background="#111827", foreground="#ffffff",
                        font=("Segoe UI", 16, "bold"))
        style.configure("PageTitle.TLabel", background="#f5f7fb", foreground="#111827",
                        font=("Segoe UI", 24, "bold"))
        style.configure("Muted.TLabel", background="#f5f7fb", foreground="#6b7280")
        style.configure("CardTitle.TLabel", background="#ffffff", foreground="#111827",
                        font=("Segoe UI", 12, "bold"))
        style.configure("CardText.TLabel", background="#ffffff", foreground="#6b7280")
        style.configure("Status.TLabel", background="#ffffff", foreground="#374151", padding=(10, 7))

    def _build_shell(self):
        shell = ttk.Frame(self)
        shell.pack(fill="both", expand=True)

        sidebar = ttk.Frame(shell, style="Sidebar.TFrame", width=235)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)

        ttk.Label(sidebar, text="ZipToTxt", style="SidebarTitle.TLabel").pack(
            anchor="w", padx=24, pady=(28, 3))
        ttk.Label(sidebar, text="AI Code Workspace  3.1", style="Sidebar.TLabel").pack(
            anchor="w", padx=24, pady=(0, 28))

        self.nav_export = self._nav(sidebar, "01  导出仓库", "export")
        self.nav_import = self._nav(sidebar, "02  应用 AI 修改", "import")
        self.nav_help = self._nav(sidebar, "03  使用说明", "help")

        ttk.Frame(sidebar, style="Sidebar.TFrame").pack(fill="both", expand=True)
        ttk.Label(sidebar, text="安全防护已启用", style="Sidebar.TLabel").pack(
            anchor="w", padx=24, pady=(0, 4))
        ttk.Label(sidebar, text="ZIP 限额 · 路径防穿越 · 敏感文件保护",
                  style="Sidebar.TLabel", wraplength=185).pack(anchor="w", padx=24, pady=(0, 24))

        main = ttk.Frame(shell)
        main.pack(side="left", fill="both", expand=True)
        self.content = ttk.Frame(main)
        self.content.pack(fill="both", expand=True, padx=30, pady=(24, 14))

        footer = ttk.Frame(main, style="Card.TFrame", height=42)
        footer.pack(fill="x", padx=30, pady=(0, 14))
        footer.pack_propagate(False)
        self.progress = ttk.Progressbar(footer, mode="determinate")
        self.progress.pack(side="left", fill="x", expand=True, padx=(10, 12), pady=15)
        ttk.Label(footer, textvariable=self.status_var, style="Status.TLabel").pack(side="right")

    def _nav(self, parent, text, page):
        button = ttk.Button(parent, text=text, command=lambda: self._show_page(page),
                            style="Secondary.TButton")
        button.pack(fill="x", padx=16, pady=4)
        return button

    def _clear(self):
        for widget in self.content.winfo_children():
            widget.destroy()

    def _header(self, title, subtitle):
        ttk.Label(self.content, text=title, style="PageTitle.TLabel").pack(anchor="w")
        ttk.Label(self.content, text=subtitle, style="Muted.TLabel").pack(anchor="w", pady=(3, 20))

    def _card(self, parent=None, **pack):
        card = ttk.Frame(parent or self.content, style="Card.TFrame", padding=20)
        card.pack(**pack)
        return card

    def _show_page(self, page):
        self.page_var.set(page)
        self._clear()
        if page == "export":
            self._export_page()
        elif page == "import":
            self._import_page()
        else:
            self._help_page()

    def _export_page(self):
        self._header("导出仓库", "把 GitHub ZIP 转成适合 AI 阅读的完整 TXT。安全检查在后台自动执行。")
        drop = self._card(fill="x", pady=(0, 14))
        ttk.Label(drop, text="拖入 ZIP 文件", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(drop, text="支持直接拖拽，也可以点击选择。最大压缩包 512 MB。",
                  style="CardText.TLabel").pack(anchor="w", pady=(3, 15))
        zone = ttk.Frame(drop, style="Card.TFrame", relief="solid", borderwidth=1, height=105)
        zone.pack(fill="x")
        zone.pack_propagate(False)
        label = ttk.Label(zone, text="ZIP\n↓\n拖到这里", anchor="center",
                          background="#f8fafc", foreground="#64748b",
                          font=("Segoe UI", 12, "bold"))
        label.pack(fill="both", expand=True)
        for w in (zone, label):
            w.drop_target_register(DND_FILES)
            w.dnd_bind("<<Drop>>", self._on_zip_drop)

        fields = self._card(fill="x", pady=(0, 14))
        self._path_row(fields, "输入 ZIP", self.zip_var, self._choose_zip, "选择")
        self._path_row(fields, "输出 TXT", self.txt_var, self._choose_txt, "保存到")

        options = self._card(fill="x", pady=(0, 14))
        ttk.Label(options, text="导出选项", style="CardTitle.TLabel").pack(anchor="w", pady=(0, 10))
        ttk.Checkbutton(options, text="嵌入二进制文件 Base64（会显著增加 TXT 体积）",
                        variable=self.include_binary_var).pack(anchor="w", pady=4)
        ttk.Checkbutton(options, text="完成后打开输出目录",
                        variable=self.open_after_var).pack(anchor="w", pady=4)

        actions = ttk.Frame(self.content)
        actions.pack(fill="x")
        self.export_button = ttk.Button(actions, text="开始生成 TXT",
                                        style="Primary.TButton", command=self._start_export)
        self.export_button.pack(side="left")
        ttk.Button(actions, text="复制 AI 主 Prompt",
                   command=lambda: self._copy_prompt(AI_PRIMARY_PROMPT)).pack(side="left", padx=8)
        ttk.Button(actions, text="复制 Review Prompt",
                   command=lambda: self._copy_prompt(AI_REVIEW_PROMPT)).pack(side="left")

    def _path_row(self, parent, label, variable, command, button_text):
        row = ttk.Frame(parent, style="Card.TFrame")
        row.pack(fill="x", pady=5)
        ttk.Label(row, text=label, width=10, style="CardText.TLabel").pack(side="left")
        ttk.Entry(row, textvariable=variable).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(row, text=button_text, command=command).pack(side="right")

    def _import_page(self):
        self._header("应用 AI 修改", "粘贴 AI 返回的完整文件块。先预览，再写入；敏感文件默认阻止覆盖。")
        top = ttk.Frame(self.content)
        top.pack(fill="both", expand=True)
        editor_card = self._card(top, fill="both", expand=True, side="left", padx=(0, 14))
        ttk.Label(editor_card, text="AI 输出", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(editor_card, text="格式：### FILE: path/to/file.py + Markdown code fence",
                  style="CardText.TLabel").pack(anchor="w", pady=(3, 10))
        frame = ttk.Frame(editor_card)
        frame.pack(fill="both", expand=True)
        self.ai_text = Text(frame, wrap="none", font=("Cascadia Code", 10),
                            bg="#0f172a", fg="#e2e8f0", insertbackground="#ffffff",
                            relief="flat", padx=12, pady=12)
        vs = ttk.Scrollbar(frame, orient="vertical", command=self.ai_text.yview)
        self.ai_text.configure(yscrollcommand=vs.set)
        self.ai_text.pack(side="left", fill="both", expand=True)
        vs.pack(side="right", fill="y")
        self.ai_text.drop_target_register(DND_FILES)
        self.ai_text.dnd_bind("<<Drop>>", self._on_text_file_drop)

        side = self._card(top, width=310, side="right")
        side.pack_propagate(False)
        ttk.Label(side, text="输出设置", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(side, text="先选择目标文件夹，再执行恢复。",
                  style="CardText.TLabel").pack(anchor="w", pady=(3, 12))
        ttk.Entry(side, textvariable=self.output_dir_var).pack(fill="x")
        ttk.Button(side, text="选择文件夹", command=self._choose_output_dir).pack(fill="x", pady=7)
        ttk.Separator(side).pack(fill="x", pady=10)
        ttk.Checkbutton(side, text="允许覆盖敏感文件", variable=self.allow_sensitive_var).pack(anchor="w", pady=4)
        ttk.Label(side, text=".git / .env / 密钥文件默认受保护。",
                  style="CardText.TLabel", wraplength=260).pack(anchor="w", pady=(0, 10))
        ttk.Button(side, text="预览文件清单", command=self._preview_patch).pack(fill="x", pady=4)
        ttk.Button(side, text="恢复到文件夹", style="Primary.TButton",
                   command=self._extract_to_folder).pack(fill="x", pady=4)
        ttk.Button(side, text="生成补丁 ZIP", command=self._extract_patch_zip).pack(fill="x", pady=4)
        ttk.Button(side, text="清空编辑器",
                   command=lambda: self.ai_text.delete("1.0", END)).pack(fill="x", pady=(12, 4))

    def _help_page(self):
        self._header("使用说明", "一个面向 AI 辅助代码修改的本地工作台。")
        for title, body in [
            ("01 · 导出", "下载 GitHub 项目 ZIP → 拖入 → 生成 TXT → 上传给 AI。"),
            ("02 · 修改", "让 AI 按 FILE + code fence 格式返回修改文件 → 粘贴到应用。"),
            ("03 · 安全", "ZIP 防路径穿越、符号链接、ZIP Bomb；AI 输出限制大小并保护 .git / .env / 密钥文件。"),
            ("04 · 建议", "第一次应用 AI 修改时优先生成补丁 ZIP，确认内容后再恢复到项目目录。"),
        ]:
            card = self._card(fill="x", pady=(0, 10))
            ttk.Label(card, text=title, style="CardTitle.TLabel").pack(anchor="w")
            ttk.Label(card, text=body, style="CardText.TLabel", wraplength=800).pack(anchor="w", pady=(5, 0))

    def _copy_prompt(self, text):
        self.clipboard_clear()
        self.clipboard_append(text)
        self.update()
        self._set_status("Prompt 已复制")

    def _choose_zip(self):
        path = filedialog.askopenfilename(title="选择 ZIP", filetypes=[("ZIP", "*.zip"), ("All", "*.*")])
        if path:
            self._set_zip(Path(path))

    def _set_zip(self, path):
        self.zip_var.set(str(path))
        self.txt_var.set(str(choose_default_output(path)))
        self.output_dir_var.set(str(path.parent / f"{path.stem}_ai_patch"))
        self._set_status(f"已选择 · {path.name}")

    def _choose_txt(self):
        path = filedialog.asksaveasfilename(title="保存 TXT", defaultextension=".txt",
                                            filetypes=[("TXT", "*.txt")])
        if path:
            self.txt_var.set(path)

    def _choose_output_dir(self):
        path = filedialog.askdirectory(title="选择目标文件夹")
        if path:
            self.output_dir_var.set(path)

    def _on_zip_drop(self, event):
        paths = self._parse_drop_files(event.data)
        zips = [Path(p) for p in paths if str(p).lower().endswith(".zip")]
        if zips:
            self._set_zip(zips[0])
        else:
            messagebox.showerror("文件类型错误", "请拖入 ZIP 文件。")

    def _parse_drop_files(self, raw):
        try:
            return list(self.tk.splitlist(raw))
        except Exception:
            matches = re.findall(r"\{([^}]*)\}|(\S+)", raw.strip())
            return [a or b for a, b in matches]

    def _on_text_file_drop(self, event):
        chunks = []
        for raw in self._parse_drop_files(event.data):
            path = Path(raw)
            if path.is_file():
                try:
                    chunks.append(f"### FILE: {path.name}\n```\n{read_text_content(path)}\n```\n")
                except Exception as exc:
                    logger.error("读取拖拽文件失败", exc_info=True)
                    self._set_status(f"读取失败 · {path.name}")
        if chunks:
            self.ai_text.insert(END, "\n".join(chunks))
            self._set_status(f"已加入 {len(chunks)} 个文件")

    def _start_export(self):
        zip_path = Path(self.zip_var.get().strip())
        txt_path = Path(self.txt_var.get().strip())
        if not zip_path.is_file() or zip_path.suffix.lower() != ".zip":
            messagebox.showerror("输入错误", "请选择有效的 ZIP 文件。")
            return
        if not txt_path.name or txt_path.resolve() == zip_path.resolve():
            messagebox.showerror("输出错误", "请选择有效的 TXT 输出路径，且不能覆盖 ZIP。")
            return
        if txt_path.exists() and not messagebox.askyesno("确认覆盖", f"{txt_path.name} 已存在，是否覆盖？"):
            return

        self.export_button.configure(state="disabled")
        self.progress.configure(value=0, maximum=100)

        def worker():
            try:
                process_zip_to_txt(zip_path, txt_path, self.include_binary_var.get(),
                                    self._set_status, self._update_progress)
                self.after(0, lambda: self._export_done(txt_path))
            except Exception as exc:
                logger.error("ZIP 导出失败", exc_info=True)
                self.after(0, lambda: self._task_error("ZIP 导出失败", exc))
            finally:
                self.after(0, lambda: self.export_button.configure(state="normal"))
        threading.Thread(target=worker, daemon=True).start()

    def _export_done(self, path):
        self.progress.configure(value=100)
        if self.open_after_var.get():
            try:
                open_folder(path.parent)
            except Exception:
                pass
        messagebox.showinfo("完成", f"TXT 已生成：\n{path}")
        self._set_status("导出完成")

    def _parse_editor(self):
        raw = self.ai_text.get("1.0", END)
        if not raw.strip():
            raise ValueError("请先粘贴 AI 返回内容。")
        return build_ai_patch(raw)

    def _preview_patch(self):
        try:
            files = self._parse_editor()
            sensitive = existing_sensitive_files(files, Path(self.output_dir_var.get().strip() or "."))
            names = "\n".join(f"• {p}" for p in files)
            if sensitive:
                names += "\n\n受保护文件：\n" + "\n".join(f"• {p}" for p in sensitive)
            messagebox.showinfo("文件清单", f"共 {len(files)} 个文件：\n\n{names[:12000]}")
        except Exception as exc:
            self._task_error("解析失败", exc)

    def _extract_to_folder(self):
        try:
            raw_target = self.output_dir_var.get().strip()
            target = Path(raw_target) if raw_target else get_app_data_dir() / "ai_patch"
            files = self._parse_editor()
            sensitive = existing_sensitive_files(files, target)
            if sensitive and not self.allow_sensitive_var.get():
                messagebox.showwarning("检测到受保护文件",
                    "以下已有文件受到保护：\n\n" + "\n".join(sensitive) +
                    "\n\n如确认需要覆盖，请勾选“允许覆盖敏感文件”。")
                return
            if target.exists() and any(target.iterdir()):
                if not messagebox.askyesno("目标目录非空",
                    "继续会覆盖同名文件。建议先生成补丁 ZIP 备份。\n\n是否继续？"):
                    return
            count = write_ai_files(files, target, allow_sensitive=self.allow_sensitive_var.get())
            open_folder(target)
            self._set_status(f"已恢复 · {count} 个文件")
            messagebox.showinfo("完成", f"已恢复 {count} 个文件。\n{target}")
        except Exception as exc:
            logger.error("恢复 AI 文件失败", exc_info=True)
            self._task_error("恢复失败", exc)

    def _extract_patch_zip(self):
        try:
            files = self._parse_editor()
            path = filedialog.asksaveasfilename(title="保存补丁 ZIP", defaultextension=".zip",
                                                initialfile="ai_patch.zip",
                                                filetypes=[("ZIP", "*.zip")])
            if not path:
                return
            count = create_patch_zip(files, Path(path))
            open_folder(Path(path).parent)
            self._set_status(f"补丁 ZIP 已生成 · {count} 个文件")
            messagebox.showinfo("完成", f"已生成 {count} 个文件的补丁 ZIP。\n{path}")
        except Exception as exc:
            logger.error("生成补丁 ZIP 失败", exc_info=True)
            self._task_error("生成补丁失败", exc)

    def _update_progress(self, current, total):
        self.after(0, lambda: self.progress.configure(maximum=max(total, 1), value=current))

    def _set_status(self, message):
        self.after(0, lambda: self.status_var.set(message))

    def _task_error(self, title, exc):
        self._set_status("处理失败")
        messagebox.showerror(title, str(exc))


if __name__ == "__main__":
    App().mainloop()
