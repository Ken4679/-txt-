import React from 'react';
import {
  ShieldCheck,
  Zap,
  Code,
  FolderArchive,
  Sparkles,
} from 'lucide-react';

export const HelpPage: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: '导出仓库 (ZIP → TXT)',
      desc: '下载 GitHub 仓库代码 ZIP 包（Code → Download ZIP），拖入本工具中生成单一 TXT 文件。该 TXT 包含清晰的文件目录树、每份源码文本内容以及 SHA-256 校验哈希。可将此 TXT 直接发送给任何 AI 大模型。',
      icon: <FolderArchive className="w-5 h-5 text-indigo-600" />,
    },
    {
      step: '02',
      title: 'AI 编码与修改',
      desc: '在与 AI 对话时配合使用本工作台提供的“AI 主 Prompt”。AI 会按照指定格式输出修改或新建的代码块，无需手工一个个复制粘贴到各文件中。',
      icon: <Sparkles className="w-5 h-5 text-emerald-600" />,
    },
    {
      step: '03',
      title: '应用 AI 修改 (TXT → Patch ZIP)',
      desc: '将 AI 输出的回答全文粘贴到“应用 AI 修改”页面中，系统将自动识别出所有文件代码块并剔除废话，一键打包生成只包含修改文件的补丁 ZIP 压缩包。',
      icon: <Zap className="w-5 h-5 text-amber-600" />,
    },
    {
      step: '04',
      title: '内置安全防御体系',
      desc: '支持自动路径穿越防护（拦截 .. 与绝对路径）、符号链接拦截、ZIP Bomb 膨胀防护与敏感文件保护（.git、.env、秘钥证书文件默认禁止覆盖）。',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg border border-indigo-400/30 shrink-0 bg-slate-950 flex items-center justify-center">
            <img
              src="/app-icon.svg"
              alt="ZipToTxt App Icon"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">ZipToTxt · AI Code Workspace</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 font-mono">v3.1</span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              专为大模型上下文吞吐与工程自动化设计的“代码仓库压缩包 ⇄ 结构化 TXT 上下文 ⇄ AI 生产级代码补丁”双向工作台。
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <a
            href="/app-icon.svg"
            download="ziptotxt-icon.svg"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            下载图标 SVG
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
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Code className="w-4 h-4 text-indigo-600" />
          AI 标准返回格式规范
        </h3>
        <p className="text-xs text-slate-500">
          为了使工作台能够正确识别出各个文件，AI 需要输出以下格式的文件头与 Markdown 代码围栏：
        </p>

        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
          <div className="text-slate-400 mb-1">// 文件一：Python 源码示例</div>
          <span className="text-emerald-400">### FILE: src/main.py</span>
          <br />
          <span className="text-indigo-400">```python</span>
          <br />
          <span className="text-slate-200">print("hello world")</span>
          <br />
          <span className="text-indigo-400">```</span>
          <br />
          <br />
          <div className="text-slate-400 mb-1">// 文件二：配置文件示例</div>
          <span className="text-emerald-400">### FILE: config/settings.json</span>
          <br />
          <span className="text-indigo-400">```json</span>
          <br />
          <span className="text-slate-200">&#123;</span>
          <br />
          <span className="text-slate-200">  "enabled": true</span>
          <br />
          <span className="text-slate-200">&#125;</span>
          <br />
          <span className="text-indigo-400">```</span>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <span className="font-bold">⚠️ 提示：</span>
          <span>
            请勿让 AI 使用“...代码保持不变...”或缩写，要求 AI 必须输出修改后文件的完整代码，以确保生成的补丁准确无误。
          </span>
        </div>
      </div>
    </div>
  );
};
