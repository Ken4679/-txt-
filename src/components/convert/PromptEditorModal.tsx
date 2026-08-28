import React from 'react';
import { X } from 'lucide-react';

interface PromptEditorModalProps {
  isOpen: boolean;
  title: string;
  draft: string;
  onChangeDraft: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
}

export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen,
  title,
  draft,
  onChangeDraft,
  onClose,
  onSave,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            rows={12}
            value={draft}
            onChange={e => onChangeDraft(e.target.value)}
            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            重置为默认模板
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer shadow-xs"
            >
              保存模板
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
