import React from 'react';
import { X } from 'lucide-react';
import { ZipFileEntry } from '../../types';
import { humanSize } from '../../utils/security';

interface FilePreviewModalProps {
  entry: ZipFileEntry | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ entry, onClose }) => {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-800 truncate">
            <span>{entry.relativePath}</span>
            <span className="text-slate-400 font-normal">({humanSize(entry.size)})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
          {entry.isBinary ? (
            <div className="text-slate-400 text-center py-12">
              二进制文件内容（SHA-256: {entry.sha256}）
            </div>
          ) : (
            <pre className="whitespace-pre-wrap">{entry.content}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
