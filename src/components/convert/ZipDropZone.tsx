import React, { useRef, useState } from 'react';
import { Upload, Archive, FolderUp, ShieldCheck, Sparkles } from 'lucide-react';
import { DirectFileInput } from '../../utils/zipToTxt';

interface ZipDropZoneProps {
  isProcessing: boolean;
  onFileSelect: (file: File) => void;
  onFolderSelect?: (folderFiles: DirectFileInput[], rootName: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ZipDropZone: React.FC<ZipDropZoneProps> = ({
  isProcessing,
  onFileSelect,
  onFolderSelect,
  onShowToast,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Helper to read entries from DataTransferItem (supports folder dragging)
  const readDirectoryEntries = async (entry: any, basePath = ''): Promise<DirectFileInput[]> => {
    const results: DirectFileInput[] = [];
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
      const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      results.push({ relativePath: relPath, file });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readEntries = async (): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          dirReader.readEntries((entries: any[]) => resolve(entries), reject);
        });
      };
      let entries: any[] = [];
      let batch: any[] = [];
      do {
        batch = await readEntries();
        entries = entries.concat(batch);
      } while (batch.length > 0);

      for (const child of entries) {
        const nextBase = basePath ? `${basePath}/${entry.name}` : entry.name;
        const childFiles = await readDirectoryEntries(child, nextBase);
        results.push(...childFiles);
      }
    }
    return results;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const firstItem = e.dataTransfer.items[0];
      const entry = (firstItem as any).webkitGetAsEntry?.();

      if (entry && entry.isDirectory) {
        try {
          const directFiles = await readDirectoryEntries(entry, '');
          if (directFiles.length === 0) {
            onShowToast('所拖入的文件夹中未包含任何文件。', 'error');
            return;
          }
          if (onFolderSelect) {
            onFolderSelect(directFiles, entry.name);
          } else {
            onShowToast('暂不支持文件夹解析。', 'error');
          }
        } catch {
          onShowToast('读取文件夹失败，请尝试选择 ZIP 文件。', 'error');
        }
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        onShowToast('请拖入有效的 .ZIP 压缩包或工程代码文件夹。', 'error');
        return;
      }
      onFileSelect(file);
    }
  };

  const handleZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const directFiles: DirectFileInput[] = [];
    let rootDirName = 'project';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      if (i === 0 && file.webkitRelativePath) {
        rootDirName = file.webkitRelativePath.split('/')[0] || 'project';
      }
      directFiles.push({
        relativePath: relPath,
        file,
      });
    }

    if (onFolderSelect && directFiles.length > 0) {
      onFolderSelect(directFiles, rootDirName);
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
        onChange={handleZipInputChange}
        accept=".zip"
        className="hidden"
        id="zip-file-input"
      />

      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        id="folder-file-input"
      />

      <div className="max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-xs">
          <Upload className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">
            拖拽 ZIP 代码压缩包 或 源码文件夹 至此
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            支持直接拖入整个工程文件夹、GitHub 归档包，全本地内存解析无服务器上传
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            id="choose-zip-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-medium transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            <span>选择 ZIP 文件</span>
          </button>

          <button
            id="choose-folder-button"
            onClick={() => folderInputRef.current?.click()}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 active:scale-98 text-sm font-medium transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <FolderUp className="w-4 h-4 text-indigo-600" />
            <span>选择工程文件夹</span>
          </button>
        </div>

        {/* Reassurance pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% 浏览器本地沙箱
          </span>
          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            自动跳过 node_modules/dist
          </span>
        </div>
      </div>
    </div>
  );
};

