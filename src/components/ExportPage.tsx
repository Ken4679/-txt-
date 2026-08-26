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
  CheckCheck,
  Cpu,
  MessageSquareCode,
  Zap,
} from 'lucide-react';
import { processZipFile, assemblePromptWithContext } from '../utils/zipToTxt';
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

const STORAGE_KEY_PROMPTS = 'ziptotxt_custom_prompts_v2';

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
  const [asciiTree, setAsciiTree] = useState<string>('');
  const [fileEntries, setFileEntries] = useState<ZipFileEntry[]>([]);
  const [totalLines, setTotalLines] = useState<number>(0);
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [ignoredCount, setIgnoredCount] = useState<number>(0);

  // Copy Feedback state tracking with key identifiers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [treeSearchQuery, setTreeSearchQuery] = useState<string>('');
  const [previewEntry, setPreviewEntry] = useState<ZipFileEntry | null>(null);

  // Active Prompt Persona selection
  const [activePromptKey, setActivePromptKey] = useState<'primary' | 'continue' | 'audit_cn' | 'audit_en'>('primary');
  const [userRequirementText, setUserRequirementText] = useState<string>('');

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

  const setCopyFeedback = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2500);
  };

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
    onShowToast(`已将“${title}”恢复为出厂标准规范`, 'info');
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
    setAsciiTree('');
    setFileEntries([]);
    setProgress(0);
    onStatusChange(`已载入 · ${file.name} (${humanSize(file.size)})`, 0);
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
    onStatusChange('正在进行安全审计并解压 ZIP…', 5);

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
      setAsciiTree(result.asciiTree);
      setFileEntries(result.entries);
      setTotalLines(result.totalLines);
      setEstimatedTokens(result.estimatedTokens);
      setIgnoredCount(result.ignoredCount);
      setIsProcessing(false);
      setProgress(100);
      onStatusChange(`导出就绪 · 共 ${result.fileCount} 个有效文件 (~${result.estimatedTokens.toLocaleString()} Tokens)`, 100);
      onShowToast(
        `成功导出 ${result.fileCount} 个源码文件（预估 ~${result.estimatedTokens.toLocaleString()} Tokens）`,
        'success'
      );
    } catch (err: any) {
      setIsProcessing(false);
      onStatusChange('处理失败', 0);
      onShowToast(err?.message || '处理 ZIP 失败，请检查文件格式与体积', 'error');
    }
  };

  const handleDownloadTxt = () => {
    if (!generatedTxt || !selectedFile) return;
    const defaultName = selectedFile.name.replace(/\.zip$/i, '') + '_context.txt';
    const blob = new Blob([generatedTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`已保存并下载 ${defaultName}`, 'success');
  };

  const handleCopyTxtOnly = async () => {
    if (!generatedTxt) return;
    try {
      await navigator.clipboard.writeText(generatedTxt);
      setCopyFeedback('txt_only');
      onShowToast('✅ 仓库代码上下文 TXT 全文已复制到剪贴板', 'success');
    } catch {
      onShowToast('复制失败，请尝试直接点击“下载 TXT 文件”', 'error');
    }
  };

  const handleCopyAssembledPrompt = async () => {
    if (!generatedTxt) {
      onShowToast('请先生成 TXT 上下文后再复制组装 Prompt', 'error');
      return;
    }
    const template = customPrompts[activePromptKey] || DEFAULT_PROMPTS[activePromptKey];
    const fullPrompt = assemblePromptWithContext(template, userRequirementText, generatedTxt);

    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopyFeedback('assembled_prompt');
      onShowToast('🎉「AI Prompt + 仓库全量代码」已复制！可直接粘贴给大模型', 'success');
    } catch {
      onShowToast('复制失败，请手动选择复制', 'error');
    }
  };

  const handleCopyPromptTemplateOnly = async (promptKey: string, promptName: string) => {
    const template = customPrompts[promptKey] || DEFAULT_PROMPTS[promptKey as keyof typeof DEFAULT_PROMPTS];
    try {
      await navigator.clipboard.writeText(template);
      setCopyFeedback(`template_${promptKey}`);
      onShowToast(`${promptName} 指令模板已复制到剪贴板`, 'success');
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">01 · 导出代码仓库 (ZIP → TXT)</h2>
        <p className="text-sm text-slate-500 mt-1">
          将 GitHub 或本地工程代码一键打包为结构化上下文 TXT，自动估算 Token、生成目录树，并支持组装高精度 AI Prompt。
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        id="zip-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/80 scale-[1.005] shadow-md'
            : selectedFile
            ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/60 shadow-xs'
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
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              selectedFile
                ? 'bg-emerald-100 text-emerald-700 shadow-xs'
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
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-medium">
                    {humanSize(selectedFile.size)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  点击或拖入其他文件即可重新选择
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-800">
                  拖拽 ZIP 压缩包到此处，或 <span className="text-indigo-600 underline decoration-indigo-300 underline-offset-2">点击浏览选择</span>
                </p>
                <p className="text-xs text-slate-400">
                  支持从 GitHub 下载的代码包 (最大 512 MB，自动过滤根目录包裹)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Options & Action Box */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          导出与过滤配置
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              id="filter-ignored-folders-checkbox"
              checked={filterIgnoredFolders}
              onChange={e => setFilterIgnoredFolders(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                自动过滤构建产物与无用缓存
              </span>
              <span className="text-slate-500 block mt-0.5">
                自动排除 node_modules, .git 历史, .venv, dist, __pycache__, __MACOSX 等高冗余文件
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              id="include-binary-checkbox"
              checked={includeBinary}
              onChange={e => setIncludeBinary(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block">
                Base64 嵌入二进制多媒体文件
              </span>
              <span className="text-slate-500 block mt-0.5">
                默认仅记录路径与 SHA-256 哈希；开启后将图片/音频等以 Base64 编码完整输出
              </span>
            </div>
          </label>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span className="truncate max-w-[80%]">
                {currentFileProcessing ? `解析中: ${currentFileProcessing}` : '正在解压...'}
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            id="start-export-btn"
            disabled={!selectedFile || isProcessing}
            onClick={handleStartExport}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
              !selectedFile || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                正在解析生成 TXT...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                开始解析并生成 TXT
              </>
            )}
          </button>

          {generatedTxt && (
            <>
              <button
                id="download-txt-btn"
                onClick={handleDownloadTxt}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                下载 TXT 文件
              </button>

              <button
                id="copy-txt-btn"
                onClick={handleCopyTxtOnly}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                  copiedKey === 'txt_only'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
              >
                {copiedKey === 'txt_only' ? (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                    已复制 TXT 全文
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    复制 TXT 全文
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
              <Check className="w-4 h-4" />
              <span>仓库 TXT 导出已就绪</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>有效源码: {fileEntries.length} 篇</span>
              {ignoredCount > 0 && <span className="text-slate-400">已过滤缓存: {ignoredCount} 个</span>}
              <span>总字符: {generatedTxt.length.toLocaleString()}</span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">有效源码文件</span>
              <span className="text-lg font-bold text-slate-800 mt-0.5 block">{fileEntries.length}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">代码总行数</span>
              <span className="text-lg font-bold text-indigo-600 mt-0.5 block">{totalLines.toLocaleString()} 行</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">预估 LLM Token</span>
              <span className="text-lg font-bold text-emerald-600 mt-0.5 block">~{estimatedTokens.toLocaleString()}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">文件构成</span>
              <span className="text-xs font-semibold text-slate-700 mt-1.5 block">
                文本 {textCount} / 二进制 {binaryCount}
              </span>
            </div>
          </div>

          {/* File Explorer */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                已收录文件目录树 (点击条目预览代码)
              </h4>
              <div className="relative w-56">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={treeSearchQuery}
                  onChange={e => setTreeSearchQuery(e.target.value)}
                  placeholder="搜索文件路径..."
                  className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1">
              {filteredEntries.map(entry => (
                <div
                  key={entry.relativePath}
                  onClick={() => setPreviewEntry(entry)}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-50 border border-slate-100 cursor-pointer text-xs group transition-colors shadow-2xs"
                >
                  <span className="font-mono text-slate-800 truncate mr-2 font-medium">
                    {entry.relativePath}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-slate-400 font-mono">
                    <span>{humanSize(entry.size)}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        entry.isBinary ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                      }`}
                    >
                      {entry.isBinary ? 'Binary' : 'Text'}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interactive AI Prompt Station */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI Prompt 智能装配与下发工作台
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              选择预设指令模板，填入业务需求，一键组装「Prompt 指令 + 仓库全量代码」发送给大模型
            </p>
          </div>

          <button
            id="reset-all-prompts-btn"
            onClick={handleResetAllPrompts}
            className="text-xs text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 bg-slate-50 hover:bg-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="将全部 4 组提示词重置为官方默认标准规范"
          >
            <RotateCcw className="w-3 h-3" />
            重置为出厂 Prompt
          </button>
        </div>

        {/* Prompt Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: 'primary', label: '01 · 需求开发', desc: '全功能修改与输出规范' },
            { key: 'continue', label: '02 · 截断继续', desc: '无缝恢复超长输出' },
            { key: 'audit_cn', label: '03 · 架构审计 (中文)', desc: '生产就绪度/漏洞排查' },
            { key: 'audit_en', label: '04 · Audit (EN)', desc: 'OWASP & Resilience' },
          ].map(tab => {
            const isSelected = activePromptKey === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActivePromptKey(tab.key as any)}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold leading-tight">{tab.label}</span>
                  {customPrompts[tab.key] !== (DEFAULT_PROMPTS as any)[tab.key] && (
                    <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800">已改动</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">{tab.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Optional Requirement Input */}
        {activePromptKey === 'primary' && (
          <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquareCode className="w-3.5 h-3.5 text-indigo-600" />
                具体开发/重构需求 (可选，将自动替换模板中的占位符):
              </span>
              <span className="text-[11px] text-slate-400 font-normal">支持多行描述</span>
            </label>
            <textarea
              rows={3}
              value={userRequirementText}
              onChange={e => setUserRequirementText(e.target.value)}
              placeholder="例如：请为项目添加 JWT 鉴权中间件，并在登录接口上实现防暴力破解限流保护..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
        )}

        {/* Prompt Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenPromptEditor(activePromptKey, activePromptKey)}
              className="text-xs text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              自定义此 Prompt
            </button>
            <button
              onClick={() => handleCopyPromptTemplateOnly(activePromptKey, '当前 Prompt 模板')}
              className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                copiedKey === `template_${activePromptKey}`
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-medium'
                  : 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {copiedKey === `template_${activePromptKey}` ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  已复制单独模板
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  仅复制 Prompt 模板
                </>
              )}
            </button>
          </div>

          <button
            id="copy-assembled-prompt-btn"
            disabled={!generatedTxt}
            onClick={handleCopyAssembledPrompt}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
              !generatedTxt
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : copiedKey === 'assembled_prompt'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-[0.98]'
            }`}
          >
            {copiedKey === 'assembled_prompt' ? (
              <>
                <CheckCheck className="w-4 h-4 text-white animate-bounce" />
                已复制「Prompt + 仓库上下文」！
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                一键复制「AI Prompt + 仓库全量上下文」
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Prompt Editor Modal */}
      {editingPromptKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-800">
                  编辑自定义 Prompt · {editingPromptTitle}
                </span>
              </div>
              <button
                onClick={() => setEditingPromptKey(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white flex-1 overflow-auto flex flex-col space-y-2">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>修改后会自动保存在浏览器本地缓存中，供后续任务随时调用。</span>
                <span className="font-mono text-slate-400">字符数: {editingPromptDraft.length.toLocaleString()}</span>
              </div>
              <textarea
                value={editingPromptDraft}
                onChange={e => setEditingPromptDraft(e.target.value)}
                className="flex-1 w-full h-80 min-h-[300px] bg-slate-50 rounded-xl p-3.5 text-slate-800 font-mono text-xs border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none selection:bg-indigo-100"
                spellCheck={false}
              />
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => handleResetPromptToDefault(editingPromptKey, editingPromptTitle)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-slate-200/60 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复为官方默认
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPromptKey(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCustomPrompt}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Code className="w-4 h-4 text-indigo-600" />
                <span className="font-mono text-xs font-bold text-slate-800 truncate">
                  {previewEntry.relativePath}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({humanSize(previewEntry.size)})
                </span>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 flex-1 overflow-auto font-mono text-xs leading-relaxed text-slate-800">
              {previewEntry.isBinary ? (
                <div className="text-amber-700 text-center py-10">
                  这是二进制文件 ({humanSize(previewEntry.size)})，SHA-256: {previewEntry.sha256}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap">{previewEntry.content}</pre>
              )}
            </div>

            <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={async () => {
                  if (previewEntry.content) {
                    await navigator.clipboard.writeText(previewEntry.content);
                    onShowToast(`已复制 ${previewEntry.relativePath} 代码内容`, 'success');
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                复制此文件代码
              </button>

              <button
                onClick={() => setPreviewEntry(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
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