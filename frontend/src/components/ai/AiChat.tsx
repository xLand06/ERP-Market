// =============================================================================
// AI CHAT — Floating Chat Component (ALLMARKET Design System)
// Mobile-responsive: full-screen sheet on mobile, floating widget on desktop
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/store/authStore';
import toast from 'react-hot-toast';
import {
    DollarSign,
    Trophy,
    Package,
    Users,
    BarChart3,
    TrendingUp,
} from 'lucide-react';
import { AiChatChart } from './AiChatChart';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string | null;
    rows?: any[] | null;
    exportData?: any[] | null;
    timestamp: Date;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const IconBot = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconClose = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconFile = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
);

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const IconDownload = ({ className = 'w-3 h-3' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
);

// ─── Quick Questions (Compact 2-col cards for mobile & desktop) ──────────────
const QUICK_QUESTIONS = [
    { icon: DollarSign, text: '¿Cuánto vendí hoy?', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
    { icon: Trophy, text: 'Top 5 más vendidos', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
    { icon: Package, text: 'Productos con bajo stock', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40' },
    { icon: Users, text: 'Clientes que me deben', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
    { icon: BarChart3, text: 'Resumen semanal', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' },
    { icon: TrendingUp, text: 'Cómo vender más', color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40' },
];

// ─── Main Component ──────────────────────────────────────────────────────────
export function AiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuthStore();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Close on mobile hardware/gesture Back button
    useEffect(() => {
        let sub: any = null;
        (async () => {
            try {
                const { App } = await import('@capacitor/app');
                sub = await App.addListener('backButton', () => {
                    if (isOpen) {
                        setIsOpen(false);
                    }
                });
            } catch {}
        })();
        return () => {
            sub?.remove?.().catch?.(() => {});
        };
    }, [isOpen]);

    const loadSession = useCallback(async () => {
        try {
            const res = await api.get('/ai-chat/session');
            const data = res.data?.data;
            if (Array.isArray(data) && data.length > 0) {
                setMessages(data.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (isOpen && token && messages.length === 0) loadSession();
    }, [isOpen, token, loadSession, messages.length]);

    const clearSession = async () => {
        try {
            await api.delete('/ai-chat/session');
            setMessages([]);
            toast.success('Historial limpiado');
        } catch { toast.error('Error al limpiar'); }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        try {
            const res = await api.post('/ai-chat', { question: text.trim() });
            const data = res.data?.data;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data?.answer || 'No pude procesar tu pregunta.',
                sql: data?.sql || null,
                rows: data?.rows || null,
                exportData: data?.exportData || null,
                timestamp: new Date(),
            }]);
        } catch (error: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: error?.response?.data?.error || 'Error de conexión con el asistente.',
                timestamp: new Date(),
            }]);
        } finally { setLoading(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
            toast.error('Formato no soportado. Usa CSV o Excel.');
            return;
        }
        setMessages(prev => [...prev, { role: 'user', content: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`, timestamp: new Date() }]);
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/ai-chat/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const data = res.data?.data;
            setMessages(prev => [...prev, { role: 'assistant', content: data?.answer || 'No pude analizar el archivo.', rows: data?.rows || null, timestamp: new Date() }]);
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: error?.response?.data?.error || 'Error al procesar el archivo.', timestamp: new Date() }]);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const downloadFile = async (data: any[], format: 'csv' | 'excel' | 'pdf') => {
        try {
            const res = await api.post('/ai-chat/export', { data, format, filename: 'reporte_erp' }, { responseType: 'blob' });
            const mime =
                format === 'pdf'
                    ? 'application/pdf'
                    : format === 'excel'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'text/csv';
            const blob = new Blob([res.data], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
            a.download = `reporte_erp_${new Date().toISOString().slice(0, 10)}.${ext}`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Descargando ${format.toUpperCase()}...`);
        } catch { toast.error('Error al descargar'); }
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };
    if (!token) return null;

    return (
        <>
            {/* ── FAB Trigger Button ──────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-4 lg:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 ${
                    isOpen
                        ? 'hidden sm:flex bg-slate-800 text-white rotate-0'
                        : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/25'
                }`}
                title={isOpen ? 'Cerrar asistente' : 'Asistente IA'}
                aria-label={isOpen ? 'Cerrar asistente' : 'Asistente IA'}
            >
                {isOpen ? <IconClose /> : <IconBot className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {/* ── Help Tooltip Bubble (Discreet) ─────────────────────────── */}
            {!isOpen && messages.length === 0 && (
                <div className="fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-24 right-4 lg:right-6 z-30 pointer-events-none animate-bounce hidden sm:block">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg px-3.5 py-2 border border-slate-200 dark:border-slate-700 max-w-[200px]">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">¿Necesitás ayuda?</p>
                    </div>
                </div>
            )}

            {/* ── Chat Modal / Full-screen Sheet ─────────────────────────── */}
            {isOpen && (
                <>
                    {/* Mobile backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 sm:hidden animate-fade-in cursor-pointer"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    >
                        <div className="pt-4 text-center">
                            <span className="text-[11px] font-bold text-white/80 bg-black/40 px-3 py-1 rounded-full">
                                Tocá arriba para cerrar
                            </span>
                        </div>
                    </div>

                    {/* Chat Panel: Slide-up sheet on mobile with header visible, floating card on desktop */}
                    <div
                        className="fixed inset-x-0 bottom-0 top-14 sm:top-auto sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[600px] sm:max-h-[calc(100dvh-7rem)] z-50 flex flex-col bg-white dark:bg-slate-900 overflow-hidden rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 transition-all duration-200 animate-slide-up"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Asistente de inteligencia artificial"
                    >
                        {/* Pull handle on mobile */}
                        <div
                            onClick={() => setIsOpen(false)}
                            className="sm:hidden pt-2.5 pb-1 flex justify-center cursor-pointer bg-slate-900 active:bg-slate-800"
                            title="Deslizar o tocar para cerrar"
                        >
                            <div className="w-12 h-1.5 rounded-full bg-slate-600" />
                        </div>

                        {/* Header */}
                        <div className="bg-slate-900 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 shrink-0">
                                    <IconBot className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-white tracking-tight truncate">Asistente IA</h3>
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            ERP
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        <p className="text-[11px] text-slate-300 font-medium truncate">En línea · Siempre disponible</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {messages.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearSession}
                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95"
                                        title="Limpiar historial"
                                        aria-label="Limpiar historial"
                                    >
                                        <IconTrash />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl transition-all cursor-pointer active:scale-95"
                                    title="Cerrar chat"
                                    aria-label="Cerrar chat"
                                >
                                    <IconClose className="w-4 h-4" />
                                    <span className="sm:hidden font-semibold">Cerrar</span>
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 sm:py-4 space-y-3 bg-slate-50/70 dark:bg-slate-950/60 overscroll-contain">
                            {messages.length === 0 && (
                                <div className="text-center py-4 sm:py-6 max-w-sm mx-auto">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white mb-2.5 sm:mb-3 shadow-lg shadow-emerald-500/20">
                                        <IconBot className="w-6 h-6 sm:w-8 sm:h-8" />
                                    </div>
                                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">
                                        Hola, soy tu asistente
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3.5 sm:mb-5">
                                        Preguntame sobre tus ventas, stock o subí un reporte
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-left">
                                        {QUICK_QUESTIONS.map((q) => {
                                            const Icon = q.icon;
                                            return (
                                                <button
                                                    key={q.text}
                                                    type="button"
                                                    onClick={() => sendMessage(q.text)}
                                                    className="flex items-center gap-2.5 p-2.5 sm:p-3 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
                                                >
                                                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${q.color}`}>
                                                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                    </div>
                                                    <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
                                                        {q.text}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, idx) => {
                                const hasData = (msg.rows && msg.rows.length > 0) || (msg.exportData && msg.exportData.length > 0);
                                const dataset = (msg.rows && msg.rows.length > 0) ? msg.rows : msg.exportData;

                                return (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`${
                                        hasData
                                            ? 'w-full max-w-[96%] sm:max-w-[92%]'
                                            : 'max-w-[88%] sm:max-w-[80%]'
                                    } ${
                                        msg.role === 'user'
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl rounded-br-xs shadow-sm shadow-emerald-500/20'
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-xs shadow-sm border border-slate-200/80 dark:border-slate-700/60'
                                    } px-3.5 sm:px-4 py-2.5 sm:py-3`}>
                                        <p className="text-[13px] sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                                            {formatMarkdown(msg.content)}
                                        </p>

                                        {/* Visualización interactiva (Gráfico / Tabla) y exportación profesional (Excel / PDF / CSV) */}
                                        {dataset && dataset.length > 0 && (
                                            <AiChatChart
                                                data={dataset}
                                                onDownload={(format) => downloadFile(dataset, format)}
                                            />
                                        )}

                                        <p className={`text-[10px] mt-1.5 font-medium ${msg.role === 'user' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {msg.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                );
                            })}

                            {(loading || uploading) && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 shadow-sm border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                                {uploading ? 'Analizando archivo...' : 'Pensando...'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-slate-200 dark:border-slate-800 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3 bg-white dark:bg-slate-900 shrink-0">
                            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading || uploading}
                                    className="w-11 h-11 sm:w-10 sm:h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-slate-700/60 hover:text-emerald-600 transition-colors disabled:opacity-50 cursor-pointer shrink-0 active:scale-95"
                                    title="Subir CSV o Excel"
                                    aria-label="Subir archivo CSV o Excel"
                                >
                                    <IconFile />
                                </button>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onFocus={() => {
                                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 250);
                                    }}
                                    placeholder="Escribí tu pregunta..."
                                    disabled={loading || uploading}
                                    className="flex-1 px-3.5 sm:px-4 py-2.5 bg-slate-100 dark:bg-slate-800/90 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 disabled:opacity-50 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || uploading || !input.trim()}
                                    className="w-11 h-11 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm shadow-emerald-500/25 active:scale-95"
                                    title="Enviar mensaje"
                                    aria-label="Enviar mensaje"
                                >
                                    <IconSend />
                                </button>
                            </form>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center font-medium">
                                Asistente IA · Análisis y consultas de negocio
                            </p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

function formatMarkdown(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        const italicParts = part.split(/(_[^_]+_)/g);
        return italicParts.map((ip, j) => {
            if (ip.startsWith('_') && ip.endsWith('_')) {
                return <em key={`${i}-${j}`} className="italic text-slate-500 dark:text-slate-400">{ip.slice(1, -1)}</em>;
            }
            return <span key={`${i}-${j}`}>{ip}</span>;
        });
    });
}
