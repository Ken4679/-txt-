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
          ? '⚠️ Valid relative path, but contains sensitive keys or credentials (protected by default).'
          : '✅ Safe, fully compliant relative path.',
      };
    } catch (e: any) {
      return {
        valid: false,
        normalized: '',
        isSensitive: false,
        message: `❌ Security Block: ${e.message || 'Illegal path'}`,
      };
    }
  };

  const validation = getPathValidation(testPath);

  const securityItems = [
    {
      title: 'Zip Slip & Path Traversal Defense',
      level: 'CRITICAL',
      desc: 'Strictly blocks directory traversal sequences like "..", "%2e%2e", absolute paths (/etc/passwd, C:\\), and UNC network shares (\\\\server\\share), preventing malicious archives from escaping outside repository boundaries.',
      icon: <Lock className="w-5 h-5 text-emerald-600" />,
      status: 'Active Defense',
    },
    {
      title: 'Windows Reserved Device Names Protection',
      level: 'HIGH',
      desc: 'Filters Windows special device files (CON, PRN, AUX, NUL, COM1-9, LPT1-9, and suffixes like aux.py) to prevent filesystem lockups or OS crashes on Windows developer machines.',
      icon: <Cpu className="w-5 h-5 text-indigo-600" />,
      status: 'Active Defense',
    },
    {
      title: 'Unicode Trojan Source & Invisible Character Sanitization',
      level: 'HIGH',
      desc: 'Strips bidirectional override characters (\\u202A-\\u202E), zero-width spaces (\\u200B-\\u200F), and null-byte injection (\\0) to prevent visual spoofing or stealth payload delivery.',
      icon: <Terminal className="w-5 h-5 text-indigo-600" />,
      status: 'Active Sanitization',
    },
    {
      title: 'Zip Bomb & Resource Exhaustion Limits',
      level: 'CRITICAL',
      desc: `Enforces single file limit ${humanSize(MAX_ZIP_SINGLE_FILE_BYTES)}, total uncompressed limit ${humanSize(MAX_ZIP_UNCOMPRESSED_BYTES)}, and member count limit ${MAX_ZIP_MEMBERS.toLocaleString()} to protect browser memory and system stability.`,
      icon: <HardDrive className="w-5 h-5 text-amber-600" />,
      status: 'Resource Bounds',
    },
    {
      title: 'Sensitive Credentials & Secret Key Shield',
      level: 'HIGH',
      desc: 'Automatically quarantines .env files, private keys (id_rsa, id_ed25519, .pem), cloud credentials, and .git internals during patch generation unless explicitly confirmed by the user.',
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      status: 'Isolated Permission',
    },
    {
      title: '100% Client-Side Local Execution Sandbox',
      level: 'PRIVACY',
      desc: 'All ZIP parsing, text serialization, SHA-256 digests, token estimation, and patch creation occur exclusively inside your local browser runtime. No code is transmitted to remote servers.',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      status: '100% Local',
    },
  ];

  const limits = [
    { label: 'Max ZIP Archive Size', val: humanSize(MAX_ZIP_BYTES) },
    { label: 'Max Single File Size', val: humanSize(MAX_ZIP_SINGLE_FILE_BYTES) },
    { label: 'Max Total Uncompressed Size', val: humanSize(MAX_ZIP_UNCOMPRESSED_BYTES) },
    { label: 'Max Archive Members', val: `${MAX_ZIP_MEMBERS.toLocaleString()} files` },
    { label: 'Max AI Input Payload', val: humanSize(MAX_AI_INPUT_BYTES) },
    { label: 'Max AI Output Extraction', val: humanSize(MAX_AI_TOTAL_OUTPUT_BYTES) },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Security Architecture</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Security Audit & Quota Bounds</h1>
        <p className="text-sm text-slate-500 mt-1">
          ZipToTxt implements enterprise-grade input sanitization, Zip Slip mitigation, and client-side sandboxing.
        </p>
      </div>

      {/* Interactive Path Validator Sandbox */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span>Interactive Path Sanitization Sandbox</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Test any file path against the real-time Zip Slip, Trojan Source, and Reserved Device Name defense engine.
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Try: ../etc/passwd, src/main.py, CON.txt, or .env"
              value={testPath}
              onChange={e => setTestPath(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400">Quick Test Cases:</span>
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
                  <span className="text-slate-500 font-sans">Normalized Clean Path: </span>
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
          <span>Operational Quotas & Resource Boundaries</span>
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
