#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZipToTxt - Professional Desktop Workspace (PySide6 Light/Dark Edition)
Supports ZIP to TXT context extraction, Multi-Model Token Estimation,
and AI Markdown code patch generation.
"""

import os
import sys
import tempfile
import time
from typing import Optional, List, Dict, Any

from PySide6.QtCore import Qt, QThread, Signal, QSize, QUrl, QTimer
from PySide6.QtGui import (
    QIcon, QFont, QColor, QPalette, QDragEnterEvent, QDropEvent,
    QClipboard, QAction, QPixmap, QTextCursor
)
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QTextEdit, QPlainTextEdit,
    QCheckBox, QFileDialog, QMessageBox, QTabWidget, QSplitter,
    QProgressBar, QFrame, QScrollArea, QTableWidget, QTableWidgetItem,
    QHeaderView, QGroupBox, QStatusBar, QSizePolicy, QStyle, QComboBox
)

from core import (
    normalize_ai_path,
    is_safe_relative_path,
    is_sensitive_path,
    is_text_file,
    estimate_tokens_detailed,
    safe_extract_zip,
    scan_and_format_repo,
    parse_ai_output,
    create_patch_zip,
    write_parsed_files_to_dir,
    generate_ascii_tree,
    SecurityError,
    ZipSecurityConfig,
    AI_PRIMARY_PROMPT,
    AI_AUDIT_PROMPT_CN,
    AI_CONTINUE_PROMPT
)

def get_resource_path(filename: str) -> str:
    """Get absolute path to resource, works for dev and for PyInstaller bundle."""
    if hasattr(sys, '_MEIPASS'):
        bundle_path = getattr(sys, '_MEIPASS')
        target = os.path.join(bundle_path, filename)
        if os.path.exists(target):
            return target
    base_dir = os.path.abspath(os.path.dirname(__file__))
    target = os.path.join(base_dir, filename)
    if os.path.exists(target):
        return target
    pub_target = os.path.join(base_dir, 'public', filename)
    if os.path.exists(pub_target):
        return pub_target
    return filename


# ==========================================
# Theme Definitions (Light by Default + Dark Mode)
# ==========================================

LIGHT_THEME_QSS = """
QMainWindow {
    background-color: #f8fafc;
    color: #0f172a;
}
QWidget {
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
}
QTabWidget::pane {
    border: 1px solid #e2e8f0;
    background: #ffffff;
    border-radius: 8px;
    top: -1px;
}
QTabBar::tab {
    background: #f1f5f9;
    color: #475569;
    padding: 10px 22px;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    margin-right: 4px;
    font-weight: 500;
    border: 1px solid #e2e8f0;
    border-bottom: none;
}
QTabBar::tab:selected {
    background: #ffffff;
    color: #4f46e5;
    border-bottom: 2px solid #4f46e5;
    font-weight: 600;
}
QTabBar::tab:hover:!selected {
    background: #e2e8f0;
    color: #0f172a;
}
#DropArea {
    border: 2px dashed #cbd5e1;
    background-color: #f8fafc;
    border-radius: 12px;
}
#DropArea:hover {
    border-color: #6366f1;
    background-color: #f5f3ff;
}
QGroupBox {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-top: 14px;
    padding-top: 16px;
    font-weight: 600;
    color: #334155;
    background: #ffffff;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    left: 12px;
    color: #4f46e5;
}
QLineEdit, QTextEdit, QPlainTextEdit {
    background-color: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px;
    color: #0f172a;
    selection-background-color: #4f46e5;
    selection-color: #ffffff;
}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {
    border: 1.5px solid #4f46e5;
}
QPushButton {
    background-color: #f1f5f9;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 500;
}
QPushButton:hover {
    background-color: #e2e8f0;
    border-color: #94a3b8;
}
QPushButton:pressed {
    background-color: #cbd5e1;
}
QPushButton#PrimaryButton {
    background-color: #4f46e5;
    border: 1px solid #4338ca;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#PrimaryButton:hover {
    background-color: #4338ca;
}
QPushButton#PrimaryButton:pressed {
    background-color: #3730a3;
}
QPushButton#SuccessButton {
    background-color: #059669;
    border: 1px solid #047857;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#SuccessButton:hover {
    background-color: #047857;
}
QTableWidget {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    gridline-color: #f1f5f9;
    color: #0f172a;
}
QHeaderView::section {
    background-color: #f8fafc;
    color: #475569;
    padding: 8px;
    border: 1px solid #e2e8f0;
    font-weight: 600;
}
QProgressBar {
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    text-align: center;
    background-color: #f1f5f9;
    color: #0f172a;
}
QProgressBar::chunk {
    background-color: #4f46e5;
    border-radius: 3px;
}
QStatusBar {
    background-color: #ffffff;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
}
QCheckBox {
    spacing: 8px;
    color: #334155;
}
QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
}
QCheckBox::indicator:checked {
    background: #4f46e5;
    border-color: #4338ca;
}
QComboBox {
    background-color: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 12px;
    color: #0f172a;
}
QComboBox:focus {
    border: 1.5px solid #4f46e5;
}
"""

DARK_THEME_QSS = """
QMainWindow {
    background-color: #0f172a;
    color: #f8fafc;
}
QWidget {
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
}
QTabWidget::pane {
    border: 1px solid #1e293b;
    background: #0f172a;
    border-radius: 8px;
    top: -1px;
}
QTabBar::tab {
    background: #1e293b;
    color: #94a3b8;
    padding: 10px 22px;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    margin-right: 4px;
    font-weight: 500;
}
QTabBar::tab:selected {
    background: #334155;
    color: #ffffff;
    border-bottom: 2px solid #6366f1;
    font-weight: 600;
}
QTabBar::tab:hover:!selected {
    background: #283548;
    color: #cbd5e1;
}
#DropArea {
    border: 2px dashed #334155;
    background-color: #1e293b;
    border-radius: 12px;
}
#DropArea:hover {
    border-color: #475569;
    background-color: #243044;
}
QGroupBox {
    border: 1px solid #334155;
    border-radius: 8px;
    margin-top: 14px;
    padding-top: 16px;
    font-weight: 600;
    color: #cbd5e1;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    left: 12px;
    color: #818cf8;
}
QLineEdit, QTextEdit, QPlainTextEdit {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 8px;
    color: #f8fafc;
    selection-background-color: #6366f1;
}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {
    border: 1px solid #6366f1;
}
QPushButton {
    background-color: #334155;
    color: #f8fafc;
    border: 1px solid #475569;
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 500;
}
QPushButton:hover {
    background-color: #475569;
}
QPushButton:pressed {
    background-color: #1e293b;
}
QPushButton#PrimaryButton {
    background-color: #4f46e5;
    border: 1px solid #6366f1;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#PrimaryButton:hover {
    background-color: #6366f1;
}
QPushButton#PrimaryButton:pressed {
    background-color: #4338ca;
}
QPushButton#SuccessButton {
    background-color: #059669;
    border: 1px solid #10b981;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#SuccessButton:hover {
    background-color: #10b981;
}
QTableWidget {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    gridline-color: #334155;
    color: #f8fafc;
}
QHeaderView::section {
    background-color: #0f172a;
    color: #94a3b8;
    padding: 6px;
    border: 1px solid #334155;
    font-weight: 600;
}
QProgressBar {
    border: 1px solid #334155;
    border-radius: 4px;
    text-align: center;
    background-color: #1e293b;
    color: #f8fafc;
}
QProgressBar::chunk {
    background-color: #6366f1;
    border-radius: 3px;
}
QStatusBar {
    background-color: #0b1120;
    color: #94a3b8;
    border-top: 1px solid #1e293b;
}
QCheckBox {
    spacing: 8px;
    color: #e2e8f0;
}
QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid #475569;
    background: #1e293b;
}
QCheckBox::indicator:checked {
    background: #6366f1;
    border-color: #818cf8;
}
QComboBox {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 12px;
    color: #f8fafc;
}
"""


# ==========================================
# Background Workers for Non-Blocking Operations
# ==========================================

class ExportWorker(QThread):
    finished_signal = Signal(dict)
    error_signal = Signal(str)
    progress_signal = Signal(str)

    def __init__(self, zip_path: str, base64_binaries: bool, exclude_patterns: List[str], prompt_template: str):
        super().__init__()
        self.zip_path = zip_path
        self.base64_binaries = base64_binaries
        self.exclude_patterns = exclude_patterns
        self.prompt_template = prompt_template

    def run(self):
        start_time = time.time()
        temp_dir = tempfile.mkdtemp(prefix="ziptotxt_export_")
        try:
            self.progress_signal.emit("正在安全解压 ZIP 仓库...")
            extract_dir, extracted_files = safe_extract_zip(self.zip_path, temp_dir)

            self.progress_signal.emit(f"正在扫描并构建代码树 (共 {len(extracted_files)} 个文件)...")
            txt_content, files_info = scan_and_format_repo(
                extract_dir,
                base64_binaries=self.base64_binaries,
                exclude_patterns=self.exclude_patterns
            )

            ascii_tree = generate_ascii_tree(extract_dir, exclude_patterns=self.exclude_patterns)
            
            # Combine custom prompt template with code context
            full_prompt_txt = f"{self.prompt_template.strip()}\n\n{txt_content}"

            # Accurate multi-model token estimation
            token_stats = estimate_tokens_detailed(full_prompt_txt)
            elapsed = time.time() - start_time

            total_lines = sum(f.get('lines', 0) for f in files_info if f.get('is_text'))
            text_count = sum(1 for f in files_info if f.get('is_text'))
            bin_count = len(files_info) - text_count

            result = {
                "txt_content": full_prompt_txt,
                "raw_repo_content": txt_content,
                "ascii_tree": ascii_tree,
                "files_info": files_info,
                "total_files": len(files_info),
                "text_count": text_count,
                "bin_count": bin_count,
                "total_lines": total_lines,
                "token_stats": token_stats,
                "elapsed": elapsed,
                "source_zip": self.zip_path
            }
            self.finished_signal.emit(result)

        except Exception as e:
            self.error_signal.emit(str(e))
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


class ImportWorker(QThread):
    finished_signal = Signal(dict)
    error_signal = Signal(str)

    def __init__(self, raw_markdown: str):
        super().__init__()
        self.raw_markdown = raw_markdown

    def run(self):
        try:
            parsed = parse_ai_output(self.raw_markdown)
            self.finished_signal.emit(parsed)
        except Exception as e:
            self.error_signal.emit(str(e))


# ==========================================
# Custom UI Components
# ==========================================

class DropArea(QFrame):
    fileDropped = Signal(str)

    def __init__(self, title: str, subtitle: str, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.setObjectName("DropArea")
        self.is_hovered = False

        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignCenter)
        layout.setContentsMargins(20, 24, 20, 24)
        layout.setSpacing(8)

        self.icon_label = QLabel("📥")
        self.icon_label.setStyleSheet("font-size: 32px; background: transparent;")
        self.icon_label.setAlignment(Qt.AlignCenter)

        self.title_label = QLabel(title)
        self.title_label.setStyleSheet("font-size: 15px; font-weight: 600; background: transparent;")
        self.title_label.setAlignment(Qt.AlignCenter)

        self.subtitle_label = QLabel(subtitle)
        self.subtitle_label.setStyleSheet("font-size: 12px; color: #64748b; background: transparent;")
        self.subtitle_label.setAlignment(Qt.AlignCenter)

        layout.addWidget(self.icon_label)
        layout.addWidget(self.title_label)
        layout.addWidget(self.subtitle_label)

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls() or event.mimeData().hasText():
            event.acceptProposedAction()
            self.setStyleSheet("""
                #DropArea {
                    border: 2px dashed #4f46e5;
                    background-color: rgba(79, 70, 229, 0.08);
                    border-radius: 12px;
                }
            """)

    def dragLeaveEvent(self, event):
        self.setStyleSheet("")

    def dropEvent(self, event: QDropEvent):
        self.setStyleSheet("")
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls:
                file_path = urls[0].toLocalFile()
                if file_path:
                    self.fileDropped.emit(file_path)
                    event.acceptProposedAction()
        elif event.mimeData().hasText():
            text = event.mimeData().text()
            if os.path.isfile(text.strip()):
                self.fileDropped.emit(text.strip())
                event.acceptProposedAction()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.fileDropped.emit("__CLICK__")


# ==========================================
# Main Window Application
# ==========================================

class ZipToTxtMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ZipToTxt · AI Code Workspace (v3.2.0)")
        self.setMinimumSize(1060, 720)
        self.resize(1180, 800)
        self.setAcceptDrops(True)

        self.is_dark_theme = False

        # State storage
        self.last_export_data: Optional[Dict] = None
        self.last_parsed_files: Optional[Dict] = None

        self.setup_app_icon()
        self.apply_theme()
        self.init_ui()

    def setup_app_icon(self):
        ico_path = get_resource_path("app.ico")
        png_path = get_resource_path("app_icon.png")
        if os.path.exists(ico_path):
            self.setWindowIcon(QIcon(ico_path))
        elif os.path.exists(png_path):
            self.setWindowIcon(QIcon(png_path))

    def apply_theme(self):
        if self.is_dark_theme:
            self.setStyleSheet(DARK_THEME_QSS)
        else:
            self.setStyleSheet(LIGHT_THEME_QSS)

    def toggle_theme(self):
        self.is_dark_theme = not self.is_dark_theme
        self.apply_theme()
        if hasattr(self, 'btn_theme_toggle'):
            self.btn_theme_toggle.setText("🌙 切换为深色模式" if not self.is_dark_theme else "☀️ 切换为浅色模式")

    def init_ui(self):
        central = QWidget(self)
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(16, 14, 16, 8)
        main_layout.setSpacing(10)

        # Top Header Bar (Title & Theme Toggle)
        header_bar = QHBoxLayout()
        header_title = QLabel("⚡ ZipToTxt · 工业级 AI 代码上下文与补丁工作台")
        header_title.setStyleSheet("font-size: 16px; font-weight: 700; color: #4f46e5;")
        header_bar.addWidget(header_title)
        header_bar.addStretch()

        self.btn_theme_toggle = QPushButton("🌙 切换为深色模式")
        self.btn_theme_toggle.clicked.connect(self.toggle_theme)
        header_bar.addWidget(self.btn_theme_toggle)
        main_layout.addLayout(header_bar)

        # Tab Widget
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)

        # Tabs creation
        self.tab_export = QWidget()
        self.tab_import = QWidget()
        self.tab_security = QWidget()
        self.tab_help = QWidget()

        self.setup_export_tab()
        self.setup_import_tab()
        self.setup_security_tab()
        self.setup_help_tab()

        self.tabs.addTab(self.tab_export, "📦 01 · 仓库导出 TXT")
        self.tabs.addTab(self.tab_import, "🧩 02 · AI 补丁还原 ZIP")
        self.tabs.addTab(self.tab_security, "🛡️ 03 · 安全防护审计")
        self.tabs.addTab(self.tab_help, "📖 04 · 使用说明与规范")

        # Progress bar (Hidden by default)
        self.progress_bar = QProgressBar()
        self.progress_bar.setFixedHeight(6)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.hide()
        main_layout.addWidget(self.progress_bar)

        # Status Bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪 · 浅色明亮现代主题与高精度 Token 引擎已启用")

    # ==========================================
    # Global Drag & Drop Handler
    # ==========================================

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        urls = event.mimeData().urls()
        if not urls:
            return
        file_path = urls[0].toLocalFile()
        if not file_path:
            return

        if file_path.lower().endswith('.zip'):
            self.export_path_input.setText(file_path)
            self.tabs.setCurrentWidget(self.tab_export)
            self.status_bar.showMessage(f"已载入 ZIP: {os.path.basename(file_path)}")
            self.run_export_scan()
        elif file_path.lower().endswith(('.txt', '.md', '.patch')):
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                self.import_input.setPlainText(content)
                self.tabs.setCurrentWidget(self.tab_import)
                self.status_bar.showMessage(f"已载入 AI 补丁文本: {os.path.basename(file_path)}")
                self.run_import_parse()
            except Exception as e:
                QMessageBox.warning(self, "读取错误", f"无法读取文件: {e}")

    # ==========================================
    # Tab 1: Export Tab Setup
    # ==========================================

    def setup_export_tab(self):
        layout = QVBoxLayout(self.tab_export)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(10)

        # Top Drag & Drop Area
        self.export_drop_area = DropArea(
            "拖拽 GitHub / 项目 ZIP 压缩包到此处",
            "或点击此处选择本地文件 (支持自动递归扫描、ASCII 树构建与多模型 Token 精确估算)"
        )
        self.export_drop_area.fileDropped.connect(self.on_export_file_dropped)
        layout.addWidget(self.export_drop_area)

        # File Selection & Options Bar
        opts_box = QFrame()
        opts_box.setStyleSheet("background: #f1f5f9; border-radius: 8px; padding: 6px;")
        opts_layout = QHBoxLayout(opts_box)
        opts_layout.setContentsMargins(8, 6, 8, 6)
        opts_layout.setSpacing(10)

        opts_layout.addWidget(QLabel("目标 ZIP 路径:"))
        self.export_path_input = QLineEdit()
        self.export_path_input.setPlaceholderText("请选择或拖入 .zip 仓库文件...")
        opts_layout.addWidget(self.export_path_input, 1)

        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self.browse_export_zip)
        opts_layout.addWidget(browse_btn)

        opts_layout.addWidget(QLabel("Prompt 模式:"))
        self.prompt_combo = QComboBox()
        self.prompt_combo.addItems([
            "🎯 需求研发与改动",
            "🛡️ 工业级生产安全审计",
            "🐛 Bugfix 缺陷修复",
            "⚡ 纯代码上下文 (无前言)"
        ])
        opts_layout.addWidget(self.prompt_combo)

        self.chk_base64 = QCheckBox("Base64 嵌入二进制")
        opts_layout.addWidget(self.chk_base64)

        self.btn_run_export = QPushButton("🚀 开始解析生成 TXT")
        self.btn_run_export.setObjectName("PrimaryButton")
        self.btn_run_export.clicked.connect(self.run_export_scan)
        opts_layout.addWidget(self.btn_run_export)

        layout.addWidget(opts_box)

        # Token & Metrics Banner
        self.stats_banner = QFrame()
        self.stats_banner.setStyleSheet("background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;")
        stats_layout = QHBoxLayout(self.stats_banner)
        stats_layout.setContentsMargins(12, 6, 12, 6)
        stats_layout.setSpacing(16)

        self.stat_files_lbl = QLabel("📁 文件数: 0")
        self.stat_lines_lbl = QLabel("📝 代码行: 0")
        self.stat_gpt_lbl = QLabel("🤖 GPT-4o: ~0")
        self.stat_claude_lbl = QLabel("🧠 Claude 3.5: ~0")
        self.stat_deepseek_lbl = QLabel("⚡ DeepSeek: ~0")

        for lbl in [self.stat_files_lbl, self.stat_lines_lbl, self.stat_gpt_lbl, self.stat_claude_lbl, self.stat_deepseek_lbl]:
            lbl.setStyleSheet("color: #334155; font-weight: 500;")
            stats_layout.addWidget(lbl)
        stats_layout.addStretch()

        self.btn_copy_prompt = QPushButton("📋 一键复制完整 Prompt")
        self.btn_copy_prompt.clicked.connect(self.copy_export_prompt)
        self.btn_save_txt = QPushButton("💾 保存为 .txt 文件")
        self.btn_save_txt.setObjectName("SuccessButton")
        self.btn_save_txt.clicked.connect(self.save_export_txt)

        self.btn_copy_prompt.setEnabled(False)
        self.btn_save_txt.setEnabled(False)

        stats_layout.addWidget(self.btn_copy_prompt)
        stats_layout.addWidget(self.btn_save_txt)
        layout.addWidget(self.stats_banner)

        # Content Splitter (ASCII Tree vs TXT Preview)
        splitter = QSplitter(Qt.Horizontal)

        # Left: ASCII Tree
        tree_widget = QWidget()
        tree_layout = QVBoxLayout(tree_widget)
        tree_layout.setContentsMargins(0, 0, 0, 0)
        tree_layout.addWidget(QLabel("🌲 仓库目录树 (ASCII Tree):"))
        self.ascii_tree_text = QPlainTextEdit()
        self.ascii_tree_text.setReadOnly(True)
        self.ascii_tree_text.setFont(QFont("Consolas", 10))
        tree_layout.addWidget(self.ascii_tree_text)
        splitter.addWidget(tree_widget)

        # Right: Full TXT Preview
        preview_widget = QWidget()
        preview_layout = QVBoxLayout(preview_widget)
        preview_layout.setContentsMargins(0, 0, 0, 0)
        preview_layout.addWidget(QLabel("📄 完整 TXT 导出预览 (已自动装配 AI 结构化 Prompt):"))
        self.export_preview_text = QPlainTextEdit()
        self.export_preview_text.setReadOnly(True)
        self.export_preview_text.setFont(QFont("Consolas", 10))
        preview_layout.addWidget(self.export_preview_text)
        splitter.addWidget(preview_widget)

        splitter.setSizes([340, 660])
        layout.addWidget(splitter, 1)

    def on_export_file_dropped(self, val: str):
        if val == "__CLICK__":
            self.browse_export_zip()
        else:
            self.export_path_input.setText(val)
            self.run_export_scan()

    def browse_export_zip(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "选择 GitHub / 项目 ZIP 压缩包", "", "ZIP 压缩文件 (*.zip);;所有文件 (*.*)"
        )
        if path:
            self.export_path_input.setText(path)
            self.run_export_scan()

    def get_selected_prompt_template(self) -> str:
        idx = self.prompt_combo.currentIndex()
        if idx == 0:
            return AI_PRIMARY_PROMPT
        elif idx == 1:
            return AI_AUDIT_PROMPT_CN
        elif idx == 2:
            return "Please review this codebase, identify all bugs and defects, and provide complete fixed files using ### FILE: path/to/file.ext format."
        else:
            return ""

    def run_export_scan(self):
        zip_path = self.export_path_input.text().strip()
        if not zip_path:
            QMessageBox.warning(self, "提示", "请先选择或拖入 ZIP 压缩包！")
            return
        if not os.path.isfile(zip_path):
            QMessageBox.warning(self, "错误", f"找不到文件: {zip_path}")
            return

        self.btn_run_export.setEnabled(False)
        self.progress_bar.setRange(0, 0)
        self.progress_bar.show()
        self.status_bar.showMessage("正在解析仓库并进行精确 Token 估算中...")

        prompt_tpl = self.get_selected_prompt_template()

        self.export_worker = ExportWorker(
            zip_path,
            base64_binaries=self.chk_base64.isChecked(),
            exclude_patterns=[],
            prompt_template=prompt_tpl
        )
        self.export_worker.progress_signal.connect(self.status_bar.showMessage)
        self.export_worker.finished_signal.connect(self.on_export_success)
        self.export_worker.error_signal.connect(self.on_export_error)
        self.export_worker.start()

    def on_export_success(self, data: dict):
        self.progress_bar.hide()
        self.btn_run_export.setEnabled(True)
        self.last_export_data = data

        self.ascii_tree_text.setPlainText(data["ascii_tree"])
        self.export_preview_text.setPlainText(data["txt_content"])

        t_stats = data["token_stats"]

        self.stat_files_lbl.setText(f"📁 文件数: {data['total_files']} (文本 {data['text_count']}, 二进制 {data['bin_count']})")
        self.stat_lines_lbl.setText(f"📝 代码行: {data['total_lines']:,}")
        self.stat_gpt_lbl.setText(f"🤖 GPT-4o: ~{t_stats['gpt4o_tokens']:,} ({t_stats['context_usage']['gpt128k']}% of 128k)")
        self.stat_claude_lbl.setText(f"🧠 Claude: ~{t_stats['claude_tokens']:,} ({t_stats['context_usage']['claude200k']}% of 200k)")
        self.stat_deepseek_lbl.setText(f"⚡ DeepSeek: ~{t_stats['deepseek_tokens']:,}")

        self.btn_copy_prompt.setEnabled(True)
        self.btn_save_txt.setEnabled(True)
        self.status_bar.showMessage(f"解析成功！共导出 {data['total_files']} 个文件 (~{t_stats['gpt4o_tokens']:,} Tokens)")

    def on_export_error(self, err_msg: str):
        self.progress_bar.hide()
        self.btn_run_export.setEnabled(True)
        QMessageBox.critical(self, "导出失败", f"处理 ZIP 失败:\n{err_msg}")
        self.status_bar.showMessage("处理失败")

    def copy_export_prompt(self):
        if not self.last_export_data:
            return
        clipboard = QApplication.clipboard()
        clipboard.setText(self.last_export_data["txt_content"])
        self.status_bar.showMessage("已复制完整 Prompt 与仓库上下文到剪贴板！可以直接发送给大模型。")
        QMessageBox.information(self, "复制成功", "完整 Prompt 及代码上下文已复制到剪贴板！\n可以直接粘贴到 ChatGPT / Claude / Gemini / DeepSeek 中。")

    def save_export_txt(self):
        if not self.last_export_data:
            return
        default_name = os.path.splitext(os.path.basename(self.last_export_data["source_zip"]))[0] + "_context.txt"
        save_path, _ = QFileDialog.getSaveFileName(self, "保存结构化 TXT 文件", default_name, "文本文件 (*.txt);;所有文件 (*.*)")
        if save_path:
            try:
                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(self.last_export_data["txt_content"])
                self.status_bar.showMessage(f"已保存: {save_path}")
                QMessageBox.information(self, "保存成功", f"文件已保存至:\n{save_path}")
            except Exception as e:
                QMessageBox.critical(self, "保存失败", f"无法写入文件:\n{e}")

    # ==========================================
    # Tab 2: Import & Patch Setup
    # ==========================================

    def setup_import_tab(self):
        layout = QVBoxLayout(self.tab_import)
        layout.setContentsMargins(14, 14, 14, 14)
        layout.setSpacing(10)

        # Top instruction
        top_bar = QHBoxLayout()
        top_bar.addWidget(QLabel("在此粘贴大语言模型 (AI) 返回的完整 Markdown 响应文本，或拖入包含回答的文本文件:"))
        top_bar.addStretch()

        self.btn_load_sample = QPushButton("📝 载入示例代码")
        self.btn_load_sample.clicked.connect(self.load_import_sample)
        top_bar.addWidget(self.btn_load_sample)

        self.btn_clear_import = QPushButton("🗑️ 清空")
        self.btn_clear_import.clicked.connect(lambda: self.import_input.clear())
        top_bar.addWidget(self.btn_clear_import)
        layout.addLayout(top_bar)

        # Splitter: Input vs Parsed Results
        splitter = QSplitter(Qt.Vertical)

        # Upper: Input area
        self.import_input = QPlainTextEdit()
        self.import_input.setPlaceholderText("粘贴 AI 输出内容（包含形如 ### FILE: path/to/file.ext 或 **FILE:** path 的 Markdown 围栏）...")
        self.import_input.setFont(QFont("Consolas", 10))
        splitter.addWidget(self.import_input)

        # Action Bar in Middle
        mid_bar = QFrame()
        mid_bar.setStyleSheet("background: #f1f5f9; border-radius: 8px; padding: 4px;")
        mid_layout = QHBoxLayout(mid_bar)
        mid_layout.setContentsMargins(8, 4, 8, 4)

        self.btn_parse_import = QPushButton("⚡ 解析 AI 变更文件")
        self.btn_parse_import.setObjectName("PrimaryButton")
        self.btn_parse_import.clicked.connect(self.run_import_parse)
        mid_layout.addWidget(self.btn_parse_import)

        self.lbl_parsed_status = QLabel("尚未解析")
        self.lbl_parsed_status.setStyleSheet("color: #64748b;")
        mid_layout.addWidget(self.lbl_parsed_status, 1)

        self.btn_download_patch = QPushButton("📦 一键生成 patch.zip 补丁包")
        self.btn_download_patch.setObjectName("SuccessButton")
        self.btn_download_patch.setEnabled(False)
        self.btn_download_patch.clicked.connect(self.save_patch_zip)
        mid_layout.addWidget(self.btn_download_patch)

        self.btn_apply_folder = QPushButton("📂 直接应用到本地项目目录")
        self.btn_apply_folder.setEnabled(False)
        self.btn_apply_folder.clicked.connect(self.apply_to_local_directory)
        mid_layout.addWidget(self.btn_apply_folder)

        # Lower: Parsed Files Table & Code Viewer Splitter
        lower_splitter = QSplitter(Qt.Horizontal)

        # Left: Table
        self.parsed_table = QTableWidget(0, 3)
        self.parsed_table.setHorizontalHeaderLabels(["状态", "相对路径", "代码行数"])
        self.parsed_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.parsed_table.itemSelectionChanged.connect(self.on_table_file_selected)
        lower_splitter.addWidget(self.parsed_table)

        # Right: Code Viewer
        self.code_viewer = QPlainTextEdit()
        self.code_viewer.setReadOnly(True)
        self.code_viewer.setFont(QFont("Consolas", 10))
        self.code_viewer.setPlaceholderText("在左侧表格选择文件以实时预览代码...")
        lower_splitter.addWidget(self.code_viewer)

        lower_splitter.setSizes([450, 550])

        lower_container = QWidget()
        lower_layout = QVBoxLayout(lower_container)
        lower_layout.setContentsMargins(0, 0, 0, 0)
        lower_layout.addWidget(mid_bar)
        lower_layout.addWidget(lower_splitter, 1)

        splitter.addWidget(lower_container)
        splitter.setSizes([260, 420])
        layout.addWidget(splitter, 1)

    def load_import_sample(self):
        sample = (
            "这里是为你重构和新增的代码模块：\n\n"
            "### FILE: src/core/engine.py\n"
            "```python\n"
            "import os\n"
            "import sys\n\n"
            "class Engine:\n"
            "    def __init__(self, name: str):\n"
            "        self.name = name\n\n"
            "    def start(self):\n"
            "        print(f'Engine {self.name} is running smoothly!')\n"
            "```\n\n"
            "### FILE: config/app_settings.json\n"
            "```json\n"
            "{\n"
            '  "appName": "ZipToTxt",\n'
            '  "version": "3.2.0",\n'
            '  "debug": false\n'
            "}\n"
            "```\n\n"
            "修改完成，请核对！"
        )
        self.import_input.setPlainText(sample)
        self.run_import_parse()

    def run_import_parse(self):
        text = self.import_input.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "提示", "请先输入 AI 的 Markdown 响应内容！")
            return

        self.btn_parse_import.setEnabled(False)
        self.worker_import = ImportWorker(text)
        self.worker_import.finished_signal.connect(self.on_import_parse_success)
        self.worker_import.error_signal.connect(self.on_import_parse_error)
        self.worker_import.start()

    def on_import_parse_success(self, parsed: dict):
        self.btn_parse_import.setEnabled(True)
        self.last_parsed_files = parsed
        files = parsed.get("files", {})

        self.parsed_table.setRowCount(0)
        if not files:
            self.lbl_parsed_status.setText("⚠️ 未识别到符合规范的 ### FILE: 标记")
            self.btn_download_patch.setEnabled(False)
            self.btn_apply_folder.setEnabled(False)
            QMessageBox.warning(
                self, "未找到文件",
                "未能从文本中提取到任何有效代码块！\n\n请确保 AI 输出包含以下标记：\n### FILE: path/to/file.ext\n```language\n代码正文\n```"
            )
            return

        self.lbl_parsed_status.setText(f"✅ 成功解析出 {len(files)} 个改动文件")
        self.btn_download_patch.setEnabled(True)
        self.btn_apply_folder.setEnabled(True)

        for row, (rel_path, content) in enumerate(files.items()):
            self.parsed_table.insertRow(row)
            is_sens = is_sensitive_path(rel_path)
            lines = len(content.splitlines())

            status_text = "🔒 敏感" if is_sens else "✏️ 改动"
            status_item = QTableWidgetItem(status_text)
            if is_sens:
                status_item.setForeground(QColor("#ef4444"))
            else:
                status_item.setForeground(QColor("#10b981"))

            path_item = QTableWidgetItem(rel_path)
            lines_item = QTableWidgetItem(f"{lines:,} 行")

            self.parsed_table.setItem(row, 0, status_item)
            self.parsed_table.setItem(row, 1, path_item)
            self.parsed_table.setItem(row, 2, lines_item)

        self.parsed_table.selectRow(0)
        self.status_bar.showMessage(f"解析完成，共识别到 {len(files)} 个待打补丁文件")

    def on_import_parse_error(self, err: str):
        self.btn_parse_import.setEnabled(True)
        QMessageBox.critical(self, "解析出错", f"解析失败:\n{err}")

    def on_table_file_selected(self):
        if not self.last_parsed_files:
            return
        selected = self.parsed_table.selectedItems()
        if not selected:
            return
        row = self.parsed_table.currentRow()
        rel_path = self.parsed_table.item(row, 1).text()
        content = self.last_parsed_files.get("files", {}).get(rel_path, "")
        self.code_viewer.setPlainText(content)

    def save_patch_zip(self):
        if not self.last_parsed_files or not self.last_parsed_files.get("files"):
            return
        save_path, _ = QFileDialog.getSaveFileName(self, "保存补丁压缩包", "patch.zip", "ZIP 压缩文件 (*.zip)")
        if save_path:
            try:
                create_patch_zip(self.last_parsed_files["files"], save_path)
                self.status_bar.showMessage(f"补丁已生成: {save_path}")
                QMessageBox.information(
                    self, "补丁打包成功",
                    f"已生成只包含 AI 改动文件的纯净补丁包：\n{save_path}\n\n可以直接解压覆盖到您的目标项目根目录！"
                )
            except Exception as e:
                QMessageBox.critical(self, "打包失败", f"无法生成 patch.zip:\n{e}")

    def apply_to_local_directory(self):
        if not self.last_parsed_files or not self.last_parsed_files.get("files"):
            return
        target_dir = QFileDialog.getExistingDirectory(self, "选择本地项目根目录以应用补丁")
        if target_dir:
            reply = QMessageBox.question(
                self, "确认覆盖",
                f"将写入 {len(self.last_parsed_files['files'])} 个文件到目录：\n{target_dir}\n\n确定执行覆写操作吗？",
                QMessageBox.Yes | QMessageBox.No, QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                try:
                    write_parsed_files_to_dir(self.last_parsed_files["files"], target_dir)
                    self.status_bar.showMessage(f"补丁已成功应用至: {target_dir}")
                    QMessageBox.information(self, "写入完成", "所有改动文件已精确写回本地项目目录！")
                except Exception as e:
                    QMessageBox.critical(self, "写入失败", f"写回本地项目失败:\n{e}")

    # ==========================================
    # Tab 3: Security Tab Setup
    # ==========================================

    def setup_security_tab(self):
        layout = QVBoxLayout(self.tab_security)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(14)

        # Overview
        header = QLabel("🛡️ 工业级自动化安全审计与防御机制")
        header.setStyleSheet("font-size: 16px; font-weight: 700; color: #4f46e5;")
        layout.addWidget(header)

        # Rules group
        rules_box = QGroupBox("主动防御拦截规则一览")
        rules_layout = QVBoxLayout(rules_box)
        rules_layout.setSpacing(10)

        rules = [
            ("💣 Zip Bomb 防御", "限制最大压缩包体积 (512 MB)、最大解压条目数 (15,000)、总解压大小上限 (1.0 GB) 与单文件上限 (256 MB)。"),
            ("🚷 Zip Slip 路径穿越拦截", "严格校验所有相对路径，拦截 ../, ..\\\\, 绝对路径前缀及 Windows 设备保留名 (CON, PRN, AUX, NUL, COM1-9 等)。"),
            ("🔗 符号链接越权拦截", "拒绝所有 Symlink/Hardlink 软硬链接，杜绝通过恶意链接逃逸读取宿主机敏感凭据。"),
            ("🔑 敏感文件过滤与警示", "自动检测并保护 .git, .env*, id_rsa, keystore.jks, *.pem, *.p12 等私钥证书文件。")
        ]

        for title, desc in rules:
            card = QFrame()
            card.setStyleSheet("background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;")
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(8, 6, 8, 6)
            card_layout.setSpacing(4)
            t_lbl = QLabel(title)
            t_lbl.setStyleSheet("font-weight: 600; color: #4f46e5;")
            d_lbl = QLabel(desc)
            d_lbl.setStyleSheet("color: #64748b;")
            card_layout.addWidget(t_lbl)
            card_layout.addWidget(d_lbl)
            rules_layout.addWidget(card)

        layout.addWidget(rules_box)

        # Live Path Tester
        tester_box = QGroupBox("🔍 实时路径安全检测器 (Interactive Path Validator)")
        tester_layout = QHBoxLayout(tester_box)
        tester_layout.addWidget(QLabel("测试相对路径:"))

        self.path_test_input = QLineEdit()
        self.path_test_input.setPlaceholderText("例如: ../etc/passwd 或 ./src/main.py 或 .env.production")
        self.path_test_input.textChanged.connect(self.on_test_path_changed)
        tester_layout.addWidget(self.path_test_input, 1)

        self.lbl_path_test_result = QLabel("请输入路径测试")
        self.lbl_path_test_result.setStyleSheet("font-weight: 600; padding: 4px 8px; border-radius: 4px;")
        tester_layout.addWidget(self.lbl_path_test_result)

        layout.addWidget(tester_box)
        layout.addStretch()

    def on_test_path_changed(self, text: str):
        text = text.strip()
        if not text:
            self.lbl_path_test_result.setText("请输入路径测试")
            self.lbl_path_test_result.setStyleSheet("color: #64748b;")
            return

        is_safe = is_safe_relative_path(text)
        is_sens = is_sensitive_path(text)

        if not is_safe:
            self.lbl_path_test_result.setText("❌ 危险: 路径穿越/非法设备名拦截")
            self.lbl_path_test_result.setStyleSheet("color: #ef4444; background: rgba(239, 68, 68, 0.1);")
        elif is_sens:
            self.lbl_path_test_result.setText("⚠️ 敏感: 包含密钥/凭证文件")
            self.lbl_path_test_result.setStyleSheet("color: #f59e0b; background: rgba(245, 158, 11, 0.1);")
        else:
            self.lbl_path_test_result.setText("✅ 安全: 允许正常读写")
            self.lbl_path_test_result.setStyleSheet("color: #10b981; background: rgba(16, 185, 129, 0.1);")

    # ==========================================
    # Tab 4: Help Tab Setup
    # ==========================================

    def setup_help_tab(self):
        layout = QVBoxLayout(self.tab_help)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        help_text = QTextEdit()
        help_text.setReadOnly(True)
        help_text.setHtml("""
        <h3 style="color: #4f46e5; margin-top: 0;">📖 ZipToTxt 核心工作流程与 Prompt 规范</h3>
        <p style="color: #334155; line-height: 1.6;">
        ZipToTxt 是专为大语言模型（Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, DeepSeek-V3 等）工程化研发设计的上下文提取与代码补丁还原工具。
        </p>

        <h4 style="color: #0284c7;">📌 第一步：导出仓库 TXT 上下文</h4>
        <ol style="color: #475569; line-height: 1.8;">
            <li>在「01 · 仓库导出 TXT」页面拖入任意 GitHub/本地 ZIP 压缩包；</li>
            <li>选择适合的 Prompt 模式（如需求研发、生产级安全审计等）；</li>
            <li>点击「🚀 开始解析生成 TXT」，程序自动生成 ASCII 树状图与多模型精确 Token 估算；</li>
            <li>点击「📋 一键复制完整 Prompt」，将导出的完整项目上下文发送给 AI。</li>
        </ol>

        <h4 style="color: #0284c7;">📌 第二步：要求 AI 遵守输出格式</h4>
        <p style="color: #475569;">
        为确保能 100% 精确生成补丁，请在 Prompt 中要求 AI 使用如下格式输出改动文件：
        </p>
        <pre style="background: #f1f5f9; color: #059669; padding: 10px; border-radius: 6px; font-family: Consolas;">
### FILE: path/to/file.ext
```language
// 完整的、可直接运行的代码内容
```
        </pre>

        <h4 style="color: #0284c7;">📌 第三步：还原 AI 补丁为 ZIP</h4>
        <ol style="color: #475569; line-height: 1.8;">
            <li>复制 AI 的回答并粘贴到「02 · AI 补丁还原 ZIP」；</li>
            <li>点击「⚡ 解析 AI 变更文件」，左侧将列出所有变更文件并支持实时代码预览；</li>
            <li>点击「📦 一键生成 patch.zip 补丁包」或「📂 直接应用到本地项目目录」。</li>
        </ol>
        """)
        layout.addWidget(help_text)


# ==========================================
# Application Entry Point
# ==========================================

def main():
    # Set Windows Process AppUserModelID for crisp taskbar icon grouping
    if sys.platform == 'win32':
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("ZipToTxt.App.Workspace.v3.2")
        except Exception:
            pass

    # Enable High DPI Scaling
    os.environ["QT_ENABLE_HIGHDPI_SCALING"] = "1"
    QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)

    app = QApplication(sys.argv)
    app.setApplicationName("ZipToTxt")
    app.setOrganizationName("ZipToTxt")

    window = ZipToTxtMainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
