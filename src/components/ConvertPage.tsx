import React, { useState, useEffect } from 'react';
import {
  Archive,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { processZipFile } from '../utils/zipToTxt';
import {
  DEFAULT_PROMPTS,
  COMMON_IGNORE_FOLDERS,
} from '../utils/constants';
import { estimateTokensDetailed, TokenEstimation } from '../utils/tokenEstimator';
import { ZipFileEntry, ProjectSummary } from '../types';

import { ZipDropZone } from './convert/ZipDropZone';
import { ProjectStatsSummary } from './convert/ProjectStatsSummary';
import { PromptComposerTab } from './convert/PromptComposerTab';
import { FileTreeViewerTab } from './convert/FileTreeViewerTab';
import { TokenBudgetTab } from './convert/TokenBudgetTab';
import { FilePreviewModal } from './convert/FilePreviewModal';
import { PromptEditorModal } from './convert/PromptEditorModal';

interface ConvertPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onProjectLoaded?: (project: ProjectSummary) => void;
  onNavigateToPatch?: () => void;
}

const STORAGE_KEY_PROMPTS = 'ziptotxt_custom_prompts_v2';

export const ConvertPage: React.FC<ConvertPageProps> = ({
  onStatusChange,
  onShowToast,
  onProjectLoaded,
  onNavigateToPatch,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [includeBinary, setIncludeBinary] = useState<boolean>(false);
  const [filterIgnoredFolders, setFilterIgnoredFolders] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentFileProcessing, setCurrentFileProcessing] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [generatedTxt, setGeneratedTxt] = useState<string | null>(null);
  const [asciiTree, setAsciiTree] = useState<string>('');
  const [fileEntries, setFileEntries] = useState<ZipFileEntry[]>([]);
  const [ignoredCount, setIgnoredCount] = useState<number>(0);
  const [tokenStats, setTokenStats] = useState<TokenEstimation | null>(null);

  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [treeSearchQuery, setTreeSearchQuery] = useState<string>('');
  const [previewEntry, setPreviewEntry] = useState<ZipFileEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tree' | 'files' | 'tokens'>('overview');

  // Custom Prompts State
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

  const [selectedPromptKey, setSelectedPromptKey] = useState<string>('primary');
  const [userRequirement, setUserRequirement] = useState<string>('');

  // Modal editor
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [editingPromptTitle, setEditingPromptTitle] = useState<string>('');
  const [editingPromptDraft, setEditingPromptDraft] = useState<string>('');

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
      onShowToast('提示词模板内容不能为空。', 'error');
      return;
    }
    setCustomPrompts(prev => ({
      ...prev,
      [editingPromptKey]: editingPromptDraft,
    }));
    setEditingPromptKey(null);
    onShowToast('自定义提示词模板已保存。', 'success');
  };

  const handleResetCustomPrompt = () => {
    if (!editingPromptKey) return;
    const defaultVal = DEFAULT_PROMPTS[editingPromptKey as keyof typeof DEFAULT_PROMPTS];
    if (defaultVal) {
      setCustomPrompts(prev => ({
        ...prev,
        [editingPromptKey]: defaultVal,
      }));
      setEditingPromptDraft(defaultVal);
      onShowToast('已重置为默认模板。', 'info');
    }
  };

  const executeProcessZip = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setProgress(5);
    onStatusChange(`正在解析代码库归档: ${file.name}...`, 10);

    try {
      const result = await processZipFile(file, {
        includeBinary,
        filterIgnoredFolders,
        ignoredFolderNames: COMMON_IGNORE_FOLDERS,
        onProgress: (current, total, currentName) => {
          const pct = Math.min(95, Math.round((current / total) * 90) + 5);
          setProgress(pct);
          setCurrentFileProcessing(currentName);
          onStatusChange(`扫描提取: ${currentName} (${current}/${total})`, pct);
        },
      });

      setGeneratedTxt(result.txtContent);
      setAsciiTree(result.asciiTree);
      setFileEntries(result.entries);
      setIgnoredCount(result.ignoredCount);

      // Estimate detailed multi-model tokens
      const detailedTokens = estimateTokensDetailed(result.txtContent);
      setTokenStats(detailedTokens);

      setProgress(100);
      setIsProcessing(false);
      onStatusChange(`成功解析 ${result.fileCount} 个源码文件`, 100);
      onShowToast(`🎉 成功转换 ${result.fileCount} 个文件（约 ${result.estimatedTokens.toLocaleString()} Token）`, 'success');

      if (onProjectLoaded) {
        onProjectLoaded({
          name: file.name.replace(/\.zip$/i, ''),
          totalFiles: result.fileCount,
          textFiles: result.textCount,
          binaryFiles: result.binaryCount,
          totalSize: file.size,
          totalLines: result.totalLines,
          estimatedTokens: result.estimatedTokens,
          asciiTree: result.asciiTree,
          txtContent: result.txtContent,
          entries: result.entries,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setProgress(0);
      onStatusChange('解析中断', 0);
      onShowToast(err.message || 'ZIP 解析失败，请检查压缩包。', 'error');
    }
  };

  const handleDownloadTxt = () => {
    if (!generatedTxt || !selectedFile) return;
    const baseName = selectedFile.name.replace(/\.zip$/i, '');
    const blob = new Blob([generatedTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_ai_context.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('已下载 AI 上下文 TXT 文件。', 'success');
  };

  const getFullPromptText = () => {
    const template = customPrompts[selectedPromptKey] || DEFAULT_PROMPTS.primary;
    let filled = template;
    if (userRequirement.trim()) {
      filled = filled.replace(/\[DESCRIBE YOUR REQUIREMENT HERE\]/i, userRequirement.trim());
      filled = filled.replace(/\[在此详细描述您的业务需求.*?\]/i, userRequirement.trim());
    }
    return `${filled}\n\n${generatedTxt || ''}`;
  };

  const handleCopyPromptAndContext = async () => {
    if (!generatedTxt) return;
    const full = getFullPromptText();
    await navigator.clipboard.writeText(full);
    setCopiedType('full');
    onShowToast('已将 Prompt + 完整代码库上下文复制到剪贴板！', 'success');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyOnlyTxt = async () => {
    if (!generatedTxt) return;
    await navigator.clipboard.writeText(generatedTxt);
    setCopiedType('txt');
    onShowToast('已复制代码库 TXT 内容到剪贴板。', 'success');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleResetZip = () => {
    setGeneratedTxt(null);
    setSelectedFile(null);
    setFileEntries([]);
    setAsciiTree('');
    setTokenStats(null);
    setProgress(0);
    onStatusChange('准备就绪', 0);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <Archive className="w-4 h-4" />
          <span>流程步骤 01</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">项目代码转换 (ZIP → AI 上下文 TXT)</h1>
        <p className="text-sm text-slate-500 mt-1">
          将任意 ZIP 格式的工程代码库转化为适配 Claude、GPT-4o、DeepSeek、Gemini 等大模型的结构化 Markdown TXT 提示词上下文。
        </p>
      </div>

      {/* Upload & Drop Zone Card */}
      {!generatedTxt && (
        <ZipDropZone
          isProcessing={isProcessing}
          onFileSelect={executeProcessZip}
          onShowToast={onShowToast}
        />
      )}

      {/* Processing State with Detailed Progress Bar */}
      {isProcessing && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center animate-spin">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">正在分析项目代码库...</h4>
                <p className="text-xs text-slate-500 truncate max-w-md mt-0.5 font-mono">{currentFileProcessing || '计算文件摘要与校验路径安全...'}</p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-indigo-600">{progress}%</span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500 pt-1 font-medium">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">1. 路径规范化校验</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">2. Zip Slip 与 SHA-256</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">3. 多模型 Token 预算测算</div>
          </div>
        </div>
      )}

      {/* Success State: Project Analysis Results */}
      {generatedTxt && !isProcessing && (
        <div className="space-y-6">
          {/* Main Success Hero Card */}
          <ProjectStatsSummary
            fileName={selectedFile?.name}
            fileSize={selectedFile?.size}
            tokenStats={tokenStats}
            fileEntries={fileEntries}
            ignoredCount={ignoredCount}
            copiedType={copiedType}
            onCopyPromptAndContext={handleCopyPromptAndContext}
            onDownloadTxt={handleDownloadTxt}
            onResetZip={handleResetZip}
            onNavigateToPatch={onNavigateToPatch}
          />

          {/* Interactive Navigation Tabs for Project Inspector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                {[
                  { id: 'overview', label: 'Prompt 提示词组合' },
                  { id: 'tree', label: '项目目录树' },
                  { id: 'files', label: `源码文件 (${fileEntries.length})` },
                  { id: 'tokens', label: 'Token 预算分析' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-indigo-50 text-indigo-900 font-semibold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopyOnlyTxt}
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>仅复制 TXT 内容</span>
              </button>
            </div>

            {/* TAB 1: Prompt Composer */}
            {activeTab === 'overview' && (
              <PromptComposerTab
                selectedPromptKey={selectedPromptKey}
                onSelectPromptKey={setSelectedPromptKey}
                userRequirement={userRequirement}
                onChangeUserRequirement={setUserRequirement}
                fullPromptText={getFullPromptText()}
                onOpenPromptEditor={handleOpenPromptEditor}
              />
            )}

            {/* TAB 2: Directory Tree */}
            {activeTab === 'tree' && (
              <FileTreeViewerTab
                asciiTree={asciiTree}
                fileEntries={fileEntries}
                treeSearchQuery={treeSearchQuery}
                onSearchChange={setTreeSearchQuery}
                onPreviewEntry={setPreviewEntry}
                onShowToast={onShowToast}
                mode="tree"
              />
            )}

            {/* TAB 3: Files List */}
            {activeTab === 'files' && (
              <FileTreeViewerTab
                asciiTree={asciiTree}
                fileEntries={fileEntries}
                treeSearchQuery={treeSearchQuery}
                onSearchChange={setTreeSearchQuery}
                onPreviewEntry={setPreviewEntry}
                onShowToast={onShowToast}
                mode="files"
              />
            )}

            {/* TAB 4: Token Budget */}
            {activeTab === 'tokens' && (
              <TokenBudgetTab tokenStats={tokenStats} />
            )}
          </div>
        </div>
      )}

      {/* Advanced Settings Drawer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>高级提取选项与过滤规则</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={filterIgnoredFolders}
                onChange={e => setFilterIgnoredFolders(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>自动过滤构建产物与依赖文件夹（node_modules, .git, .venv, dist, __pycache__ 等）</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={includeBinary}
                onChange={e => setIncludeBinary(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>在导出的 TXT 中以 Base64 文本编码包含二进制文件（注意：会显著增加 Token 消耗）</span>
            </label>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
      />

      {/* Prompt Editor Modal */}
      <PromptEditorModal
        isOpen={Boolean(editingPromptKey)}
        title={editingPromptTitle}
        draft={editingPromptDraft}
        onChangeDraft={setEditingPromptDraft}
        onClose={() => setEditingPromptKey(null)}
        onSave={handleSaveCustomPrompt}
        onReset={handleResetCustomPrompt}
      />
    </div>
  );
};
