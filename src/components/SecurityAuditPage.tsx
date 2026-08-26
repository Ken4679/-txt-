import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  FileSearch,
  HardDrive,
  Cpu,
  AlertOctagon,
  CheckCircle2,
  Terminal,
  Shield,
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

  const getTestResult = (path: string) => {
    if (!path.trim()) return null;
    try {
      const norm = normalizeAiPath(path);
      const isSens = isSensitivePath(norm);
      return {
        safe: true,
        normalized: norm,
        sensitive: isSens,
        message: isSens
          ? '包含凭据/私钥文件，默认受保护'
          : '路径合法且安全，允许正常读写',
      };
    } catch (e: any) {
      return {
        safe: false,
        normalized: '',
        sensitive: false,
        message: e?.message || '非法路径已被安全策略拦截',
      };
    }
  };

  const testResult = getTestResult(testPath);

  const securityItems = [
    {
      title: '防路径穿越攻击 (Zip Slip Protection)',
      level: 'CRITICAL',
      desc: '严格拦截含有 ".."、"%2e%2e"、绝对路径 (如 /etc/passwd 或 C:\\) 以及 UNC 网络路径的恶意文件名，防止解压或重构时逃逸至父级系统目录。',
      icon: <Lock className="w-5 h-5 text-indigo-600" />,
      status: '主动防御',
    },
    {
      title: 'Windows 系统保留设备名过滤',
      level: 'HIGH',
      desc: '自动拦截 Windows 系统保留设备名（如 CON, PRN, AUX, NUL, COM1-9, LPT1-9 等），防止在 Windows 操作系统解压缩时造成系统卡死或非法句柄占用。',
      icon: <Cpu className="w-5 h-5 text-indigo-600" />,
      status: '主动防御',
    },
    {
      title: 'Unicode 隐蔽字符与 Trojan Source 清洗',
      level: 'HIGH',
      desc: '自动清洗双向覆写字符 (\\u202A-\\u202E)、零宽不可见字符 (\\u200B-\\u200F) 以及空字节 (\\0)，防止伪造可执行文件名或注入恶意路径。',
      icon: <Terminal className="w-5 h-5 text-indigo-600" />,
      status: '实时清洗',
    },
    {
      title: 'ZIP Bomb (抗资源耗尽与解压炸弹防御)',
      level: 'CRITICAL',
      desc: `限制单文件最大 ${humanSize(MAX_ZIP_SINGLE_FILE_BYTES)}，解压总大小上限 ${humanSize(MAX_ZIP_UNCOMPRESSED_BYTES)}，条目上限 ${MAX_ZIP_MEMBERS.toLocaleString()} 个。严格保护客户端内存，防止 DoS 崩溃。`,
      icon: <HardDrive className="w-5 h-5 text-indigo-600" />,
      status: '配额熔断',
    },
    {
      title: '敏感凭据与秘钥泄露保护',
      level: 'HIGH',
      desc: '在生成 Patch 补丁 ZIP 时，默认阻止覆盖或包含 .env 环境变量、私钥证书 (id_rsa, id_ed25519, .pem, .key, .pfx)、云平台服务凭据及 .git 配置。',
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      status: '权限隔离',
    },
    {
      title: '纯本地客户端沙箱执行 (Zero Data Transmission)',
      level: 'PRIVACY',
      desc: '所有 ZIP 解压、文本转换、SHA-256 哈希计算与补丁打包均完全在前端浏览器本地内存中执行，绝不上传任何代码至云端第三方服务器。',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      status: '100% 本地',
    },
  ];

  const limits = [
    { label: 'ZIP 压缩包上限', val: humanSize(MAX_ZIP_BYTES) },
    { label: '单文件解压上限', val: humanSize(MAX_ZIP_SINGLE_FILE_BYTES) },
    { label: '解压总容量上限', val: humanSize(MAX_ZIP_UNCOMPRESSED_BYTES) },
    { label: 'ZIP 文件成员上限', val: `${MAX_ZIP_MEMBERS.toLocaleString()} 个` },
    { label: 'AI 单次输入上限', val: humanSize(MAX_AI_INPUT_BYTES) },
    { label: '补丁输出总容量上限', val: humanSize(MAX_AI_TOTAL_OUTPUT_BYTES) },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">03 · 安全合规与架构审计体系</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            全套主动防御已启用
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          ZipToTxt 具备工业级静态安全审计体系，防御 Zip Slip 路径穿越、解压炸弹与敏感凭证泄露。
        </p>
      </div>

      {/* Interactive Path Validator */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-indigo-600" />
          交互式相对路径安全校验器 (Path Sanitizer Tester)
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={testPath}
            onChange={e => setTestPath(e.target.value)}
            placeholder="输入测试路径，例如: ../etc/passwd 或 src/main.py 或 .env"
            className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
          />
        </div>

        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
              !testResult.safe
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : testResult.sensitive
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{testResult.message}</span>
            {testResult.normalized && (
              <span className="text-[11px] text-slate-500">
                规范化: {testResult.normalized}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Safety Quota Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-indigo-600" />
          系统安全熔断限额 (Security Quotas)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {limits.map(l => (
            <div key={l.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 block truncate">{l.label}</span>
              <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">{l.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Defense Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityItems.map((item, idx) => (
          <div
            key={idx}
            className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    防护等级: {item.level}
                  </span>
                </div>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                {item.status}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};