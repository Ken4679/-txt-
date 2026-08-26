import React from 'react';
import { ActivePage } from '../types';
import { Archive, FileCode, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface SidebarProps {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onPageChange }) => {
  const navItems: { id: ActivePage; label: string; number: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'export',
      number: '01',
      label: '导出仓库上下文',
      desc: 'ZIP → 结构化 TXT',
      icon: <Archive className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'import',
      number: '02',
      label: '应用 AI 修改补丁',
      desc: 'Markdown → Patch ZIP',
      icon: <FileCode className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'audit',
      number: '03',
      label: '安全合规与配额',
      desc: 'Zip Slip / 熔断防御',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'help',
      number: '04',
      label: '使用说明与规范',
      desc: 'Prompt 指南与工作流',
      icon: <HelpCircle className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <aside className="w-72 bg-white text-slate-800 flex flex-col flex-shrink-0 border-r border-slate-200 shadow-xs select-none">
      {/* App Header / Brand */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl overflow-hidden shadow-md shadow-indigo-500/15 border border-indigo-100 shrink-0 bg-white flex items-center justify-center p-0.5">
            <img
              src="/app-icon.png"
              alt="ZipToTxt Logo"
              className="w-full h-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">ZipToTxt</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                v3.1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">AI Code Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-4 space-y-2 flex-1">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 py-1">
          工作台模块导航
        </div>
        {navItems.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50/90 text-indigo-900 border border-indigo-200 shadow-xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight truncate">{item.label}</div>
                  <div className={`text-[11px] leading-tight mt-0.5 truncate ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
              </div>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ml-2 ${
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {item.number}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Security Engine Badge Card */}
      <div className="p-4 m-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-2xs">
        <div
          onClick={() => onPageChange('audit')}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>安全防御引擎就绪</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Zip Slip 防御 / 熔断配额 / 敏感凭据过滤均已激活
          </p>
        </div>
      </div>
    </aside>
  );
};