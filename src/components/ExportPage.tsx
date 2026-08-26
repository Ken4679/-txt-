import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Copy,
  Download,
  Check,
  FileArchive,
  Layers,
  Sparkles,
  RefreshCw,
  FolderTree,
  Search,
  Eye,
  Filter,
  X,
  Code,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import { processZipFile } from '../utils/zipToTxt';
import {
  DEFAULT_PROMPTS,
  COMMON_IGNORE_FOLDERS,
} from '../utils/constants';
import { humanSize } from '../utils/security';
import { ZipFileEntry } from '../types';

interface ExportPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const STORAGE_KEY_PROMPTS = 'ziptotxt_custom_prompts_v1';

export const ExportPage: React.FC<ExportPageProps> = ({
  onStatusChange,
  onShowToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [includeBinary, setIncludeBinary] = useState<boolean>(false);
  const [filterIgnoredFolders, setFilterIgnoredFolders] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentFileProcessing, setCurrentFileProcessing] = useState<string>('');

  const [generatedTxt, setGeneratedTxt] = useState<string | null>(null);
  const [fileEntries, setFileEntries] = useState<ZipFileEntry[]>([]);
  const [ignoredCount, setIgnoredCount] = useState<number>(0);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [treeSearchQuery, setTreeSearchQuery] = useState<string>('');
  const [previewEntry, setPreviewEntry] = useState<ZipFileEntry | null>(null);

  // Custom Prompts State with LocalStorage persistence
  const [customPrompts, setCustomPrompts] = useState<{ [key: string]: string }>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_PROMPTS);
      if (cached) {
        return { ...DEFAULT_PROMPTS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROMPTS;
  });

  // Prompt Editor Modal State
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [editingPromptTitle, setEditingPromptTitle] = useState<string>('');
  const [editingPromptDraft, setEditingPromptDraft] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(customPrompts));
    } catch {
      // ignore
    }
  }, [customPrompts]);

  const handleOpenPromptEditor = (key: string, title: string) => {
    setEditingPromptKey(key);
    setEditingPromptTitle(title);
    setEditingPromptDraft(customPrompts[key] || DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS] || '');
  };

  const handleSaveCustomPrompt = () => {
    if (!editingPromptKey) return;
    if (!editingPromptDraft.trim()) {
      onShowToast('提示词内容不能为空', 'error');
      return;
    }
    setCustomPrompts(prev => ({
      ...prev,
      [editingPromptKey]: editingPromptDraft,
    }));
    setEditingPromptKey(null);
    onShowToast(`已保存“${editingPromptTitle}”的自定义修改`, 'success');
  };

  const handleResetPromptToDefault = (key: string, title: string) => {
    const defaultVal = DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS];
    if (!defaultVal) return;
    setCustomPrompts(prev => ({
      ...prev,
      [key]: defaultVal,
    }));
    if (editingPromptKey === key) {
      setEditingPromptDraft(defaultVal);
    }
    onShowToast(`已将“${title}”恢复为出厂默认规范`, 'info');
  };

  const handleResetAllPrompts = () => {
    setCustomPrompts(DEFAULT_PROMPTS);
    try {
      localStorage.removeItem(STORAGE_KEY_PROMPTS);
    } catch {
      // ignore
    }
    onShowToast('所有 AI 提示词均已恢复为默认标准规范', 'success');
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      onShowToast('请选择有效的 .zip 压缩文件', 'error');
      return;
    }
    setSelectedFile(file);
    setGeneratedTxt(null);
    setFileEntries([]);
    setProgress(0);
    onStatusChange(`已选择 · ${file.name}`, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartExport = async () => {
    if (!selectedFile) {
      onShowToast('请先选择或拖入 ZIP 文件', 'error');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    onStatusChange('正在安全检查并解压 ZIP…', 5);

    try {
      const result = await processZipFile(selectedFile, {
        includeBinary,
        filterIgnoredFolders,
        ignoredFolderNames: COMMON_IGNORE_FOLDERS,
        onProgress: (current, total, filename) => {
          const pct = Math.round((current / total) * 100);
          setProgress(pct);
          setCurrentFileProcessing(filename);
          onStatusChange(`正在解析 ${current}/${total} · ${filename}`, pct);
        },
      });

      setGeneratedTxt(result.txtContent);
      setFileEntries(result.entries);
      setIgnoredCount(result.ignoredCount);
      setIsProcessing(false);
      setProgress(100);
      onStatusChange(`导出完成 · 共 ${result.fileCount} 个有效文件`, 100);
      onShowToast(
        `成功生成 TXT 导出（包含 ${result.fileCount} 个源码文件${
          result.ignoredCount > 0 ? `，已过滤 ${result.ignoredCount} 个无用构建/系统文件` : ''
        }）`,
        'success'
      );
    } catch (err: any) {
      setIsProcessing(false);
      onStatusChange('处理失败', 0);
      onShowToast(err?.message || '处理 ZIP 失败，请检查文件格式与大小', 'error');
    }
  };

  const handleDownloadTxt = () => {
    if (!generatedTxt || !selectedFile) return;
    const defaultName = selectedFile.name.replace(/\.zip$/i, '') + '.txt';
    const blob = new Blob([generatedTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`已下载 ${defaultName}`, 'success');
  };

  const handleCopyTxt = async () => {
    if (!generatedTxt) return;
    try {
      await navigator.clipboard.writeText(generatedTxt);
      setCopiedType('txt');
      onShowToast('TXT 全文已复制到剪贴板', 'success');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      onShowToast('复制失败，请尝试直接下载 TXT 文件', 'error');
    }
  };

  const handleCopyPrompt = async (promptText: string, typeKey: string, promptName: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedType(typeKey);
      onShowToast(`${promptName} 已复制到剪贴板`, 'success');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      onShowToast('复制失败，请手动选择复制', 'error');
    }
  };

  const binaryCount = fileEntries.filter(f => f.isBinary).length;
  const textCount = fileEntries.length - binaryCount;
  const filteredEntries = fileEntries.filter(f =>
    f.relativePath.toLowerCase().includes(treeSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">导出仓库 (ZIP → TXT)</h2>
        <p className="text-sm text-slate-500 mt-1">
          将代码包精准转换为 AI 可直接吞吐的完整上下文 TXT。包含目录结构树、文本源码与 SHA-256 哈希。
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        id="zip-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.005]'
            : selectedFile
            ? 'border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/50'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/80 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
              selectedFile
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {selectedFile ? (
              <FileArchive className="w-7 h-7" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>

          <div>
            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900 flex items-center justify-center gap-2">
                  <span>{selectedFile.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-normal">
                    {humanSize(selectedFile.size)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  点击或拖入新文件以更换 ZIP
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-800">
                  拖入 ZIP 压缩包，或 <span className="text-indigo-600 underline decoration-indigo-300 underline-offset-2">点击浏览选择</span>
                </p>
                <p className="text-xs text-slate-400">
                  支持从 GitHub 下载的代码包，最大支持 512 MB 压缩包
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Options & Configuration Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          导出与过滤配置
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              id="filter-ignored-folders-checkbox"
              checked={filterIgnoredFolders}
              onChange={e => setFilterIgnoredFolders(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-indigo-600" />
                自动过滤无用目录与垃圾缓存
              </span>
              <span className="text-slate-500">
                自动排除 node_modules, .git, .venv, dist, __pycache__, __MACOSX 等庞大非核心文件
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              id="include-binary-checkbox"
              checked={includeBinary}
              onChange={e => setIncludeBinary(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block">
                嵌入二进制文件 Base64
              </span>
              <span className="text-slate-500">
                将图片、字体等以 Base64 写入 TXT（仅在需要 AI 直接重建多媒体资源时开启）
              </span>
            </div>
          </label>
        </div>

        {/* Progress Bar (Visible during processing) */}
        {isProcessing && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span className="truncate max-w-[80%]">
                {currentFileProcessing ? `解析中: ${currentFileProcessing}` : '正在解压...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            id="start-export-btn"
            disabled={!selectedFile || isProcessing}
            onClick={handleStartExport}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              !selectedFile || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                正在生成 TXT...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                开始生成 TXT 报告
              </>
            )}
          </button>

          {generatedTxt && (
            <>
              <button
                id="download-txt-btn"
                onClick={handleDownloadTxt}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                下载 TXT 文件
              </button>

              <button
                id="copy-txt-btn"
                onClick={handleCopyTxt}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiedType === 'txt' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    已复制 TXT
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    复制全部 TXT
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Generated Result Summary Card */}
      {generatedTxt && (
        <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Check className="w-4 h-4" />
              <span>TXT 导出已生成</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>有效源码: {fileEntries.length} 篇</span>
              {ignoredCount > 0 && <span className="text-slate-400">已过滤缓存: {ignoredCount} 个</span>}
              <span>总字符: {generatedTxt.length.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block">有效源码文件</span>
              <span className="text-lg font-bold text-slate-800">{fileEntries.length}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block">纯文本代码</span>
              <span className="text-lg font-bold text-indigo-600">{textCount}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 block">二进制文件</span>
              <span className="text-lg font-bold text-amber-600">{binaryCount}</span>
            </div>
          </div>

          {/* Directory Explorer & File Search */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                已收录文件清单 (点击可直接预览单文件内容)
              </h4>
              <div className="relative w-56">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={treeSearchQuery}
                  onChange={e => setTreeSearchQuery(e.target.value)}
                  placeholder="搜索已包含文件..."
                  className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-1">
              {filteredEntries.map(entry => (
                <div
                  key={entry.relativePath}
                  onClick={() => setPreviewEntry(entry)}
                  className="flex items-center justify-between px-2 py-1 rounded bg-white hover:bg-indigo-50 border border-slate-100 cursor-pointer text-xs group transition-colors"
                >
                  <span className="font-mono text-slate-800 truncate mr-2">
                    {entry.relativePath}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-slate-400">
                    <span>{humanSize(entry.size)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 text-slate-600">
                      {entry.isBinary ? 'Binary' : 'Text'}
                    </span>
                    <Eye className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Prompt Snippets Quick Copy & Customize Section */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              配合 AI 使用的标准 Prompt 规范
            </h3>
            <span className="text-xs text-slate-400">支持一键复制，点击右上角图标可随时微调或自定义个人专属 Prompt</span>
          </div>

          <button
            id="reset-all-prompts-btn"
            onClick={handleResetAllPrompts}
            className="text-[11px] text-slate-500 hover:text-indigo-600 px-2.5 py-1 rounded border border-slate-200 hover:border-indigo-200 bg-slate-50 hover:bg-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="将全部 4 组提示词重置为官方默认标准规范"
          >
            <RotateCcw className="w-3 h-3" />
            重置全部为默认
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Primary Prompt */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between hover:border-indigo-200 transition-all group relative">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">01 · AI 需求实现</span>
                <div className="flex items-center gap-1.5">
                  {customPrompts.primary !== DEFAULT_PROMPTS.primary && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">已自定义</span>
                  )}
                  <button
                    onClick={() => handleOpenPromptEditor('primary', '01 · AI 需求实现 Prompt')}
                    title="编辑此 Prompt"
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                规范 AI 按照标准文件块格式返回完整修改代码。
              </p>
            </div>
            <button
              id="copy-primary-prompt-btn"
              onClick={() => handleCopyPrompt(customPrompts.primary, 'primary', 'AI 主 Prompt')}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedType === 'primary' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制主 Prompt
                </>
              )}
            </button>
          </div>

          {/* Continue Prompt */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between hover:border-indigo-200 transition-all group relative">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">02 · 截断继续输出</span>
                <div className="flex items-center gap-1.5">
                  {customPrompts.continue !== DEFAULT_PROMPTS.continue && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">已自定义</span>
                  )}
                  <button
                    onClick={() => handleOpenPromptEditor('continue', '02 · 截断继续输出 Prompt')}
                    title="编辑此 Prompt"
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                当 AI 因 Token 限制截断时，指示 AI 从中断处继续无损输出。
              </p>
            </div>
            <button
              id="copy-continue-prompt-btn"
              onClick={() => handleCopyPrompt(customPrompts.continue, 'continue', '继续输出 Prompt')}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedType === 'continue' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制继续 Prompt
                </>
              )}
            </button>
          </div>

          {/* Production Audit CN */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between hover:border-indigo-300 transition-all group relative">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950">03 · 生产级审计 (中文)</span>
                <div className="flex items-center gap-1.5">
                  {customPrompts.audit_cn !== DEFAULT_PROMPTS.audit_cn && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">已自定义</span>
                  )}
                  <button
                    onClick={() => handleOpenPromptEditor('audit_cn', '03 · 生产级审计 (中文)')}
                    title="编辑自定义此 Prompt"
                    className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                首席架构师与安全审计视角：排查坏味道、内存泄漏并直接给出投产级代码。
              </p>
            </div>
            <button
              id="copy-review-cn-prompt-btn"
              onClick={() => handleCopyPrompt(customPrompts.audit_cn, 'audit_cn', '生产级审计 Prompt (中文版)')}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {copiedType === 'audit_cn' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  已复制中文审计词
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制生产审计词 (中)
                </>
              )}
            </button>
          </div>

          {/* Production Audit EN */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between hover:border-indigo-200 transition-all group relative">
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">04 · Production Audit (EN)</span>
                <div className="flex items-center gap-1.5">
                  {customPrompts.audit_en !== DEFAULT_PROMPTS.audit_en && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">已自定义</span>
                  )}
                  <button
                    onClick={() => handleOpenPromptEditor('audit_en', '04 · Production Audit (EN)')}
                    title="编辑自定义此 Prompt"
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full-spectrum security & architecture audit prompt with OWASP compliance.
              </p>
            </div>
            <button
              id="copy-review-en-prompt-btn"
              onClick={() => handleCopyPrompt(customPrompts.audit_en, 'audit_en', 'Production Audit Prompt (English)')}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedType === 'audit_en' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied EN Audit
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制审计词 (EN)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Prompt Editor & Reset Modal */}
      {editingPromptKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-xs text-white">
                  编辑与自定义提示词 · {editingPromptTitle}
                </span>
              </div>
              <button
                onClick={() => setEditingPromptKey(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 text-slate-100 flex-1 overflow-auto flex flex-col">
              <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                <span>根据您团队的标准自由增删要求，系统将自动持久化至浏览器本地缓存。</span>
                <span>字符数: {editingPromptDraft.length.toLocaleString()}</span>
              </div>
              <textarea
                value={editingPromptDraft}
                onChange={e => setEditingPromptDraft(e.target.value)}
                className="flex-1 w-full h-80 min-h-[320px] bg-slate-900/90 rounded-lg p-3 text-slate-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none selection:bg-indigo-600"
                spellCheck={false}
              />
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => handleResetPromptToDefault(editingPromptKey, editingPromptTitle)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复为出厂默认规范
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPromptKey(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCustomPrompt}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  保存此提示词
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Code className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-semibold truncate">
                  {previewEntry.relativePath}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({humanSize(previewEntry.size)})
                </span>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 text-slate-100 flex-1 overflow-auto font-mono text-xs leading-relaxed">
              {previewEntry.isBinary ? (
                <div className="text-amber-400 text-center py-10">
                  这是二进制文件 ({humanSize(previewEntry.size)})，已生成 SHA-256: {previewEntry.sha256}
                </div>
              ) : (
                <pre>{previewEntry.content}</pre>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setPreviewEntry(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
