import React, { useRef, useState } from 'react';
import { Upload, Archive, ShieldCheck, Sparkles } from 'lucide-react';

interface ZipDropZoneProps {
  isProcessing: boolean;
  onFileSelect: (file: File) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ZipDropZone: React.FC<ZipDropZoneProps> = ({
  isProcessing,
  onFileSelect,
  onShowToast,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        onShowToast('请拖入有效的 .ZIP 代码压缩包。', 'error');
        return;
      }
      onFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all bg-white shadow-xs ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50/50 scale-[1.005]'
          : 'border-slate-300 hover:border-indigo-400'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
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
            拖拽 ZIP 代码压缩包至此区域
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            支持 GitHub Release 归档包、本地工程 ZIP，最大支持 512 MB
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
            <span>选择 ZIP 文件</span>
          </button>
        </div>

        {/* Reassurance pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% 浏览器本地处理
          </span>
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            多模型 Token 实时测算
          </span>
        </div>
      </div>
    </div>
  );
};
