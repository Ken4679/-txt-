import React, { useState } from 'react';
import {
  GitCompare,
  FileCode,
  Search,
  Copy,
  Check,
} from 'lucide-react';
import { DiffFile } from '../types';

interface DiffViewerProps {
  diffFiles: DiffFile[];
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffFiles,
  selectedFilePath,
  onSelectFile,
}) => {
  const [activePath, setActivePath] = useState<string>(
    selectedFilePath || (diffFiles.length > 0 ? diffFiles[0].relativePath : '')
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = diffFiles.find(f => f.relativePath === activePath) || diffFiles[0];

  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.newContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = diffFiles.filter(f =>
    f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    added: diffFiles.filter(f => f.status === 'added').length,
    modified: diffFiles.filter(f => f.status === 'modified').length,
    deleted: diffFiles.filter(f => f.status === 'deleted').length,
  };

  const renderUnifiedLines = (original?: string, modified?: string) => {
    if (!original && modified) {
      // Pure addition
      return modified.split('\n').map((line, idx) => (
        <div key={idx} className="flex font-mono text-xs leading-5 bg-emerald-50/50 hover:bg-emerald-100/50 text-slate-800">
          <span className="w-12 text-right pr-3 select-none text-slate-400 border-r border-slate-200">{idx + 1}</span>
          <span className="w-6 text-center select-none text-emerald-600 font-bold">+</span>
          <span className="flex-1 px-2 whitespace-pre overflow-x-auto text-emerald-900">{line}</span>
        </div>
      ));
    }

    if (original && !modified) {
      // Pure deletion
      return original.split('\n').map((line, idx) => (
        <div key={idx} className="flex font-mono text-xs leading-5 bg-rose-50/50 hover:bg-rose-100/50 text-slate-800">
          <span className="w-12 text-right pr-3 select-none text-slate-400 border-r border-slate-200">{idx + 1}</span>
          <span className="w-6 text-center select-none text-rose-600 font-bold">-</span>
          <span className="flex-1 px-2 whitespace-pre overflow-x-auto text-rose-900 line-through opacity-80">{line}</span>
        </div>
      ));
    }

    // Direct modified or replacement comparison
    const newLines = (modified || '').split('\n');
    return newLines.map((line, idx) => (
      <div key={idx} className="flex font-mono text-xs leading-5 hover:bg-slate-50 text-slate-800">
        <span className="w-12 text-right pr-3 select-none text-slate-400 border-r border-slate-200">{idx + 1}</span>
        <span className="w-6 text-center select-none text-slate-300"> </span>
        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{line}</span>
      </div>
    ));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[640px]">
      {/* Diff Toolbar Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
            <GitCompare className="w-4 h-4 text-indigo-600" />
            <span>代码变更审查 (Diff)</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              共 {diffFiles.length} 个文件变动
            </span>
            {stats.added > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                +{stats.added} 新增
              </span>
            )}
            {stats.modified > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                ~{stats.modified} 修改
              </span>
            )}
            {stats.deleted > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                -{stats.deleted} 删除
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制代码' : '复制当前文件'}</span>
          </button>
        </div>
      </div>

      {/* Main Diff Content Splitter */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: File List */}
        <div className="w-72 border-r border-slate-200 bg-slate-50/40 flex flex-col shrink-0">
          <div className="p-2.5 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="筛选变动文件..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFiles.map(file => {
              const isSelected = (currentFile?.relativePath === file.relativePath);
              return (
                <button
                  key={file.relativePath}
                  onClick={() => {
                    setActivePath(file.relativePath);
                    if (onSelectFile) onSelectFile(file.relativePath);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-medium shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate font-mono text-[11px]">{file.relativePath}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      file.status === 'added'
                        ? 'bg-emerald-100 text-emerald-800'
                        : file.status === 'modified'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {file.status === 'added' ? '+ 新增' : file.status === 'modified' ? '~ 修改' : '- 删除'}
                  </span>
                </button>
              );
            })}

            {filteredFiles.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                无匹配的变动文件。
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Code Diff Pane */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {currentFile ? (
            <>
              {/* File Header Tab */}
              <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold text-slate-800 truncate">{currentFile.relativePath}</span>
                  {currentFile.language && (
                    <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {currentFile.language}
                    </span>
                  )}
                  {currentFile.isSensitive && (
                    <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-semibold">
                      敏感凭据文件
                    </span>
                  )}
                </div>

                <span className="text-slate-400 text-[11px] font-mono">
                  {currentFile.newContent.split('\n').length} 行代码
                </span>
              </div>

              {/* Code Scroll Area */}
              <div className="flex-1 overflow-auto bg-[#fafafa]">
                {renderUnifiedLines(currentFile.originalContent, currentFile.newContent)}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              请从左侧列表选择文件以审查代码变更。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
