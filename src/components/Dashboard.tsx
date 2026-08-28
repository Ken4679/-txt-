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
  Terminal,
} from 'lucide-react';
import { ActivePage, ProjectSummary } from '../types';
import { humanSize } from '../utils/security';

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
            <span>AI 代码上下文桥梁 & 补丁工作台</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
            为大模型辅助开发准备您的完整代码库
          </h1>

          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            ZipToTxt 专注于打通本地代码库与大语言模型（Claude、GPT-4o、DeepSeek、Gemini）之间的协作闭环。一键将 ZIP 源码包转换为高质量的 AI 上下文 TXT，并将 AI 生成的代码修改秒级逆向打包为安全、干净的 Patch ZIP 补丁。
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              id="dashboard-start-convert-btn"
              onClick={() => onNavigate('convert')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Archive className="w-4 h-4" />
              <span>开始转换项目 (ZIP → TXT)</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>

            <button
              id="dashboard-start-patch-btn"
              onClick={() => onNavigate('patch')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium transition-all shadow-2xs cursor-pointer active:scale-98"
            >
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>应用 AI 补丁 (Markdown → ZIP)</span>
            </button>
          </div>
        </div>

        {/* Decorative background visual */}
        <div className="hidden md:block absolute right-8 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
          <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100/80 p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                安全沙箱就绪
              </span>
              <span>100% 本地运行</span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-slate-600 bg-white/90 p-3 rounded-lg border border-slate-200/60">
              <div className="text-indigo-600 font-semibold">ZIP 源码包</div>
              <div className="text-slate-400"> ↓ 路径校验 & 过滤</div>
              <div className="text-slate-800 font-medium">结构化 AI 上下文 TXT</div>
              <div className="text-slate-400"> ↓ 大模型修改代码</div>
              <div className="text-emerald-700 font-semibold">已校验 Patch ZIP 补丁</div>
            </div>
            <div className="text-[10px] text-slate-400 font-mono text-right">
              零云端上传 • 数据绝对安全
            </div>
          </div>
        </div>
      </div>

      {/* Active Project Quick Card if loaded */}
      {currentProject && (
        <div className="bg-gradient-to-r from-indigo-50/80 via-white to-white border border-indigo-200/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 font-mono">{currentProject.name}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  已就绪
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {currentProject.totalFiles} 个文件（{currentProject.textFiles} 文本 / {currentProject.binaryFiles} 二进制） • 约 {currentProject.estimatedTokens.toLocaleString()} Token • 大小 {humanSize(currentProject.totalSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('convert')}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50 shadow-2xs cursor-pointer"
            >
              查看 TXT 上下文
            </button>
            <button
              onClick={() => onNavigate('patch')}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-2xs cursor-pointer"
            >
              应用 AI 补丁
            </button>
          </div>
        </div>
      )}

      {/* Primary Workflow Visual Step Map */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">推荐端到端开发闭环</h2>
            <p className="text-xs text-slate-500 mt-0.5">ZipToTxt 如何协助您高效完成大模型辅助编程</p>
          </div>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
            7 步极速流程
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {[
            {
              step: '1',
              title: '选择项目',
              desc: '拖入 ZIP 源码压缩包',
              icon: <Archive className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '2',
              title: '分析项目',
              desc: '生成目录树与 Token 估算',
              icon: <Layers className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '3',
              title: '生成上下文',
              desc: '一键复制 Prompt 与代码',
              icon: <FileText className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '4',
              title: '交付 AI 修改',
              desc: 'Claude / GPT / DeepSeek',
              icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '5',
              title: '导入 AI 结果',
              desc: '自动修复截断代码块',
              icon: <Terminal className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '6',
              title: '检查代码变更',
              desc: '可视化行级 Diff 审查',
              icon: <GitCompare className="w-4 h-4 text-indigo-600" />,
            },
            {
              step: '7',
              title: '导出 Patch',
              desc: '生成干净可解压的 ZIP',
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between hover:bg-slate-50 transition-colors"
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
              项目代码转换 (ZIP → TXT)
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              将完整源码仓库导出为清晰、结构化的 Markdown TXT。包含 ASCII 目录层级树、安全过滤及主流大模型 Token 预算测算。
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
            <span>进入项目转换</span>
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
              应用 AI 补丁 (Markdown → ZIP)
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              直接粘贴大模型返回的代码文本。宽容解析引擎自动识别修改文件、修复缺失代码反引号、呈现代码 Diff 并生成 Patch ZIP。
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>进入补丁提取</span>
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
              安全审计与沙箱防护
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              内置 Zip Slip 目录穿越拦截、Windows 保留设备名防御、Unicode 木马源字符清洗及敏感秘钥安全隔离机制。
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>查看安全矩阵</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Privacy & Safety Guarantee */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">100% 浏览器本地私密沙箱：</span>
            <span>所有文件解析、Token 估算及 ZIP 压缩均在您的浏览器本地内存中执行，无任何代码回传至外部服务器。</span>
          </div>
        </div>
        <button
          onClick={() => onNavigate('help')}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>查看提示词指南</span>
        </button>
      </div>
    </div>
  );
};
