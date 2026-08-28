import React from 'react';
import { Copy, Search } from 'lucide-react';
import { ZipFileEntry } from '../../types';
import { humanSize } from '../../utils/security';

interface FileTreeViewerTabProps {
  asciiTree: string;
  fileEntries: ZipFileEntry[];
  treeSearchQuery: string;
  onSearchChange: (query: string) => void;
  onPreviewEntry: (entry: ZipFileEntry) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  mode: 'tree' | 'files';
}

export const FileTreeViewerTab: React.FC<FileTreeViewerTabProps> = ({
  asciiTree,
  fileEntries,
  treeSearchQuery,
  onSearchChange,
  onPreviewEntry,
  onShowToast,
  mode,
}) => {
  const filteredEntries = fileEntries.filter(f =>
    f.relativePath.toLowerCase().includes(treeSearchQuery.toLowerCase())
  );

  if (mode === 'tree') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>代码库完整目录层级树 (ASCII 结构)：</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(asciiTree);
              onShowToast('已复制 ASCII 目录树。', 'success');
            }}
            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>复制目录树</span>
          </button>
        </div>
        <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
          {asciiTree}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="搜索项目内的文件路径..."
          value={treeSearchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2.5 px-3 font-semibold">相对路径</th>
              <th className="py-2.5 px-3 font-semibold">文件类型</th>
              <th className="py-2.5 px-3 font-semibold">体积</th>
              <th className="py-2.5 px-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEntries.map(entry => (
              <tr key={entry.relativePath} className="hover:bg-slate-50/80">
                <td className="py-2 px-3 font-mono text-[11px] text-slate-800 truncate max-w-xs">
                  {entry.relativePath}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      entry.isBinary
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {entry.isBinary ? '二进制' : '文本源码'}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-500 text-[11px] font-mono">
                  {humanSize(entry.size)}
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    onClick={() => onPreviewEntry(entry)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                  >
                    查看内容
                  </button>
                </td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                  没有找到匹配的文件。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
