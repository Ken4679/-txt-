import logging
import os
import re
import threading
from pathlib import Path
from tkinter import BooleanVar, END, StringVar, Text, filedialog, messagebox, ttk

from tkinterdnd2 import DND_FILES, TkinterDnD

from core import (
    build_ai_patch,
    process_zip_to_txt,
    choose_default_output,
    get_app_data_dir,
    open_folder,
    read_text_content,
)

APP_NAME = "GitHub ZIP ⇄ AI Code Assistant"
APP_VERSION = "3.0.0"

LOG_DIR = get_app_data_dir() / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "error.log"

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.ERROR,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

AI_PRIMARY_PROMPT = """I am sharing a complete source-code repository exported into a TXT file.

Please implement this requirement:
[DESCRIBE YOUR REQUIREMENT HERE]

Rules:
1. Preserve the existing project architecture unless a change is necessary.
2. Only return files that you modified or created.
3. For every changed file, use exactly this format:

### FILE: relative/path/to/file.ext
```language
complete file content
```

4. Always return the COMPLETE content of each changed file. Do not use placeholders such as "...", "same as before", or omitted sections.
5. Keep the original relative paths.
6. If a file is long, continue in multiple messages but never omit content. I will reply "continue" when needed.
"""

AI_CONTINUE_PROMPT = """Continue from exactly where your previous response stopped.

Rules:
1. Do not restart files already completed.
2. Do not summarize.
3. Output the remaining COMPLETE source code only.
4. Preserve the exact format:

### FILE: relative/path/to/file.ext
```language
complete file content
```
"""

AI_REVIEW_PROMPT = """Review the attached repository TXT as a senior software engineer.

First identify:
- architecture
- entry points
- dependencies
- important modules
- likely bugs
- security concerns
- packaging/deployment concerns

Do not rewrite the entire repository. Provide a concise technical review and then a concrete implementation plan for the requested change.
"""


class App(TkinterDnD.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME} v{APP_VERSION}")
        self.geometry("760x760")
        self.minsize(720, 700)

        self.zip_var = StringVar()
        self.txt_var = StringVar()
        self.output_dir_var = StringVar()
        self.status_var = StringVar(value="就绪")
        self.include_binary_var = BooleanVar(value=False)
        self.open_after_var = BooleanVar(value=True)

        self._build_ui()

    def _build_ui(self):
        root = ttk.Frame(self, padding=14)
        root.pack(fill="both", expand=True)

        title = ttk.Label(
            root,
            text=f"{APP_NAME} v{APP_VERSION}",
            font=("Segoe UI", 18, "bold"),
        )
        title.pack(anchor="w")

        subtitle = ttk.Label(
            root,
            text="ZIP → 完整仓库 TXT；AI Markdown → 修改文件/补丁 ZIP",
            font=("Segoe UI", 9),
        )
        subtitle.pack(anchor="w", pady=(2, 12))

        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill="both", expand=True)

        self.tab_export = ttk.Frame(self.notebook, padding=12)
        self.tab_import = ttk.Frame(self.notebook, padding=12)
        self.tab_help = ttk.Frame(self.notebook, padding=12)

        self.notebook.add(self.tab_export, text="1. ZIP → TXT")
        self.notebook.add(self.tab_import, text="2. AI 代码 → 文件")
        self.notebook.add(self.tab_help, text="3. 使用说明")

        self._build_export_tab()
        self._build_import_tab()
        self._build_help_tab()

        bottom = ttk.Frame(root)
        bottom.pack(fill="x", pady=(10, 0))

        self.progress = ttk.Progressbar(bottom, mode="determinate")
        self.progress.pack(fill="x", pady=(0, 6))

        status = ttk.Label(
            bottom,
            textvariable=self.status_var,
            relief="sunken",
            anchor="w",
            padding=(7, 4),
        )
        status.pack(fill="x")

    def _build_export_tab(self):
        drop = ttk.LabelFrame(self.tab_export, text=" 拖拽 ZIP ")
        drop.pack(fill="x", pady=(0, 12))

        drop_label = ttk.Label(
            drop,
            text="把 GitHub 下载的 .zip 拖到这里\n也可以点击“选择 ZIP”",
            anchor="center",
            justify="center",
            font=("Segoe UI", 11, "bold"),
        )
        drop_label.pack(fill="x", ipady=22)

        for widget in (drop, drop_label):
            widget.drop_target_register(DND_FILES)
            widget.dnd_bind("<<Drop>>", self._on_zip_drop)

        grid = ttk.Frame(self.tab_export)
        grid.pack(fill="x")

        ttk.Label(grid, text="输入 ZIP:", width=12).grid(row=0, column=0, sticky="w", pady=5)

        self.zip_entry = ttk.Entry(grid, textvariable=self.zip_var)
        self.zip_entry.grid(row=0, column=1, sticky="ew", padx=5, pady=5)

        ttk.Button(
            grid,
            text="选择 ZIP",
            command=self._choose_zip,
        ).grid(row=0, column=2, pady=5)

        ttk.Label(grid, text="输出 TXT:", width=12).grid(row=1, column=0, sticky="w", pady=5)

        self.txt_entry = ttk.Entry(grid, textvariable=self.txt_var)
        self.txt_entry.grid(row=1, column=1, sticky="ew", padx=5, pady=5)

        ttk.Button(
            grid,
            text="保存到...",
            command=self._choose_txt,
        ).grid(row=1, column=2, pady=5)

        grid.columnconfigure(1, weight=1)

        options = ttk.LabelFrame(self.tab_export, text=" 导出选项 ")
        options.pack(fill="x", pady=(12, 12))

        ttk.Checkbutton(
            options,
            text="将二进制文件完整写入 TXT（Base64）",
            variable=self.include_binary_var,
        ).pack(anchor="w", padx=10, pady=6)

        ttk.Label(
            options,
            text="关闭时：TXT 仍会记录二进制文件的路径、大小和 SHA-256；开启后会额外写入完整 Base64。",
            wraplength=680,
        ).pack(anchor="w", padx=10, pady=(0, 8))

        ttk.Checkbutton(
            options,
            text="完成后自动打开 TXT 所在文件夹",
            variable=self.open_after_var,
        ).pack(anchor="w", padx=10, pady=(0, 8))

        self.export_button = ttk.Button(
            self.tab_export,
            text="开始生成 TXT",
            command=self._start_export,
        )
        self.export_button.pack(fill="x", ipady=8)

        prompt_box = ttk.LabelFrame(self.tab_export, text=" AI Prompt ")
        prompt_box.pack(fill="both", expand=True, pady=(12, 0))

        prompt_preview = Text(prompt_box, height=8, wrap="word", font=("Consolas", 9))
        prompt_preview.pack(fill="both", expand=True, padx=8, pady=8)
        prompt_preview.insert("1.0", AI_PRIMARY_PROMPT)
        prompt_preview.configure(state="disabled")

        btns = ttk.Frame(prompt_box)
        btns.pack(fill="x", padx=8, pady=(0, 8))

        ttk.Button(
            btns,
            text="复制主 Prompt",
            command=lambda: self._copy_prompt(AI_PRIMARY_PROMPT, "主 Prompt 已复制"),
        ).pack(side="left", fill="x", expand=True, padx=(0, 4))

        ttk.Button(
            btns,
            text="复制 Continue Prompt",
            command=lambda: self._copy_prompt(AI_CONTINUE_PROMPT, "Continue Prompt 已复制"),
        ).pack(side="left", fill="x", expand=True, padx=4)

        ttk.Button(
            btns,
            text="复制 Review Prompt",
            command=lambda: self._copy_prompt(AI_REVIEW_PROMPT, "Review Prompt 已复制"),
        ).pack(side="left", fill="x", expand=True, padx=(4, 0))

    def _build_import_tab(self):
        ttk.Label(
            self.tab_import,
            text="把 AI 返回的 Markdown 代码粘贴到下方。支持多个文件、多个代码块和分段续传。",
        ).pack(anchor="w", pady=(0, 7))

        text_frame = ttk.Frame(self.tab_import)
        text_frame.pack(fill="both", expand=True)

        self.ai_text = Text(text_frame, wrap="none", font=("Consolas", 9))
        vbar = ttk.Scrollbar(text_frame, orient="vertical", command=self.ai_text.yview)
        hbar = ttk.Scrollbar(text_frame, orient="horizontal", command=self.ai_text.xview)
        self.ai_text.configure(yscrollcommand=vbar.set, xscrollcommand=hbar.set)

        self.ai_text.grid(row=0, column=0, sticky="nsew")
        vbar.grid(row=0, column=1, sticky="ns")
        hbar.grid(row=1, column=0, sticky="ew")
        text_frame.rowconfigure(0, weight=1)
        text_frame.columnconfigure(0, weight=1)

        self.ai_text.drop_target_register(DND_FILES)
        self.ai_text.dnd_bind("<<Drop>>", self._on_text_file_drop)

        target = ttk.LabelFrame(self.tab_import, text=" 输出 ")
        target.pack(fill="x", pady=(10, 0))

        ttk.Label(target, text="目标文件夹:", width=12).grid(row=0, column=0, sticky="w", padx=8, pady=7)

        ttk.Entry(
            target,
            textvariable=self.output_dir_var,
        ).grid(row=0, column=1, sticky="ew", padx=5, pady=7)

        ttk.Button(
            target,
            text="选择文件夹",
            command=self._choose_output_dir,
        ).grid(row=0, column=2, padx=8, pady=7)

        target.columnconfigure(1, weight=1)

        buttons = ttk.Frame(self.tab_import)
        buttons.pack(fill="x", pady=10)

        ttk.Button(
            buttons,
            text="提取到文件夹",
            command=self._extract_to_folder,
        ).pack(side="left", fill="x", expand=True, padx=(0, 5), ipady=6)

        ttk.Button(
            buttons,
            text="生成补丁 ZIP",
            command=self._extract_patch_zip,
        ).pack(side="left", fill="x", expand=True, padx=5, ipady=6)

        ttk.Button(
            buttons,
            text="清空",
            command=lambda: self.ai_text.delete("1.0", END),
        ).pack(side="left", fill="x", expand=True, padx=(5, 0), ipady=6)

    def _build_help_tab(self):
        help_text = Text(self.tab_help, wrap="word", font=("Segoe UI", 10))
        help_text.pack(fill="both", expand=True)

        content = (
            "工作流程\n\n"
            "1. 从 GitHub 下载项目 ZIP。\n"
            "2. 把 ZIP 拖进第一个标签页。\n"
            "3. 选择 TXT 保存位置，点击“开始生成 TXT”。\n"
            "4. 把生成的 TXT 上传给 AI，并附上 Prompt。\n"
            "5. AI 按 ### FILE: path/to/file.ext + Markdown code fence 返回修改文件。\n"
            "6. 把 AI 回复粘贴到第二个标签页。\n"
            "7. 可以直接恢复成文件夹，或者只打包修改文件为 patch ZIP。\n\n"
            "安全设计\n\n"
            "• ZIP 解压会检查路径穿越。\n"
            "• AI 返回的文件路径也会检查，不能写出目标目录。\n"
            "• 临时解压目录使用系统 TEMP，不依赖 EXE 所在目录写权限。\n"
            "• 日志保存在当前用户 LOCALAPPDATA。\n\n"
            "二进制文件\n\n"
            "默认只写入路径、大小、SHA-256。开启 Base64 后才会把二进制内容完整嵌入 TXT，"
            "适用于你确实需要让 AI 知道二进制原始内容的场景。"
        )
        help_text.insert("1.0", content)
        help_text.configure(state="disabled")

    def _copy_prompt(self, text, message):
        self.clipboard_clear()
        self.clipboard_append(text)
        self.update()
        self._set_status(message)

    def _choose_zip(self):
        path = filedialog.askopenfilename(
            title="选择 ZIP 文件",
            filetypes=[("ZIP files", "*.zip"), ("All files", "*.*")],
        )
        if path:
            self._set_zip(Path(path))

    def _set_zip(self, path: Path):
        self.zip_var.set(str(path))
        self.txt_var.set(str(choose_default_output(path)))

        parent = path.parent / f"{path.stem}_ai_patch"
        self.output_dir_var.set(str(parent))
        self._set_status(f"已选择：{path.name}")

    def _choose_txt(self):
        path = filedialog.asksaveasfilename(
            title="选择 TXT 保存位置",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
        )
        if path:
            self.txt_var.set(path)

    def _choose_output_dir(self):
        path = filedialog.askdirectory(title="选择输出文件夹")
        if path:
            self.output_dir_var.set(path)

    def _on_zip_drop(self, event):
        paths = self._parse_drop_files(event.data)
        zip_files = [Path(p) for p in paths if p.lower().endswith(".zip")]
        if not zip_files:
            messagebox.showerror("错误", "请拖入 ZIP 文件。")
            return
        self._set_zip(zip_files[0])

    def _on_text_file_drop(self, event):
        paths = self._parse_drop_files(event.data)
        text_files = []
        for raw in paths:
            path = Path(raw)
            if path.is_file():
                try:
                    text_files.append((path, read_text_content(path)))
                except Exception as exc:
                    logger.error("读取拖拽文件失败", exc_info=True)
                    self._set_status(f"读取失败：{path.name} - {exc}")

        if not text_files:
            return

        chunks = []
        for path, content in text_files:
            chunks.append(f"### FILE: {path.name}\n```\n{content}\n```")
        self.ai_text.insert(END, "\n\n".join(chunks) + "\n")
        self._set_status(f"已加入 {len(text_files)} 个文本文件")

    def _parse_drop_files(self, raw):
        try:
            return list(self.tk.splitlist(raw))
        except Exception:
            raw = raw.strip()
            if not raw:
                return []
            return re.findall(r'\{([^}]*)\}|(\S+)', raw)

    def _start_export(self):
        zip_path = Path(self.zip_var.get().strip())
        txt_path = Path(self.txt_var.get().strip())

        if not zip_path.is_file():
            messagebox.showerror("错误", "请输入有效的 ZIP 文件路径。")
            return
        if zip_path.suffix.lower() != ".zip":
            messagebox.showerror("错误", "输入文件必须是 .zip。")
            return
        if txt_path.name == "":
            messagebox.showerror("错误", "请选择 TXT 输出路径。")
            return
        if txt_path.resolve() == zip_path.resolve():
            messagebox.showerror("错误", "TXT 不能覆盖输入 ZIP。")
            return
        if txt_path.exists():
            if not messagebox.askyesno("确认覆盖", f"{txt_path} 已存在，是否覆盖？"):
                return

        self.export_button.configure(state="disabled")
        self.progress.configure(value=0, maximum=100)

        def worker():
            try:
                process_zip_to_txt(
                    zip_path=zip_path,
                    output_txt_path=txt_path,
                    include_binary=self.include_binary_var.get(),
                    status_callback=self._set_status,
                    progress_callback=self._update_progress,
                )
                self.after(0, lambda: self._export_done(txt_path))
            except Exception as exc:
                logger.error("ZIP → TXT 失败", exc_info=True)
                self.after(0, lambda: self._task_error("ZIP → TXT 失败", exc))
            finally:
                self.after(0, lambda: self.export_button.configure(state="normal"))

        threading.Thread(target=worker, daemon=True).start()

    def _export_done(self, txt_path: Path):
        self.progress.configure(value=100)
        self._set_status(f"完成：{txt_path}")
        if self.open_after_var.get():
            try:
                open_folder(txt_path.parent)
            except Exception:
                pass
        messagebox.showinfo("完成", f"TXT 已生成：\n\n{txt_path}")

    def _extract_to_folder(self):
        raw = self.ai_text.get("1.0", END)
        target = Path(self.output_dir_var.get().strip())

        if not raw.strip():
            messagebox.showerror("错误", "请先粘贴 AI 返回内容。")
            return
        if not str(target):
            target = get_app_data_dir() / "ai_patch"
            self.output_dir_var.set(str(target))

        try:
            files = build_ai_patch(raw)
        except Exception as exc:
            self._task_error("解析 AI 输出失败", exc)
            return

        if not files:
            messagebox.showerror("错误", "没有找到有效的 ### FILE: 文件块。")
            return

        if target.exists() and any(target.iterdir()):
            if not messagebox.askyesno(
                "目标文件夹非空",
                f"{target} 已经存在且非空。\n\n继续会覆盖同名文件，是否继续？",
            ):
                return

        try:
            count = self._write_patch_files(files, target)
            open_folder(target)
            self._set_status(f"已恢复 {count} 个文件")
            messagebox.showinfo("完成", f"已恢复 {count} 个文件。\n\n{target}")
        except Exception as exc:
            logger.error("恢复 AI 文件失败", exc_info=True)
            self._task_error("恢复 AI 文件失败", exc)

    def _write_patch_files(self, files, target_dir):
        target_dir.mkdir(parents=True, exist_ok=True)
        target_root = target_dir.resolve()

        for rel_path, content in files.items():
            full = (target_root / rel_path).resolve()
            try:
                full.relative_to(target_root)
            except ValueError:
                raise ValueError(f"非法文件路径：{rel_path}")

            full.parent.mkdir(parents=True, exist_ok=True)
            full.write_text(content, encoding="utf-8", newline="\n")

        return len(files)

    def _extract_patch_zip(self):
        raw = self.ai_text.get("1.0", END)
        if not raw.strip():
            messagebox.showerror("错误", "请先粘贴 AI 返回内容。")
            return

        try:
            files = build_ai_patch(raw)
        except Exception as exc:
            self._task_error("解析 AI 输出失败", exc)
            return

        if not files:
            messagebox.showerror("错误", "没有找到有效的 ### FILE: 文件块。")
            return

        path = filedialog.asksaveasfilename(
            title="保存补丁 ZIP",
            defaultextension=".zip",
            initialfile="ai_patch.zip",
            filetypes=[("ZIP files", "*.zip")],
        )
        if not path:
            return

        try:
            count = self._create_patch_zip(files, Path(path))
            open_folder(Path(path).parent)
            self._set_status(f"补丁 ZIP 已生成：{path}")
            messagebox.showinfo("完成", f"已打包 {count} 个修改文件。\n\n{path}")
        except Exception as exc:
            logger.error("生成补丁 ZIP 失败", exc_info=True)
            self._task_error("生成补丁 ZIP 失败", exc)

    def _create_patch_zip(self, files, zip_path: Path):
        temp = Path(os.environ.get("TEMP", ".")) / f"ZipToTxt_patch_{os.getpid()}"
        if temp.exists():
            import shutil
            shutil.rmtree(temp, ignore_errors=True)

        try:
            count = self._write_patch_files(files, temp)
            import zipfile
            zip_path.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for path in temp.rglob("*"):
                    if path.is_file():
                        zf.write(path, path.relative_to(temp).as_posix())
            return count
        finally:
            import shutil
            shutil.rmtree(temp, ignore_errors=True)

    def _update_progress(self, current, total):
        def update():
            self.progress.configure(maximum=max(total, 1), value=current)
        self.after(0, update)

    def _set_status(self, message):
        self.after(0, lambda: self.status_var.set(f"状态：{message}"))

    def _task_error(self, title, exc):
        self._set_status("处理失败")
        messagebox.showerror(title, str(exc))


if __name__ == "__main__":
    App().mainloop()
