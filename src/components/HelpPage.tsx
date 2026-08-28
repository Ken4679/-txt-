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
    onShowToast('Prompt template copied to clipboard.', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Documentation & Guidelines</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Prompt Engineering & Workflow Guide</h1>
        <p className="text-sm text-slate-500 mt-1">
          Best practices for feeding whole codebases into LLMs and extracting production-grade patches without hallucinated paths.
        </p>
      </div>

      {/* 3 Core Rules Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>The 3 Rules for 100% Reliable AI Code Modifications</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              1
            </div>
            <div className="text-xs font-bold text-slate-900">Always Output Full Path Header</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Instruct the AI to use <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono">### FILE: relative/path.ext</code> directly before each code block.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              2
            </div>
            <div className="text-xs font-bold text-slate-900">Never Output Truncated Placeholders</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Forbid comments like <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-rose-700 font-mono">// ...rest of code</code> in the prompt so the generated patch file is 100% valid.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center mb-2">
              3
            </div>
            <div className="text-xs font-bold text-slate-900">Auto-Heal Token Cutoffs</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              If an AI response runs out of tokens mid-file, ZipToTxt automatically heals the missing closing fence and flags it for your review.
            </p>
          </div>
        </div>
      </div>

      {/* Built-in Prompt Templates */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Built-in Production Prompt Templates</h2>

        {[
          {
            key: 'primary',
            title: 'Full Repository Context & Feature Development',
            desc: 'The standard system prompt to instruct LLMs to maintain exact folder hierarchies.',
            content: DEFAULT_PROMPTS.primary,
          },
          {
            key: 'audit_cn',
            title: 'Security, Defect & Production Audit (Bilingual / CN)',
            desc: 'Rigorous architectural code review checklist for zero-bug deployment.',
            content: DEFAULT_PROMPTS.audit_cn,
          },
          {
            key: 'continue',
            title: 'Continuation & Token Resumption Prompt',
            desc: 'Instructs the LLM to resume an interrupted code block from the exact line it left off.',
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
                <span>{copiedKey === tpl.key ? 'Copied' : 'Copy Template'}</span>
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
