import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Code,
  FolderArchive,
  Sparkles,
  Copy,
  CheckCheck,
  Check,
} from 'lucide-react';
import { DEFAULT_PROMPTS } from '../utils/constants';

export const HelpPage: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyPrompt = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const steps = [
    {
      step: '01',
      title: '正向导出 (ZIP → TXT 上下文)',
      desc: '下载 GitHub 仓库代码 ZIP 包（Code → Download ZIP），拖入本工具中生成单一 TXT 文件。包含目录树、源码文本与 Token 估算。可直接发送给任意大模型。',
      icon: <FolderArchive className="w-5 h-5 text-indigo-600" />,
    },
    {
      step: '02',
      title: '装配 Prompt 规范交互',
      desc: '在提问时附带工作台提供的“AI 需求实现 Prompt”或“生产级审计 Prompt”。AI 会按照标准文件块格式返回修改或新增的代码，杜绝省略号截断。',
      icon: <Sparkles className="w-5 h-5 text-emerald-600" />,
    },
    {
      step: '03',
      title: '反向打补丁 (Markdown → Patch ZIP)',
      desc: '将 AI 输出的回答全文粘贴到“应用 AI 修改”页面中，系统自动高容错识别各个代码块，一键打包生成只包含修改文件的纯净 patch.zip。',
      icon: <Zap className="w-5 h-5 text-amber-600" />,
    },
    {
      step: '04',
      title: '全流程安全防护与审计',
      desc: '内置 Zip Slip 路径穿越防御、符号链接拦截、ZIP Bomb 熔断保护与敏感文件过滤（.git、.env、私钥证书默认阻止覆盖）。',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Brand Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 text-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm border border-indigo-100 shrink-0 bg-white flex items-center justify-center p-1">
            <img
              src="/app-icon.png"
              alt="ZipToTxt App Icon"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">ZipToTxt · AI Code Workspace</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-semibold">
                v3.1 Light Edition
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              专为大模型上下文吞吐与工程自动化设计的「代码仓库压缩包 ⇄ 结构化 TXT ⇄ AI 代码补丁」双向工作台。
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <a
            href="/app-icon.ico"
            download="app.ico"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            下载 Windows .ICO
          </a>
          <a
            href="/app-icon.png"
            download="app-icon.png"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
          >
            下载高清 PNG
          </a>
        </div>
      </div>

      {/* 4 Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map(s => (
          <div
            key={s.step}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  {s.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {s.step}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* AI Output Specification Guide */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Code className="w-4 h-4 text-indigo-600" />
            AI 标准返回格式规范 (Standard Markdown Fence Format)
          </h3>
          <button
            onClick={() => handleCopyPrompt(DEFAULT_PROMPTS.primary, 'guide_primary')}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedKey === 'guide_primary' ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                已复制 Prompt
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                复制主 Prompt 模板
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          为了使工作台能够 100% 精确提取改动文件，AI 输出需遵循如下格式：
        </p>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs overflow-x-auto leading-relaxed">
          <div className="text-slate-400 mb-1">// 文件一：Python 源码示例</div>
          <span className="text-indigo-600 font-bold">### FILE: src/main.py</span>
          <br />
          <span className="text-slate-500">```python</span>
          <br />
          <span className="text-slate-800">print("hello world")</span>
          <br />
          <span className="text-slate-500">```</span>
          <br />
          <br />
          <div className="text-slate-400 mb-1">// 文件二：配置文件示例</div>
          <span className="text-indigo-600 font-bold">### FILE: config/settings.json</span>
          <br />
          <span className="text-slate-500">```json</span>
          <br />
          <span className="text-slate-800">&#123;</span>
          <br />
          <span className="text-slate-800">  "enabled": true</span>
          <br />
          <span className="text-slate-800">&#125;</span>
          <br />
          <span className="text-slate-500">```</span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <span className="font-bold shrink-0">⚠️ 提示：</span>
          <span>
            请要求 AI 始终输出修改后文件的完整可运行源码，禁止使用“...代码保持不变...”等省略符号。
          </span>
        </div>
      </div>
    </div>
  );
};