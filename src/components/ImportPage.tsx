import React, { useState } from 'react';
import {
  FileCode,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  FileCheck,
  Code,
  FolderArchive,
  Layers,
  Sparkles,
  X,
  Copy,
  Check,
  Search,
  Edit3,
} from 'lucide-react';
import { parseAiBlocks, generatePatchZip } from '../utils/aiParser';
import { humanSize } from '../utils/security';
import { ParsedAiFile } from '../types';

interface ImportPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImportPage: React.FC<ImportPageProps> = ({
  onStatusChange,
  onShowToast,
}) => {
  const [aiRawText, setAiRawText] = useState<string>('');
  const [allowSensitive, setAllowSensitive] = useState<boolean>(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedAiFile[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewingFile, setPreviewingFile] = useState<ParsedAiFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);

  // Sample template for testing
  const sampleTemplate = `### FILE: src/example.py
\`\`\`python
def hello_world():
    print("Hello from AI Workspace!")

if __name__ == "__main__":
    hello_world()
\`\`\`

**FILE:** config/settings.json
\`\`\`json
{
  "appName": "ZipToTxt",
  "version": "3.1.0",
  "aiEnhanced": true
}
\`\`\`

// FILE: utils/helper.ts
\`\`\`typescript
export function formatGreeting(name: string): string {
  return \`Welcome \${name.trim()}!\`;
}
\`\`\``;

  const handleParse = (): ParsedAiFile[] | null => {
    if (!aiRawText.trim()) {
      onShowToast('请先粘贴 AI 输出内容', 'error');
      return null;
    }

    try {
      const result = parseAiBlocks(aiRawText);
      setParsedFiles(result.files);
      setWarnings(result.warnings);
      onStatusChange(`成功解析 ${result.files.length} 个文件代码块`, 100);
      onShowToast(
        `已成功识别 ${result.files.length} 个文件代码块${
          result.autoClosedCount > 0 ? ` (已自动修复 ${result.autoClosedCount} 处截断)` : ''
        }`,
        'success'
      );
      return result.files;
    } catch (err: any) {
      onStatusChange('解析失败', 0);
      onShowToast(err?.message || '解析 AI 格式失败，请检查格式', 'error');
      return null;
    }
  };

  const handleGeneratePatchZip = async () => {
    let files = parsedFiles;
    if (!files) {
      files = handleParse();
      if (!files) return;
    }

    const sensitiveCount = files.filter(f => f.isSensitive).length;
    if (sensitiveCount > 0 && !allowSensitive) {
      onShowToast(
        `检测到 ${sensitiveCount} 个受保护敏感文件（如 .git 或 .env）。请勾选“允许打包敏感文件”以继续`,
        'error'
      );
      return;
    }

    setIsGeneratingZip(true);
    onStatusChange('正在打包补丁 ZIP…', 50);

    try {
      const zipBlob = await generatePatchZip(files, allowSensitive);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai_patch.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsGeneratingZip(false);
      onStatusChange(`补丁 ZIP 生成完成 · ${files.length} 个文件`, 100);
      onShowToast(`已成功生成并下载 ai_patch.zip（包含 ${files.length} 个修改文件）`, 'success');
    } catch (err: any) {
      setIsGeneratingZip(false);
      onStatusChange('生成补丁失败', 0);
      onShowToast(err?.message || '生成补丁 ZIP 失败', 'error');
    }
  };

  const handleDownloadSingleFile = (file: ParsedAiFile) => {
    const filename = file.relativePath.split('/').pop() || 'file.txt';
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`已下载单文件 ${filename}`, 'success');
  };

  const handleCopyFileContent = async (file: ParsedAiFile, idx: number) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFileIndex(idx);
      onShowToast(`已复制 ${file.relativePath} 的完整代码`, 'success');
      setTimeout(() => setCopiedFileIndex(null), 2000);
    } catch {
      onShowToast('复制失败，请尝试在预览窗口中手动复制', 'error');
    }
  };

  const handleSaveEditedFile = () => {
    if (!previewingFile || !parsedFiles) return;
    const encoder = new TextEncoder();
    const updated = parsedFiles.map(f => {
      if (f.relativePath === previewingFile.relativePath) {
        return {
          ...f,
          content: editingContent,
          size: encoder.encode(editingContent).length,
        };
      }
      return f;
    });
    setParsedFiles(updated);
    setPreviewingFile(null);
    onShowToast(`已保存对 ${previewingFile.relativePath} 的手动修改`, 'success');
  };

  const sensitiveFiles = parsedFiles?.filter(f => f.isSensitive) || [];
  const filteredFiles = parsedFiles
    ? parsedFiles.filter(f =>
        f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">应用 AI 修改</h2>
        <p className="text-sm text-slate-500 mt-1">
          粘贴 AI 返回的代码（支持各类 ### FILE / **File:** / 注释标记），高容错解析并一键打包为纯净 patch ZIP。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[560px] overflow-hidden">
            {/* Editor Toolbar */}
            <div className="px-4 py-3 bg-slate-900 text-slate-200 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
                  AI 原始输出编辑器
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="load-sample-btn"
                  onClick={() => {
                    setAiRawText(sampleTemplate);
                    setParsedFiles(null);
                    onShowToast('已载入测试示例代码', 'info');
                  }}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  载入示例
                </button>
                <button
                  id="clear-editor-btn"
                  onClick={() => {
                    setAiRawText('');
                    setParsedFiles(null);
                    setPreviewingFile(null);
                    setWarnings([]);
                    onStatusChange('就绪', 0);
                  }}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  清空
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1 relative bg-slate-950 p-2">
              <textarea
                id="ai-text-input"
                value={aiRawText}
                onChange={e => {
                  setAiRawText(e.target.value);
                  setParsedFiles(null);
                  setWarnings([]);
                }}
                placeholder="在此直接粘贴 AI 返回的完整内容...&#10;&#10;兼容格式：&#10;### FILE: src/main.py&#10;```python&#10;print('hello world')&#10;```&#10;&#10;**FILE:** config/app.json&#10;```json&#10;{ &quot;enabled&quot;: true }&#10;```"
                className="w-full h-full bg-transparent text-slate-100 font-mono text-xs p-3 focus:outline-hidden resize-none leading-relaxed selection:bg-indigo-600 selection:text-white"
                spellCheck={false}
              />
            </div>

            {/* Bottom Status within Editor */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>高容错解析器：自动过滤对话干扰、支持截断自动闭合</span>
              <span>
                字符数: {aiRawText.length.toLocaleString()} | 体积: {humanSize(new Blob([aiRawText]).size)}
              </span>
            </div>
          </div>

          {/* Warnings List */}
          {warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>容错提示信息</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 font-mono text-[11px]">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Panel (Right 1 Column) */}
        <div className="space-y-4">
          {/* Main Action Card */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              恢复与打包设置
            </h3>

            {/* Sensitive Protection Toggle */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/70 cursor-pointer transition-colors">
              <input
                type="checkbox"
                id="allow-sensitive-checkbox"
                checked={allowSensitive}
                onChange={e => setAllowSensitive(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">
                  允许打包敏感文件
                </span>
                <span className="text-slate-500 text-[11px]">
                  默认阻止 .git、.env 与私钥凭据文件
                </span>
              </div>
            </label>

            {/* Sensitive Warning */}
            {sensitiveFiles.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>包含 {sensitiveFiles.length} 个受保护敏感文件</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-rose-800/90 font-mono">
                  {sensitiveFiles.map(f => (
                    <li key={f.relativePath}>{f.relativePath}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                id="preview-patch-btn"
                onClick={() => handleParse()}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-slate-600" />
                解析与识别文件清单
              </button>

              <button
                id="extract-patch-zip-btn"
                disabled={isGeneratingZip}
                onClick={handleGeneratePatchZip}
                className="w-full py-3 px-4 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-xs shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <FolderArchive className="w-4 h-4" />
                {isGeneratingZip ? '正在打包...' : '生成并下载补丁 ZIP'}
              </button>
            </div>
          </div>

          {/* Parsed Files Summary List */}
          {parsedFiles && (
            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  已识别 {parsedFiles.length} 个文件
                </span>
                <span className="text-[11px] text-slate-500">可编辑 / 单独下载</span>
              </div>

              {/* Search Filter */}
              {parsedFiles.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索解析文件..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredFiles.map((file, idx) => (
                  <div
                    key={file.relativePath}
                    className="p-2 rounded-lg border border-slate-100 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2 flex-1">
                      <p className="font-mono font-medium text-slate-800 truncate" title={file.relativePath}>
                        {file.relativePath}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>{humanSize(file.size)}</span>
                        {file.language && <span>· {file.language}</span>}
                        {file.isSensitive && (
                          <span className="text-rose-600 font-semibold">[敏感]</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="查看与编辑代码"
                        onClick={() => {
                          setPreviewingFile(file);
                          setEditingContent(file.content);
                        }}
                        className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-200/60"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="复制此文件代码"
                        onClick={() => handleCopyFileContent(file, idx)}
                        className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-200/60"
                      >
                        {copiedFileIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        title="单独下载此文件"
                        onClick={() => handleDownloadSingleFile(file)}
                        className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-200/60"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Preview & Live Edit Modal */}
      {previewingFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Code className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-semibold truncate">
                  {previewingFile.relativePath}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({humanSize(previewingFile.size)})
                </span>
              </div>
              <button
                onClick={() => setPreviewingFile(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 text-slate-100 flex-1 overflow-auto flex flex-col">
              <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                <span>您可以在下方直接编辑微调代码，保存后生效并同步至最终 Patch ZIP。</span>
                <span>行数: {editingContent.split('\n').length}</span>
              </div>
              <textarea
                value={editingContent}
                onChange={e => setEditingContent(e.target.value)}
                className="flex-1 w-full h-80 min-h-[300px] bg-slate-900/80 rounded-lg p-3 text-slate-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                spellCheck={false}
              />
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {previewingFile.isSensitive ? '⚠️ 敏感文件' : '安全常规文件'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEditedFile}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  保存修改
                </button>
                <button
                  onClick={() => handleDownloadSingleFile({ ...previewingFile, content: editingContent })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载此文件
                </button>
                <button
                  onClick={() => setPreviewingFile(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
