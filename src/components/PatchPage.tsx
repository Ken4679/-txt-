import React, { useState } from 'react';
import {
  FileCode,
  Download,
  AlertTriangle,
  Lock,
  Sparkles,
  GitCompare,
  ShieldCheck,
} from 'lucide-react';
import { parseAiBlocks, generatePatchZip } from '../utils/aiParser';
import { ParsedAiFile, DiffFile, ProjectSummary } from '../types';
import { DiffViewer } from './DiffViewer';

interface PatchPageProps {
  onStatusChange: (status: string, progress: number) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentProject: ProjectSummary | null;
}

const SAMPLE_AI_OUTPUT = `Here are the requested modifications for your project:

### FILE: src/auth/tokenService.ts
\`\`\`typescript
export interface TokenPayload {
  userId: string;
  role: 'admin' | 'user';
  exp: number;
}

export function verifyToken(token: string, secret: string): TokenPayload {
  if (!token || !secret) {
    throw new Error('Invalid token parameters');
  }
  // Safe JWT decoding logic
  return { userId: 'usr_123', role: 'admin', exp: Date.now() + 3600 };
}
\`\`\`

### FILE: src/config/appConfig.json
\`\`\`json
{
  "appName": "ZipToTxt",
  "version": "2.4.0",
  "security": {
    "zipSlipDefense": true,
    "maxPayloadBytes": 536870912
  }
}
\`\`\`

### FILE: README.md
\`\`\`markdown
# ZipToTxt Workspace
High-efficiency AI context generation and Patch ZIP packaging.
\`\`\`
`;

export const PatchPage: React.FC<PatchPageProps> = ({
  onStatusChange,
  onShowToast,
  currentProject,
}) => {
  const [aiInputText, setAiInputText] = useState<string>('');
  const [parsedFiles, setParsedFiles] = useState<ParsedAiFile[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [autoClosedCount, setAutoClosedCount] = useState<number>(0);
  const [allowSensitive, setAllowSensitive] = useState<boolean>(false);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleParseAiResponse = () => {
    if (!aiInputText.trim()) {
      onShowToast('请先粘贴大模型返回的 Markdown 文本。', 'error');
      return;
    }

    try {
      const result = parseAiBlocks(aiInputText);
      setParsedFiles(result.files);
      setWarnings(result.warnings);
      setAutoClosedCount(result.autoClosedCount);

      // Select all non-sensitive files by default
      const initialSelected = new Set<string>();
      result.files.forEach((f: ParsedAiFile) => {
        if (!f.isSensitive || allowSensitive) {
          initialSelected.add(f.relativePath);
        }
      });
      setSelectedFilePaths(initialSelected);

      onStatusChange(`成功提取 ${result.files.length} 个变动代码文件`, 100);
      onShowToast(
        `🎉 成功提取 ${result.files.length} 个文件${
          result.autoClosedCount > 0 ? `（已自动修复 ${result.autoClosedCount} 处未闭合代码块）` : ''
        }`,
        'success'
      );
    } catch (err: any) {
      onShowToast(err.message || '解析 AI 响应失败，请检查输入格式。', 'error');
    }
  };

  const handleLoadSample = () => {
    setAiInputText(SAMPLE_AI_OUTPUT);
    onShowToast('已加载示例 AI 代码响应。', 'info');
  };

  const handleToggleSelectAll = () => {
    if (selectedFilePaths.size === parsedFiles.length) {
      setSelectedFilePaths(new Set());
    } else {
      setSelectedFilePaths(new Set(parsedFiles.map(f => f.relativePath)));
    }
  };

  const handleExportPatchZip = async () => {
    if (parsedFiles.length === 0) return;

    const filesToInclude = parsedFiles.filter(f => selectedFilePaths.has(f.relativePath));
    if (filesToInclude.length === 0) {
      onShowToast('请至少勾选一个需要打包入 Patch ZIP 的文件。', 'error');
      return;
    }

    const hasSensitive = filesToInclude.some(f => f.isSensitive);
    if (hasSensitive && !allowSensitive) {
      onShowToast('选中的文件中包含敏感凭据（.env / key），请先勾选允许包含敏感文件权限。', 'error');
      return;
    }

    setIsExporting(true);
    onStatusChange('正在生成 Patch ZIP 压缩包...', 50);

    try {
      const zipBlob = await generatePatchZip(filesToInclude, {
        allowSensitive,
        compressionLevel: 9,
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = currentProject ? currentProject.name : 'ai_patch';
      a.download = `${baseName}_patch.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      onStatusChange(`成功导出 ${filesToInclude.length} 个文件至 Patch ZIP`, 100);
      onShowToast(`🎉 成功导出包含 ${filesToInclude.length} 个文件的 Patch ZIP 补丁包！`, 'success');
    } catch (err: any) {
      setIsExporting(false);
      onShowToast(err.message || '生成 Patch ZIP 失败。', 'error');
    }
  };

  // Build diff representation against current project
  const diffFiles: DiffFile[] = parsedFiles.map(pf => {
    const existing = currentProject?.entries.find(e => e.relativePath === pf.relativePath);
    let status: 'added' | 'modified' | 'deleted' | 'unchanged' = 'added';
    if (existing) {
      status = existing.content === pf.content ? 'unchanged' : 'modified';
    }
    return {
      relativePath: pf.relativePath,
      status,
      originalContent: existing?.content,
      newContent: pf.content,
      language: pf.language,
      isSensitive: pf.isSensitive,
    };
  });

  const sensitiveFilesCount = parsedFiles.filter(f => f.isSensitive).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
          <FileCode className="w-4 h-4" />
          <span>流程步骤 02</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">应用 AI 补丁 (Markdown → Patch ZIP)</h1>
        <p className="text-sm text-slate-500 mt-1">
          直接粘贴 Claude、GPT-4o、DeepSeek、Gemini 等大模型返回的代码文本。系统将宽容解析文件路径、审查行级 Diff 并一键打包为安全可直接解压覆盖的 Patch ZIP 补丁。
        </p>
      </div>

      {/* Step 1: Input AI Text Area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <span>第一步：粘贴大模型返回的 Markdown 内容：</span>
            <span className="text-slate-400 font-normal">
              (支持 ### FILE: path, **FILE:** path, ```ts:path 等标记)
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>载入示例数据</span>
            </button>

            {aiInputText && (
              <button
                onClick={() => setAiInputText('')}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                清空
              </button>
            )}
          </div>
        </div>

        <textarea
          id="ai-markdown-input"
          rows={7}
          placeholder="在此直接粘贴大模型回复的完整内容... 例如：### FILE: src/auth/service.ts ```typescript ... ```"
          value={aiInputText}
          onChange={e => setAiInputText(e.target.value)}
          className="w-full text-xs font-mono p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>自动闭合截断反引号 • 拦截 Zip Slip 路径逃逸 • 清洗 Unicode 木马源</span>
          </div>

          <button
            id="parse-ai-button"
            onClick={handleParseAiResponse}
            disabled={!aiInputText.trim()}
            className={`px-5 py-2 text-xs font-medium rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              aiInputText.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>解析并审查代码变更</span>
          </button>
        </div>
      </div>

      {/* Warnings & Auto-Healed Badges */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>解析提示与自动修复项 ({autoClosedCount})</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2 & 3: Parsed Files Review & Export */}
      {parsedFiles.length > 0 && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold font-mono">
                {selectedFilePaths.size}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  补丁导出已就绪
                </h3>
                <p className="text-xs text-slate-500">
                  已勾选 {selectedFilePaths.size} / 共 {parsedFiles.length} 个文件包含在 Patch ZIP 中
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                id="export-patch-zip-btn"
                onClick={handleExportPatchZip}
                disabled={isExporting || selectedFilePaths.size === 0}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? '正在打包...' : '下载 Patch ZIP 补丁包'}</span>
              </button>
            </div>
          </div>

          {/* Sensitive files toggle warning if detected */}
          {sensitiveFilesCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">检测到 {sensitiveFilesCount} 个敏感凭据文件：</span>
                  <span>包含环境变量或密钥文件，已默认开启安全保护。</span>
                </div>
              </div>
              <label className="flex items-center gap-2 font-medium cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={allowSensitive}
                  onChange={e => {
                    setAllowSensitive(e.target.checked);
                    if (e.target.checked) {
                      onShowToast('已启用允许将敏感凭据文件打包进 Patch ZIP 权限。', 'info');
                    }
                  }}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span>允许包含敏感凭据文件</span>
              </label>
            </div>
          )}

          {/* Integrated Visual Diff & File Inspector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-indigo-600" />
                <span>代码变更行级审查 (Diff)</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleSelectAll}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
                >
                  {selectedFilePaths.size === parsedFiles.length ? '取消全选' : '全选所有文件'}
                </button>
              </div>
            </div>

            <DiffViewer
              diffFiles={diffFiles}
              selectedPaths={selectedFilePaths}
              onTogglePathSelect={path => {
                const next = new Set(selectedFilePaths);
                if (next.has(path)) {
                  next.delete(path);
                } else {
                  next.add(path);
                }
                setSelectedFilePaths(next);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
