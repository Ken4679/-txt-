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
      onShowToast('Please paste the AI response text before parsing.', 'error');
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

      onStatusChange(`Extracted ${result.files.length} modified files`, 100);
      onShowToast(
        `Extracted ${result.files.length} files from AI output${
          result.autoClosedCount > 0 ? ` (${result.autoClosedCount} truncated code fences healed)` : ''
        }`,
        'success'
      );
    } catch (err: any) {
      onShowToast(err.message || 'Failed to parse AI response.', 'error');
    }
  };

  const handleLoadSample = () => {
    setAiInputText(SAMPLE_AI_OUTPUT);
    onShowToast('Loaded sample AI code response.', 'info');
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
      onShowToast('Please select at least one file to include in the Patch ZIP.', 'error');
      return;
    }

    const hasSensitive = filesToInclude.some(f => f.isSensitive);
    if (hasSensitive && !allowSensitive) {
      onShowToast('Contains sensitive credentials (.env / keys). Please check permission to include them.', 'error');
      return;
    }

    setIsExporting(true);
    onStatusChange('Generating Patch ZIP archive...', 50);

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
      onStatusChange(`Exported ${filesToInclude.length} files to Patch ZIP`, 100);
      onShowToast(`Exported ${filesToInclude.length} files to Patch ZIP archive!`, 'success');
    } catch (err: any) {
      setIsExporting(false);
      onShowToast(err.message || 'Failed to generate Patch ZIP.', 'error');
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
          <span>Workflow Step 02</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Apply AI Patch (Markdown → Patch ZIP)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Paste the raw response from Claude, GPT-4o, DeepSeek, or Gemini. We will safely extract the files, show visual diffs, and package them into a Patch ZIP.
        </p>
      </div>

      {/* Step 1: Input AI Text Area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <span>Paste AI Markdown Response:</span>
            <span className="text-slate-400 font-normal">
              (Recognizes ### FILE: path, **FILE:** path, ```ts:path)
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Sample Response</span>
            </button>

            {aiInputText && (
              <button
                onClick={() => setAiInputText('')}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <textarea
          id="ai-markdown-input"
          rows={7}
          placeholder="Paste AI response here... e.g. ### FILE: src/auth/service.ts ```typescript ... ```"
          value={aiInputText}
          onChange={e => setAiInputText(e.target.value)}
          className="w-full text-xs font-mono p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Auto-heals unclosed code fences • Blocks Zip Slip traversal • Sanitizes Unicode</span>
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
            <span>Parse & Inspect AI Changes</span>
          </button>
        </div>
      </div>

      {/* Warnings & Auto-Healed Badges */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Parser Notice & Auto-Healed Blocks ({autoClosedCount})</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2: Parsed Files Review & Export */}
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
                  Ready to Export Patch Archive
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedFilePaths.size} of {parsedFiles.length} files selected for export
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
                <span>{isExporting ? 'Packaging...' : 'Download Patch ZIP'}</span>
              </button>
            </div>
          </div>

          {/* Sensitive files toggle warning if detected */}
          {sensitiveFilesCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">Detected {sensitiveFilesCount} Sensitive File(s): </span>
                  <span>Credentials or environment configs are protected.</span>
                </div>
              </div>
              <label className="flex items-center gap-2 font-medium cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={allowSensitive}
                  onChange={e => {
                    setAllowSensitive(e.target.checked);
                    if (e.target.checked) {
                      onShowToast('Enabled sensitive files permission for patch generation.', 'info');
                    }
                  }}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Allow sensitive files in patch</span>
              </label>
            </div>
          )}

          {/* Integrated Visual Diff & File Inspector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-indigo-600" />
                <span>Visual Code Inspection & Diff</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleSelectAll}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100"
                >
                  {selectedFilePaths.size === parsedFiles.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <DiffViewer diffFiles={diffFiles} />
          </div>
        </div>
      )}
    </div>
  );
};
