import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Copy,
  Download,
  Check,
  Archive,
  Sparkles,
  Search,
  Filter,
  X,
  Edit3,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { processZipFile } from '../utils/zipToTxt';
import {
  DEFAULT_PROMPTS,
  COMMON_IGNORE_FOLDERS,
} from '../utils/constants';
import { humanSize } from '../utils/security';
import { estimateTokensDetailed, TokenEstimation } from '../utils/tokenEstimator';
import { ZipFileEntry, ProjectSummary } from '../types';

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

  const [isDragging, setIsDragging] = useState<boolean>(false);
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
      onShowToast('Prompt content cannot be empty.', 'error');
      return;
    }
    setCustomPrompts(prev => ({
      ...prev,
      [editingPromptKey]: editingPromptDraft,
    }));
    setEditingPromptKey(null);
    onShowToast('Custom prompt saved successfully.', 'success');
  };

  const handleResetCustomPrompt = (key: string) => {
    const defaultVal = DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS];
    if (defaultVal) {
      setCustomPrompts(prev => ({
        ...prev,
        [key]: defaultVal,
      }));
      setEditingPromptDraft(defaultVal);
      onShowToast('Prompt reset to default template.', 'info');
    }
  };

  const executeProcessZip = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setProgress(5);
    onStatusChange(`Analyzing archive: ${file.name}...`, 10);

    try {
      const result = await processZipFile(file, {
        includeBinary,
        filterIgnoredFolders,
        ignoredFolderNames: COMMON_IGNORE_FOLDERS,
        onProgress: (current, total, currentName) => {
          const pct = Math.min(95, Math.round((current / total) * 90) + 5);
          setProgress(pct);
          setCurrentFileProcessing(currentName);
          onStatusChange(`Scanning: ${currentName} (${current}/${total})`, pct);
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
      onStatusChange(`Successfully converted ${result.fileCount} files`, 100);
      onShowToast(`🎉 Successfully extracted ${result.fileCount} files (~${result.estimatedTokens.toLocaleString()} tokens)`, 'success');

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
      onStatusChange('Analysis failed', 0);
      onShowToast(err.message || 'Failed to process ZIP file.', 'error');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        onShowToast('Please drop a valid .ZIP archive.', 'error');
        return;
      }
      executeProcessZip(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      executeProcessZip(e.target.files[0]);
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
    onShowToast('Downloaded AI context TXT file.', 'success');
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
    onShowToast('Copied Prompt + Complete Repository Context to clipboard.', 'success');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyOnlyTxt = async () => {
    if (!generatedTxt) return;
    await navigator.clipboard.writeText(generatedTxt);
    setCopiedType('txt');
    onShowToast('Copied TXT Codebase Context to clipboard.', 'success');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const filteredTreeEntries = fileEntries.filter(f =>
    f.relativePath.toLowerCase().includes(treeSearchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <Archive className="w-4 h-4" />
          <span>Workflow Step 01</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Convert Project (ZIP → TXT)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Turn any ZIP repository into clean, structured Markdown text for Claude, GPT-4o, DeepSeek, or Gemini.
        </p>
      </div>

      {/* Upload & Drop Zone Card */}
      {!generatedTxt && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all bg-white shadow-xs ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005]'
              : 'border-slate-300 hover:border-indigo-400'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".zip"
            className="hidden"
            id="zip-file-input"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Drop your ZIP project here
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Supports GitHub release archives, local code zip files up to 512 MB
              </p>
            </div>

            <div className="pt-2">
              <button
                id="choose-zip-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-medium transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                <span>Choose ZIP File</span>
              </button>
            </div>

            {/* Privacy & Feature reassurance pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                100% Local Browser Processing
              </span>
              <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Multi-Model Token Estimator
              </span>
            </div>
          </div>
        </div>
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
                <h4 className="text-sm font-bold text-slate-900">Analyzing Project Archive...</h4>
                <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">{currentFileProcessing || 'Inspecting files and computing digests...'}</p>
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
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">1. Path Normalization</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">2. Security & SHA-256</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">3. Token Estimation</div>
          </div>
        </div>
      )}

      {/* Success State: Project Analysis Results */}
      {generatedTxt && !isProcessing && (
        <div className="space-y-6">
          {/* Main Success Hero Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      {selectedFile?.name}
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Safe
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ready for AI prompting • {humanSize(selectedFile?.size || 0)} source archive
                  </p>
                </div>
              </div>

              {/* Top Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-copy-prompt-context"
                  onClick={handleCopyPromptAndContext}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  {copiedType === 'full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedType === 'full' ? 'Copied Everything!' : 'Copy Prompt + Context'}</span>
                </button>

                <button
                  id="btn-download-txt"
                  onClick={handleDownloadTxt}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download TXT</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New ZIP</span>
                </button>
              </div>
            </div>

            {/* Key Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-500 font-medium">Estimated Tokens</div>
                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                  ~{tokenStats?.estimatedTokens.toLocaleString() || '0'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Approximate (GPT-4o/Claude)</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-500 font-medium">Text / Code Files</div>
                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                  {fileEntries.filter(f => !f.isBinary).length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {fileEntries.filter(f => f.isBinary).length} binary{ignoredCount > 0 ? ` • ${ignoredCount} ignored` : ''}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-500 font-medium">Total Lines of Code</div>
                <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                  {tokenStats?.lines.toLocaleString() || '0'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Formatted Markdown</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-500 font-medium">Security Status</div>
                <div className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Verified</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Zip Slip & Trojan Safe</div>
              </div>
            </div>

            {/* Direct Workflow Navigation link */}
            {onNavigateToPatch && (
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Ready to send this prompt to your AI assistant? Once the AI responds:
                </span>
                <button
                  onClick={onNavigateToPatch}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Step 2: Apply AI Patch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Interactive Navigation Tabs for Project Inspector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1">
                {[
                  { id: 'overview', label: 'Prompt Composer' },
                  { id: 'tree', label: 'Directory Tree' },
                  { id: 'files', label: `Files (${fileEntries.length})` },
                  { id: 'tokens', label: 'Token Budget' },
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
                className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy TXT Only</span>
              </button>
            </div>

            {/* TAB 1: Prompt Composer */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Select Prompt Objective Template:
                  </label>
                  <button
                    onClick={() => handleOpenPromptEditor(selectedPromptKey, 'Customize Active Prompt')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Prompt Template</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'primary', label: 'Feature Development / Refactor', desc: 'Standard development prompt' },
                    { key: 'audit_cn', label: 'Security & Production Audit', desc: 'Enterprise zero-bug hardening' },
                    { key: 'continue', label: 'Response Continuation', desc: 'Resume token cutoffs' },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPromptKey(p.key)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedPromptKey === p.key
                          ? 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-semibold shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Specific Requirements (Optional - will be injected into prompt):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please refactor the authentication module to use JWT and add unit tests for all helper functions..."
                    value={userRequirement}
                    onChange={e => setUserRequirement(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {getFullPromptText().slice(0, 1500)}...
                </div>
              </div>
            )}

            {/* TAB 2: Directory Tree */}
            {activeTab === 'tree' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Repository Visual Hierarchy:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(asciiTree);
                      onShowToast('ASCII Tree copied.', 'success');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Tree</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                  {asciiTree}
                </pre>
              </div>
            )}

            {/* TAB 3: Files List */}
            {activeTab === 'files' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search files in repository..."
                    value={treeSearchQuery}
                    onChange={e => setTreeSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Relative Path</th>
                        <th className="py-2 px-3 font-semibold">Type</th>
                        <th className="py-2 px-3 font-semibold">Size</th>
                        <th className="py-2 px-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTreeEntries.map(entry => (
                        <tr key={entry.relativePath} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-800 truncate max-w-xs">
                            {entry.relativePath}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${entry.isBinary ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
                              {entry.isBinary ? 'Binary' : 'Text'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] font-mono">
                            {humanSize(entry.size)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => setPreviewEntry(entry)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Token Budget */}
            {activeTab === 'tokens' && tokenStats && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-indigo-900 leading-relaxed">
                  <strong>Estimated Token Approximation:</strong> Calculated by simulating Byte-Pair Encoding (BPE) subword splitting, CJK character density, punctuation operators, and indentation token weights.
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px]">GPT-4o (o200k)</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {tokenStats.gpt4oTokens.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tokenStats.contextUsage.gpt128k}% of 128k
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Claude 3.5 Sonnet</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {tokenStats.claudeTokens.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tokenStats.contextUsage.claude200k}% of 200k
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px]">DeepSeek V3 / R1</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {tokenStats.deepseekTokens.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tokenStats.contextUsage.deepseek128k}% of 128k
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Gemini 1.5 / 2.0</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {tokenStats.geminiTokens.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tokenStats.contextUsage.gemini1m}% of 1M
                    </div>
                  </div>
                </div>
              </div>
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
            <span>Advanced Extraction Options & Rules</span>
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
              <span>Filter common build & dependency folders (node_modules, .git, .venv, dist, __pycache__)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={includeBinary}
                onChange={e => setIncludeBinary(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Encode binary files as Base64 text in export (Increases prompt size significantly)</span>
            </label>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 truncate">
                <span>{previewEntry.relativePath}</span>
                <span className="text-slate-400 font-normal">({humanSize(previewEntry.size)})</span>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
              {previewEntry.isBinary ? (
                <div className="text-slate-400 text-center py-12">
                  Binary file content ({previewEntry.sha256})
                </div>
              ) : (
                <pre className="whitespace-pre-wrap">{previewEntry.content}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompt Editor Modal */}
      {editingPromptKey && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">{editingPromptTitle}</h3>
              <button
                onClick={() => setEditingPromptKey(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                rows={12}
                value={editingPromptDraft}
                onChange={e => setEditingPromptDraft(e.target.value)}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleResetCustomPrompt(editingPromptKey)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Reset to Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingPromptKey(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomPrompt}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Save Prompt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
