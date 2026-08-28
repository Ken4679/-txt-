import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Download,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { ZipFileEntry } from '../../types';
import { TokenEstimation } from '../../utils/tokenEstimator';
import { humanSize } from '../../utils/security';

interface ProjectStatsSummaryProps {
  fileName?: string;
  fileSize?: number;
  tokenStats: TokenEstimation | null;
  fileEntries: ZipFileEntry[];
  ignoredCount: number;
  copiedType: string | null;
  onCopyPromptAndContext: () => void;
  onDownloadTxt: () => void;
  onResetZip: () => void;
  onNavigateToPatch?: () => void;
}

export const ProjectStatsSummary: React.FC<ProjectStatsSummaryProps> = ({
  fileName,
  fileSize = 0,
  tokenStats,
  fileEntries,
  ignoredCount,
  copiedType,
  onCopyPromptAndContext,
  onDownloadTxt,
  onResetZip,
  onNavigateToPatch,
}) => {
  const textCount = fileEntries.filter(f => !f.isBinary).length;
  const binaryCount = fileEntries.filter(f => f.isBinary).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 font-mono">
                {fileName}
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> 安全校验通过
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              已生成结构化 AI 上下文 • 原始归档包大小 {humanSize(fileSize)}
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-copy-prompt-context"
            onClick={onCopyPromptAndContext}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            {copiedType === 'full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedType === 'full' ? '已复制全部内容！' : '复制 Prompt + 源码上下文'}</span>
          </button>

          <button
            id="btn-download-txt"
            onClick={onDownloadTxt}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>下载 TXT 文件</span>
          </button>

          <button
            onClick={onResetZip}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>更换 ZIP</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">预计 Token 数</div>
          <div className="text-lg font-bold text-indigo-700 mt-1 font-mono">
            约 {tokenStats?.estimatedTokens.toLocaleString() || '0'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">多模型加权估算值</div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">文本 / 源码文件</div>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {textCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {binaryCount} 个二进制文件{ignoredCount > 0 ? ` • ${ignoredCount} 已自动过滤` : ''}
          </div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">总代码行数</div>
          <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
            {tokenStats?.lines.toLocaleString() || '0'} 行
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Markdown 格式化后</div>
        </div>

        <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">安全防护状态</div>
          <div className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>完全安全</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Zip Slip 与木马源已清洗</div>
        </div>
      </div>

      {/* Direct Workflow Navigation link */}
      {onNavigateToPatch && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            已复制上下文发给大模型？获得大模型的修改回复后：
          </span>
          <button
            onClick={onNavigateToPatch}
            className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>前往第二步：应用 AI 补丁 (Markdown → ZIP)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
