import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  HardDrive,
  Cpu,
  AlertOctagon,
  Terminal,
  Search,
} from 'lucide-react';
import {
  MAX_ZIP_BYTES,
  MAX_ZIP_MEMBERS,
  MAX_ZIP_UNCOMPRESSED_BYTES,
  MAX_ZIP_SINGLE_FILE_BYTES,
  MAX_AI_INPUT_BYTES,
  MAX_AI_TOTAL_OUTPUT_BYTES,
} from '../utils/constants';
import { humanSize, normalizeAiPath, isSensitivePath } from '../utils/security';

export const SecurityAuditPage: React.FC = () => {
  const [testPath, setTestPath] = useState<string>('');

  const getPathValidation = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return null;
    try {
      const normalized = normalizeAiPath(trimmed);
      const isSens = isSensitivePath(normalized);
      return {
        valid: true,
        normalized,
        isSensitive: isSens,
        message: isSens
          ? '⚠️ 路径格式合规，但命中敏感凭据/私钥规则（默认被保护隔离）。'
          : '✅ 安全合规的相对文件路径。',
      };
    } catch (e: any) {
      return {
        valid: false,
        normalized: '',
        isSensitive: false,
        message: `❌ 安全拦截：${e.message || '非法文件路径'}`,
      };
    }
  };

  const validation = getPathValidation(testPath);

  const securityItems = [
    {
      title: 'Zip Slip 与路径穿越深度拦截',
      level: 'CRITICAL',
      desc: '严格阻断 ".."、"%2e%2e"、绝对路径 (/etc/passwd, C:\\) 以及 UNC 网络共享路径 (\\\\server\\share)，杜绝恶意压缩包逃逸出工作区目录。',
      icon: <Lock className="w-5 h-5 text-emerald-600" />,
      status: '主动拦截',
    },
    {
      title: 'Windows 保留设备名防御',
      level: 'HIGH',
      desc: '过滤 Windows 保留设备名称（CON, PRN, AUX, NUL, COM1-9, LPT1-9 及 aux.py 等后缀），防止在 Windows 操作系统解压时造成文件锁死或系统异常。',
      icon: <Cpu className="w-5 h-5 text-indigo-600" />,
      status: '主动拦截',
    },
    {
      title: 'Unicode Trojan Source 与不可见字符清洗',
      level: 'HIGH',
      desc: '剥离双向文本覆盖字符 (\\u202A-\\u202E)、零宽空格 (\\u200B-\\u200F) 以及空字节注入 (\\0)，防止代码视觉欺骗与隐蔽载荷注入。',
      icon: <Terminal className="w-5 h-5 text-indigo-600" />,
      status: '主动清洗',
    },
    {
      title: 'Zip Bomb 压缩炸弹与资源消耗配额',
      level: 'CRITICAL',
      desc: `限制单文件上限 ${humanSize(MAX_ZIP_SINGLE_FILE_BYTES)}、解压总上限 ${humanSize(MAX_ZIP_UNCOMPRESSED_BYTES)} 以及最多 ${MAX_ZIP_MEMBERS.toLocaleString()} 个文件，保护浏览器内存与系统稳定。`,
      icon: <HardDrive className="w-5 h-5 text-amber-600" />,
      status: '资源配额',
    },
    {
      title: '敏感凭据与私钥安全隔离屏障',
      level: 'HIGH',
      desc: '在解析与补丁生成时，自动标记并隔离 .env 环境变量、SSH 私钥 (id_rsa, id_ed25519, .pem)、云凭据及 .git 内部对象，需用户主动授权才能打包。',
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      status: '权限隔离',
    },
    {
      title: '100% 浏览器本地私密沙箱',
      level: 'PRIVACY',
      desc: '所有 ZIP 解压、文本序列化、SHA-256 哈希计算、Token 估算及补丁打包均完全在您当前的浏览器内存中执行，无任何代码上传至外部服务器。',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      status: '100% 本地',
    },
  ];

  const limits = [
    { label: 'ZIP 压缩包最大体积', val: humanSize(MAX_ZIP_BYTES) },
    { label: '单文件最大解压体积', val: humanSize(MAX_ZIP_SINGLE_FILE_BYTES) },
    { label: '解压后总数据上限', val: humanSize(MAX_ZIP_UNCOMPRESSED_BYTES) },
    { label: '最大归档文件总数', val: `${MAX_ZIP_MEMBERS.toLocaleString()} 个` },
    { label: 'AI 输入文本最大上限', val: humanSize(MAX_AI_INPUT_BYTES) },
    { label: 'AI 补丁导出最大上限', val: humanSize(MAX_AI_TOTAL_OUTPUT_BYTES) },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>安全架构体系</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">安全审计与防护配额</h1>
        <p className="text-sm text-slate-500 mt-1">
          ZipToTxt 遵循企业级防御标准，提供严苛的输入清洗、Zip Slip 路径逃逸防御与纯本地沙箱保障。
        </p>
      </div>

      {/* Interactive Path Validator Sandbox */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span>交互式路径清洗与安全沙箱测试</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            输入任意文件路径，即时测试 Zip Slip、Trojan Source 及 Windows 保留设备名的实时防御效果。
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="测试输入：../etc/passwd, src/main.py, CON.txt, 或 .env"
              value={testPath}
              onChange={e => setTestPath(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400">快速测试用例：</span>
            {[
              'src/components/App.tsx',
              '../etc/passwd',
              '%2e%2e/secret.key',
              'CON.txt',
              '.env.production',
              'id_rsa',
              'src/\u202emain.py',
            ].map((tc, idx) => (
              <button
                key={idx}
                onClick={() => setTestPath(tc)}
                className="text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                {tc}
              </button>
            ))}
          </div>

          {validation && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-mono mt-3 ${
                validation.valid
                  ? validation.isSensitive
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="font-sans font-bold mb-1">{validation.message}</div>
              {validation.valid && (
                <div>
                  <span className="text-slate-500 font-sans">规范化后安全路径：</span>
                  <span className="font-bold">{validation.normalized}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Security Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  {item.icon}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${
                    item.level === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : item.level === 'PRIVACY'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Resource Limits Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-600" />
          <span>运行配额与资源边界限制</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {limits.map((l, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="text-[11px] text-slate-500">{l.label}</div>
              <div className="text-sm font-bold text-slate-900 font-mono mt-1">{l.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
