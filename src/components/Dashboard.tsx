import React from 'react';
import {
  Archive,
  FileCode,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  HelpCircle,
  FileText,
  Layers,
  CheckCircle2,
  GitCompare,
} from 'lucide-react';
import { ActivePage, ProjectSummary } from '../types';

interface DashboardProps {
  onNavigate: (page: ActivePage) => void;
  currentProject: ProjectSummary | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, currentProject }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Code Workspace & Context Bridge</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
            Prepare your codebase for AI-assisted development.
          </h1>

          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            ZipToTxt bridges the gap between local repositories and Large Language Models.
            Convert full ZIP codebases into structured AI context, then parse AI responses
            back into safe, verified patch ZIP archives in seconds.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              id="dashboard-start-convert-btn"
              onClick={() => onNavigate('convert')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Archive className="w-4 h-4" />
              <span>Convert Project (ZIP → TXT)</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>

            <button
              id="dashboard-start-patch-btn"
              onClick={() => onNavigate('patch')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium transition-all shadow-2xs cursor-pointer active:scale-98"
            >
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>Apply AI Patch (Markdown → ZIP)</span>
            </button>
          </div>
        </div>

        {/* Decorative background visual */}
        <div className="hidden md:block absolute right-8 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
          <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100/80 p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Sandbox Ready
              </span>
              <span>100% Local</span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-slate-600 bg-white/90 p-3 rounded-lg border border-slate-200/60">
              <div className="text-indigo-600 font-semibold">ZIP / Repo</div>
              <div className="text-slate-400"> ↓ scan & sanitize</div>
              <div className="text-slate-800 font-medium">Context TXT (Tree + Code)</div>
              <div className="text-slate-400"> ↓ AI prompt & response</div>
              <div className="text-emerald-700 font-semibold">Verified Patch ZIP</div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono text-right">
              Zero Server Uploads
            </div>
          </div>
        </div>
      </div>

      {/* Primary Workflow Visual Step Map */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recommended End-to-End Workflow</h2>
            <p className="text-xs text-slate-500 mt-0.5">How ZipToTxt coordinates your AI development loop</p>
          </div>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
            6-Step Fast Track
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {
              step: '1',
              title: 'Select ZIP',
              desc: 'Drop codebase archive',
              icon: <Archive className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '2',
              title: 'Analyze',
              desc: 'ASCII tree & token estimation',
              icon: <Layers className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '3',
              title: 'Export TXT',
              desc: 'Copy Prompt + Code context',
              icon: <FileText className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '4',
              title: 'Send to AI',
              desc: 'Claude / GPT / DeepSeek / Gemini',
              icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '5',
              title: 'Parse Patch',
              desc: 'Extract code blocks & review diff',
              icon: <GitCompare className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '6',
              title: 'Export ZIP',
              desc: 'Clean, verified patch archive',
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/60">
                  0{item.step}
                </span>
                {item.icon}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{item.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Convert */}
        <div
          id="feature-card-convert"
          onClick={() => onNavigate('convert')}
          className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Archive className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Convert Project
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Export complete source code repositories into clean, structured Markdown TXT with ASCII directory tree and token budget analysis.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
            <span>Launch Converter</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: AI Patch */}
        <div
          id="feature-card-patch"
          onClick={() => onNavigate('patch')}
          className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              AI Patch & Diff
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Paste AI responses directly. The tolerant parser detects modified files, heals truncated fences, displays visual diffs, and exports patch ZIPs.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>Apply AI Changes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Security */}
        <div
          id="feature-card-security"
          onClick={() => onNavigate('audit')}
          className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Security & Sandboxing
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Real-time protection against Zip Slip, Zip Bomb, Unicode Trojan Source, Windows reserved names, and sensitive credentials exposure.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>View Security Matrix</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Active Project Quick Card if loaded */}
      {currentProject && (
        <div className="bg-gradient-to-r from-indigo-50/70 via-white to-white border border-indigo-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 font-mono">{currentProject.name}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  Loaded
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentProject.totalFiles} files • {currentProject.textFiles} text • ~{currentProject.estimatedTokens.toLocaleString()} tokens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('convert')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 shadow-2xs"
            >
              View TXT Context
            </button>
            <button
              onClick={() => onNavigate('patch')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-2xs"
            >
              Patch Changes
            </button>
          </div>
        </div>
      )}

      {/* Privacy & Safety Guarantee */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">100% Client-Side Private Sandbox: </span>
            <span>All file parsing, token estimation, and ZIP generation run locally in your browser memory.</span>
          </div>
        </div>
        <button
          onClick={() => onNavigate('help')}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Documentation & Prompts</span>
        </button>
      </div>
    </div>
  );
};
