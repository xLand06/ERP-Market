// =============================================================================
// AI CHAT — Floating Chat Component (ALLMARKET Design System)
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

const IconClose = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconFile = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
);

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
);

const IconDownload = ({ className = 'w-3 h-3' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
);

// ─── Quick Questions ─────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
    { icon: '💰', text: '¿Cuánto vendí hoy?' },
    { icon: '🏆', text: 'Top 5 productos más vendidos' },
    { icon: '📦', text: '¿Qué productos tienen bajo stock?' },
    { icon: '👥', text: '¿Quiénes me deben?' },
    { icon: '📊', text: 'Resumen de esta semana' },
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
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
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
    }, [isOpen, token]);

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
            {/* ── FAB ────────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    isOpen
                        ? 'bg-slate-800 text-white rotate-0'
                        : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/25'
                }`}
                title="Asistente IA"
            >
                {isOpen ? <IconClose /> : <IconBot className="w-6 h-6" />}
            </button>

            {!isOpen && messages.length === 0 && (
                <div className="fixed bottom-[4.5rem] right-6 z-50 animate-bounce">
                    <div className="bg-white rounded-2xl shadow-lg px-4 py-2.5 border border-slate-200 max-w-[220px]">
                        <p className="text-xs text-slate-600 font-bold">¿Necesitás ayuda? 🤖</p>
                    </div>
                </div>
            )}

            {/* ── Chat Panel ──────────────────────────────────────────────── */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[540px] max-h-[calc(100dvh-8rem)] bg-white rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-200 flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                            <IconBot className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-white tracking-tight">Asistente IA</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <p className="text-[11px] text-slate-400 font-medium">Online · Groq + Qwen 3.8</p>
                            </div>
                        </div>
                        {messages.length > 0 && (
                            <button type="button" onClick={clearSession}
                                className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                title="Limpiar historial">
                                <IconTrash />
                            </button>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50">
                        {messages.length === 0 && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/20">
                                    <IconBot className="w-8 h-8" />
                                </div>
                                <h4 className="text-base font-black text-slate-900 mb-1">Hola, soy tu asistente</h4>
                                <p className="text-xs text-slate-500 font-medium mb-5">Preguntame lo que quieras o subí un archivo</p>
                                <div className="space-y-2 px-2">
                                    {QUICK_QUESTIONS.map((q) => (
                                        <button key={q.text} type="button" onClick={() => sendMessage(q.text)}
                                            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer group">
                                            <span className="text-lg">{q.icon}</span>
                                            <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">{q.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl rounded-br-md shadow-sm shadow-emerald-500/20'
                                        : 'bg-white text-slate-800 rounded-2xl rounded-bl-md shadow-sm border border-slate-200'
                                } px-4 py-3`}>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatMarkdown(msg.content)}</p>

                                    {/* Export buttons */}
                                    {((msg.exportData && msg.exportData.length > 0) || (msg.rows && msg.rows.length > 0 && msg.content.includes('📊'))) && (
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60">
                                            <button type="button" onClick={() => downloadFile(msg.exportData?.length ? msg.exportData : msg.rows!, 'csv')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                                                <IconDownload /> CSV
                                            </button>
                                            <button type="button" onClick={() => downloadFile(msg.exportData?.length ? msg.exportData : msg.rows!, 'excel')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer">
                                                <IconDownload /> Excel
                                            </button>
                                            <span className="text-[10px] text-slate-400 font-medium">{(msg.exportData?.length || msg.rows?.length || 0)} registros</span>
                                        </div>
                                    )}

                                    {/* Row data preview */}
                                    {msg.rows && msg.rows.length > 0 && !msg.content.includes('📊') && msg.role === 'assistant' && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-medium mb-2">{msg.rows.length} registros</p>
                                            <div className="flex gap-1.5">
                                                <button type="button" onClick={() => downloadFile(msg.rows!, 'csv')}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent transition-all cursor-pointer">
                                                    <IconDownload className="w-3 h-3" /> CSV
                                                </button>
                                                <button type="button" onClick={() => downloadFile(msg.rows!, 'excel')}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-transparent transition-all cursor-pointer">
                                                    <IconDownload className="w-3 h-3" /> Excel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <p className={`text-[10px] mt-1.5 font-medium ${msg.role === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                                        {msg.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {(loading || uploading) && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                        </div>
                                        <span className="text-xs text-slate-500 font-semibold">{uploading ? 'Analizando archivo...' : 'Pensando...'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 px-4 py-3 bg-white shrink-0">
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                        <form onSubmit={handleSubmit} className="flex items-center gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading}
                                className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                title="Subir CSV o Excel">
                                <IconFile />
                            </button>
                            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                                placeholder="Escribí tu pregunta..."
                                disabled={loading || uploading}
                                className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 disabled:opacity-50 transition-all" />
                            <button type="submit" disabled={loading || uploading || !input.trim()}
                                className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm shadow-emerald-500/25">
                                <IconSend />
                            </button>
                        </form>
                        <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">
                            Groq + Qwen 3.8 · CSV/Excel · Solo lectura
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}

function formatMarkdown(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        const italicParts = part.split(/(_[^_]+_)/g);
        return italicParts.map((ip, j) => {
            if (ip.startsWith('_') && ip.endsWith('_')) {
                return <em key={`${i}-${j}`} className="italic text-slate-500">{ip.slice(1, -1)}</em>;
            }
            return <span key={`${i}-${j}`}>{ip}</span>;
        });
    });
}
