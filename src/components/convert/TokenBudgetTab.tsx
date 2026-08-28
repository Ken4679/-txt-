import React from 'react';
import { TokenEstimation } from '../../utils/tokenEstimator';

interface TokenBudgetTabProps {
  tokenStats: TokenEstimation | null;
}

export const TokenBudgetTab: React.FC<TokenBudgetTabProps> = ({ tokenStats }) => {
  if (!tokenStats) return null;

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-indigo-900 leading-relaxed">
        <strong>多模型 Token 测算原理：</strong> 综合模拟主流分词器（BPE / tiktoken / SentencePiece）在英文标点、缩进空格、代码关键字及 CJK 中文字符上的分词加权比率，提供精准的上下文容量评估。
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 text-[10px] font-sans font-medium">GPT-4o (o200k 分词器)</div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {tokenStats.gpt4oTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
            占 128k 窗口的 {tokenStats.contextUsage.gpt128k}%
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 text-[10px] font-sans font-medium">Claude 3.5 Sonnet</div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {tokenStats.claudeTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
            占 200k 窗口的 {tokenStats.contextUsage.claude200k}%
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 text-[10px] font-sans font-medium">DeepSeek V3 / R1</div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {tokenStats.deepseekTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
            占 128k 窗口的 {tokenStats.contextUsage.deepseek128k}%
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 text-[10px] font-sans font-medium">Gemini 1.5 / 2.0</div>
          <div className="text-base font-bold text-slate-900 mt-1">
            {tokenStats.geminiTokens.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
            占 100万 窗口的 {tokenStats.contextUsage.gemini1m}%
          </div>
        </div>
      </div>
    </div>
  );
};
