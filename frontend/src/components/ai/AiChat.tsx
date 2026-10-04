// =============================================================================
// AI CHAT — Floating Chat Component (ALLMARKET Design System)
// Mobile-responsive: full-screen sheet on mobile, floating widget on desktop
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/store/authStore';
import toast from 'react-hot-toast';

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
    { icon: '💰', text: '¿Cuánto vendí hoy?' },
    { icon: '🏆', text: 'Top 5 más vendidos' },
    { icon: '📦', text: 'Productos con bajo stock' },
    { icon: '👥', text: 'Clientes que me deben' },
    { icon: '📊', text: 'Resumen semanal' },
    { icon: '📈', text: 'Cómo vender más' },
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
                content: `❌ ${error?.response?.data?.error || 'Error de conexión'}`,
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
        setMessages(prev => [...prev, { role: 'user', content: `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, timestamp: new Date() }]);
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/ai-chat/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const data = res.data?.data;
            setMessages(prev => [...prev, { role: 'assistant', content: data?.answer || 'No pude analizar el archivo.', rows: data?.rows || null, timestamp: new Date() }]);
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${error?.response?.data?.error || 'Error al subir'}`, timestamp: new Date() }]);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const downloadFile = async (data: any[], format: 'csv' | 'excel') => {
        try {
            const res = await api.post('/ai-chat/export', { data, format, filename: 'reporte_erp' }, { responseType: 'blob' });
            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = format === 'excel' ? 'reporte_erp.xlsx' : 'reporte_erp.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">¿Necesitás ayuda? 🤖</p>
                    </div>
                </div>
            )}

            {/* ── Chat Modal / Full-screen Sheet ─────────────────────────── */}
            {isOpen && (
                <>
                    {/* Mobile backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 sm:hidden animate-fade-in"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Chat Panel: Fullscreen on mobile, floating card on desktop */}
                    <div
                        className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 overflow-hidden sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:h-[600px] sm:max-h-[calc(100dvh-7rem)] sm:rounded-3xl sm:shadow-2xl sm:shadow-slate-950/30 sm:border sm:border-slate-200 sm:dark:border-slate-800 transition-all duration-200"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Asistente de inteligencia artificial"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 sm:py-4 flex items-center justify-between gap-3 shrink-0 border-b border-slate-800/80">
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

                            <div className="flex items-center gap-1 shrink-0">
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
                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95"
                                    title="Cerrar chat"
                                    aria-label="Cerrar chat"
                                >
                                    <IconClose className="w-5 h-5" />
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
                                        {QUICK_QUESTIONS.map((q) => (
                                            <button
                                                key={q.text}
                                                type="button"
                                                onClick={() => sendMessage(q.text)}
                                                className="flex items-center gap-2 p-2.5 sm:p-3 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 active:scale-[0.98] transition-all cursor-pointer group shadow-xs"
                                            >
                                                <span className="text-base sm:text-lg shrink-0">{q.icon}</span>
                                                <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
                                                    {q.text}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[88%] sm:max-w-[80%] ${
                                        msg.role === 'user'
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl rounded-br-xs shadow-sm shadow-emerald-500/20'
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-xs shadow-sm border border-slate-200/80 dark:border-slate-700/60'
                                    } px-3.5 sm:px-4 py-2.5 sm:py-3`}>
                                        <p className="text-[13px] sm:text-sm whitespace-pre-wrap leading-relaxed break-words">
                                            {formatMarkdown(msg.content)}
                                        </p>

                                        {/* Export buttons */}
                                        {msg.exportData && msg.exportData.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                                <button
                                                    type="button"
                                                    onClick={() => downloadFile(msg.exportData!, 'csv')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer active:scale-95"
                                                >
                                                    <IconDownload /> CSV
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => downloadFile(msg.exportData!, 'excel')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[11px] font-bold rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer active:scale-95"
                                                >
                                                    <IconDownload /> Excel
                                                </button>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                    {msg.exportData.length} registros
                                                </span>
                                            </div>
                                        )}

                                        <p className={`text-[10px] mt-1.5 font-medium ${msg.role === 'user' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {msg.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}

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
