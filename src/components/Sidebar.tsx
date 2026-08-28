import React from 'react';
import { ActivePage, ProjectSummary } from '../types';
import {
  LayoutDashboard,
  Archive,
  FileCode,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  currentProject: ProjectSummary | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
  currentProject,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActivePage,
      label: '控制台',
      desc: '工作流概览与快速启动',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'convert' as ActivePage,
      label: '项目转换',
      desc: 'ZIP → AI 上下文 TXT',
      icon: <Archive className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'patch' as ActivePage,
      label: '应用 AI 补丁',
      desc: 'Markdown → Patch ZIP',
      icon: <FileCode className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audit' as ActivePage,
      label: '安全审计与配额',
      desc: 'Zip Slip 与沙箱防护',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'help' as ActivePage,
      label: '提示词与指南',
      desc: '生产级模板与最佳实践',
      icon: <HelpCircle className="w-4 h-4 shrink-0" />,
    },
  ];

  // Map legacy IDs to canonical IDs
  const canonicalActivePage =
    activePage === 'export' ? 'convert' : activePage === 'import' ? 'patch' : activePage;

  return (
    <aside className="w-64 bg-white text-slate-800 flex flex-col flex-shrink-0 border-r border-slate-200 select-none shadow-xs">
      {/* App Header / Brand */}
      <div className="p-5 border-b border-slate-100">
        <div
          onClick={() => onPageChange('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs border border-indigo-100 shrink-0 bg-white flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform">
            <img
              src="/app-icon.png"
              alt="ZipToTxt Logo"
              className="w-full h-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                ZipToTxt
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">AI Code Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase px-3 py-1 mb-1">
          功能导航
        </div>
        {navItems.map(item => {
          const isActive = canonicalActivePage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-100 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight truncate">{item.label}</div>
                  <div className={`text-[10px] leading-tight mt-0.5 truncate ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Active Project Card in Sidebar if any */}
      {currentProject && (
        <div className="mx-3 mb-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 truncate">{currentProject.name}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-mono">
              已载入
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            {currentProject.totalFiles} 个文件 • 约 {currentProject.estimatedTokens.toLocaleString()} Token
          </div>
        </div>
      )}

      {/* Security Engine Badge Card */}
      <div className="p-3 m-3 rounded-xl bg-slate-50 border border-slate-200">
        <div
          onClick={() => onPageChange('audit')}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-700 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>本地安全沙箱已就绪</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 leading-tight">
            100% 浏览器内存处理 • 零服务端回传
          </p>
        </div>
      </div>
    </aside>
  );
};
