import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ExportPage } from './components/ExportPage';
import { ImportPage } from './components/ImportPage';
import { SecurityAuditPage } from './components/SecurityAuditPage';
import { HelpPage } from './components/HelpPage';
import { ActivePage, ProcessStatus } from './types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>('export');
  const [status, setStatus] = useState<ProcessStatus>({
    message: '就绪',
    progress: 0,
    isProcessing: false,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleStatusChange = (message: string, progress: number) => {
    setStatus({
      message,
      progress,
      isProcessing: progress > 0 && progress < 100,
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-800">
      {/* Left Light Sidebar */}
      <Sidebar activePage={activePage} onPageChange={setActivePage} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-7 min-w-0">
          {activePage === 'export' && (
            <ExportPage
              onStatusChange={handleStatusChange}
              onShowToast={showToast}
            />
          )}
          {activePage === 'import' && (
            <ImportPage
              onStatusChange={handleStatusChange}
              onShowToast={showToast}
            />
          )}
          {activePage === 'audit' && <SecurityAuditPage />}
          {activePage === 'help' && <HelpPage />}
        </main>

        {/* Global Bottom Status Bar (Light Theme) */}
        <footer className="h-11 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-xs text-slate-600 flex-shrink-0 shadow-2xs">
          <div className="flex items-center gap-4 flex-1 mr-8">
            <div className="w-48 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {status.progress}%
            </span>
          </div>

          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="truncate text-slate-700">{status.message}</span>
          </div>
        </footer>
      </div>

      {/* Floating Toast Notification Stack (Light Theme) */}
      <div className="fixed bottom-14 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium transition-all transform translate-y-0 ${
              toast.type === 'success'
                ? 'bg-white text-slate-800 border-emerald-300 shadow-emerald-500/10'
                : toast.type === 'error'
                ? 'bg-white text-slate-800 border-rose-300 shadow-rose-500/10'
                : 'bg-white text-slate-800 border-indigo-300 shadow-indigo-500/10'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            {toast.type === 'info' && (
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="max-w-xs">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 p-0.5 ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;