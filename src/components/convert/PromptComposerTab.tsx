import React from 'react';
import { Edit3 } from 'lucide-react';

interface PromptComposerTabProps {
  selectedPromptKey: string;
  onSelectPromptKey: (key: string) => void;
  userRequirement: string;
  onChangeUserRequirement: (req: string) => void;
  fullPromptText: string;
  onOpenPromptEditor: (key: string, title: string) => void;
}

export const PromptComposerTab: React.FC<PromptComposerTabProps> = ({
  selectedPromptKey,
  onSelectPromptKey,
  userRequirement,
  onChangeUserRequirement,
  fullPromptText,
  onOpenPromptEditor,
}) => {
  const promptTemplates = [
    {
      key: 'primary',
      label: '全库功能开发 / 代码重构',
      desc: '推荐：规范目录层级，严禁输出省略号占位符',
    },
    {
      key: 'audit_cn',
      label: '生产级缺陷与安全审计',
      desc: '严格排查逻辑漏洞、并发安全与性能瓶颈',
    },
    {
      key: 'continue',
      label: '截断代码续写提示词',
      desc: '当大模型输出达到上限截断时使用',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800">
          选择 AI 提示词任务目标模板：
        </label>
        <button
          onClick={() => onOpenPromptEditor(selectedPromptKey, '自定义当前提示词模板')}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>编辑此模板</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {promptTemplates.map(p => (
          <button
            key={p.key}
            onClick={() => onSelectPromptKey(p.key)}
            className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
              selectedPromptKey === p.key
                ? 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-semibold shadow-2xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div>{p.label}</div>
            <div className="text-[11px] text-slate-400 font-normal mt-0.5">{p.desc}</div>
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          您的具体业务需求（可选 - 将自动注入到 Prompt 占位符中）：
        </label>
        <textarea
          rows={3}
          placeholder="例如：请为认证模块增加 JWT 刷新机制，并为所有的工具函数编写单元测试..."
          value={userRequirement}
          onChange={e => onChangeUserRequirement(e.target.value)}
          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
        />
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-slate-500">
          生成的完整 Prompt 预览（前 1500 字符）：
        </span>
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-600 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {fullPromptText.slice(0, 1500)}...
        </div>
      </div>
    </div>
  );
};
