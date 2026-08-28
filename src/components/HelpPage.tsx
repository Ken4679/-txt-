import React, { useState } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  DEFAULT_PROMPTS,
} from '../utils/constants';

interface HelpPageProps {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HelpPage: React.FC<HelpPageProps> = ({ onShowToast }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyPrompt = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast('提示词模板已成功复制到剪贴板。', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>开发指南与提示词库</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">AI 提示词工程与最佳实践指南</h1>
        <p className="text-sm text-slate-500 mt-1">
          将完整代码库交付给大模型并稳定提取生产级代码补丁的核心法则与推荐 Prompt 模板。
        </p>
      </div>

      {/* 3 Core Rules Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>确保 100% 可用 AI 代码修改的 3 项铁律</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              1
            </div>
            <div className="text-xs font-bold text-slate-900">必须输出清晰的文件路径标头</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              要求大模型在每个代码块上方明确标明 <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono">### FILE: 相对路径/文件名.ext</code>，以便自动解析归档。
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              2
            </div>
            <div className="text-xs font-bold text-slate-900">严禁输出省略号或伪代码占位</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              在提示词中强调禁止使用 <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-rose-700 font-mono">// ... 其余代码保持不变</code> 等省略占位，确保生成的补丁文件可直接完整覆盖运行。
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              3
            </div>
            <div className="text-xs font-bold text-slate-900">支持输出截断自动修复与续写</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              当大模型达到单次输出 Token 上限导致代码块未闭合时，ZipToTxt 会自动闭合补齐代码围栏，并提供专门的续写提示词继续生成。
            </p>
          </div>
        </div>
      </div>

      {/* Built-in Prompt Templates */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900">内置生产级提示词模板库</h2>

        {[
          {
            key: 'primary',
            title: '全库代码开发 / 重构系统提示词 (标准推荐)',
            desc: '规范大模型遵守项目目录规范与架构契约的标准提示词。',
            content: DEFAULT_PROMPTS.primary,
          },
          {
            key: 'audit_cn',
            title: '零缺陷与高可用安全审计提示词 (中文专业版)',
            desc: '针对并发安全、内存泄漏、逻辑漏洞及生产级可靠性的严苛审查清单。',
            content: DEFAULT_PROMPTS.audit_cn,
          },
          {
            key: 'continue',
            title: '代码截断续写提示词 (Token Resumption)',
            desc: '指导大语言模型紧接上一个被截断的代码行精准无缝续写。',
            content: DEFAULT_PROMPTS.continue,
          },
        ].map(tpl => (
          <div
            key={tpl.key}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900">{tpl.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</p>
              </div>

              <button
                onClick={() => handleCopyPrompt(tpl.key, tpl.content)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedKey === tpl.key ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === tpl.key ? '已复制' : '复制模板'}</span>
              </button>
            </div>

            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-48 leading-relaxed">
              {tpl.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
