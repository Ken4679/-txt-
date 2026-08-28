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
  AlertTriangle,
  Check,
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
          ? '⚠️ 路径合法但包含私钥/凭据/配置文件（默认受敏感保护）'
          : '✅ 路径完全合法，允许安全读取与覆写',
      };
    } catch (e: any) {
      return {
        valid: false,
        normalized: '',
        isSensitive: false,
        message: `❌ 安全拦截: ${e.message || '非法路径'}`,
      };
    }
  };

  const validation = getPathValidation(testPath);
  const securityItems = [
    {
      title: '防路径穿越攻击 (Zip Slip Protection)',
      level: 'CRITICAL',
      desc: '严格拦截含有 ".."、"%2e%2e"、绝对路径 (如 /etc/passwd 或 C:\\) 以及 UNC 网络路径的恶意文件名，防止恶意 ZIP 在解压或重构时逃逸至父级或系统关键目录。',
      icon: <Lock className="w-5 h-5 text-emerald-600" />,
      status: '主动防御',
    },
    {
      title: 'Windows 系统保留设备名过滤',
      level: 'HIGH',
      desc: '自动拦截 Windows 系统保留设备名（如 CON, PRN, AUX, NUL, COM1-9, LPT1-9 及带后缀如 aux.py），防止在 Windows 操作系统解压缩时造成系统卡死或非法句柄占用。',
      icon: <Cpu className="w-5 h-5 text-indigo-600" />,
      status: '主动防御',
    },
    {
      title: 'Unicode 隐蔽字符与 Trojan Source 清洗',
      level: 'HIGH',
      desc: '自动清洗双向覆写字符 (\\u202A-\\u202E)、零宽不可见字符 (\\u200B-\\u200F) 以及空字节 (\\0)，防止利用同形异义或不可见字符伪造可执行文件名或注入恶意路径。',
      icon: <Terminal className="w-5 h-5 text-indigo-600" />,
      status: '实时清洗',
    },
    {
      title: 'ZIP Bomb (抗资源耗尽与解压炸弹防御)',
      level: 'CRITICAL',
      desc: `限制单文件最大 ${humanSize(MAX_ZIP_SINGLE_FILE_BYTES)}，解压总大小上限 ${humanSize(MAX_ZIP_UNCOMPRESSED_BYTES)}，文件总数上限 ${MAX_ZIP_MEMBERS.toLocaleString()} 个。严格保护浏览器内存与系统资源，防止 DoS 崩溃。`,
      icon: <HardDrive className="w-5 h-5 text-amber-600" />,
      status: '配额熔断',
    },
    {
      title: '敏感凭据与秘钥泄露保护',
      level: 'HIGH',
      desc: '在生成 Patch 补丁 ZIP 时，默认阻止覆盖或包含 .env 环境变量、私钥证书 (id_rsa, id_ed25519, .pem, .key, .pfx)、云平台服务凭据及 .git 配置，需用户明确勾选二次授权才可允许。',
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      status: '权限隔离',
    },
    {
      title: '纯本地客户端沙箱执行 (Zero Data Transmission)',
      level: 'PRIVACY',
      desc: '所有 ZIP 解压、文本转换、SHA-256 哈希计算与补丁打包均完全在前端浏览器本地内存中执行，无需将您的源码上传至第三方云端服务器，保障商业源码绝对私密。',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
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
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">安全合规与架构审计报告</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            所有防御已通过自测
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          ZipToTxt 具备工业级的静态安全审计体系，防御常见文件解析漏洞与潜在恶意代码注入。
        </p>
      </div>

      {/* Safety Quota Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-indigo-600" />
          系统安全限额与配额 (Quotas)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {limits.map(l => (
            <div key={l.label} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 block truncate">{l.label}</span>
              <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">{l.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Interactive Path Validator */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            实时路径安全检测沙箱 (Live Path Security Validator)
          </h3>
          <span className="text-xs text-slate-400">实时测试 Zip Slip 穿透、Windows 设备名与敏感私钥识别</span>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={testPath}
              onChange={e => setTestPath(e.target.value)}
              placeholder="输入测试路径 (如: ../etc/passwd, ./src/main.py, CON.txt, .env.production, `src/app.ts`)"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {testPath && (
              <button
                onClick={() => setTestPath('')}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                清空
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400">快捷测试样例:</span>
            <button
              onClick={() => setTestPath('src/components/App.tsx')}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono cursor-pointer"
            >
              正常相对路径
            </button>
            <button
              onClick={() => setTestPath('./src/utils/tool.ts')}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono cursor-pointer"
            >
              带 ./ 前缀
            </button>
            <button
              onClick={() => setTestPath('../../etc/shadow')}
              className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono cursor-pointer"
            >
              Zip Slip 越权
            </button>
            <button
              onClick={() => setTestPath('CON.txt')}
              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-mono cursor-pointer"
            >
              Windows 保留设备名
            </button>
            <button
              onClick={() => setTestPath('.env.production')}
              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono cursor-pointer"
            >
              敏感密钥凭据
            </button>
          </div>

          {validation && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                !validation.valid
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : validation.isSensitive
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="mt-0.5">
                {!validation.valid ? (
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                ) : validation.isSensitive ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <p className="font-semibold">{validation.message}</p>
                {validation.valid && (
                  <p className="text-[11px] text-slate-600">
                    规范化标准路径: <span className="font-bold text-indigo-900">{validation.normalized}</span>
                  </p>
                )}
              </div>
            </div>
          )}
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
                    等级: {item.level}
                  </span>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
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
