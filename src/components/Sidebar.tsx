import React from 'react';
import { ActivePage } from '../types';
import { Archive, FileCode, HelpCircle, ShieldCheck, Cpu } from 'lucide-react';

interface SidebarProps {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onPageChange }) => {
  const navItems: { id: ActivePage; label: string; number: string; icon: React.ReactNode }[] = [
    {
      id: 'export',
      number: '01',
      label: '导出仓库 (ZIP → TXT)',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'import',
      number: '02',
      label: '应用 AI 修改 (AI → Patch)',
      icon: <FileCode className="w-4 h-4" />,
    },
    {
      id: 'audit',
      number: '03',
      label: '安全与合规审计',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'help',
      number: '04',
      label: '使用说明与规范',
      icon: <HelpCircle className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* App Header */}
      <div className="px-6 pt-7 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">ZipToTxt</h1>
            <p className="text-xs text-slate-400 font-medium">AI Code Workspace 3.1</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1.5 flex-1">
        {navItems.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-indigo-700/80 text-indigo-100' : 'text-slate-500'
                }`}
              >
                {item.number}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Security Status Box */}
      <div
        onClick={() => onPageChange('audit')}
        className="p-4 m-4 rounded-xl bg-slate-800/70 border border-slate-700/60 cursor-pointer hover:border-slate-600 transition-colors"
      >
        <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold mb-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>安全审计保护已就绪</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          点击查看 Zip Slip 防御、配额熔断与脱敏审计
        </p>
      </div>
    </aside>
  );
};
