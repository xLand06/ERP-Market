// =============================================================================
// AI CHAT — Floating Chat Component
// Burbuja flotante que abre un panel de chat con el asistente IA del negocio.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
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
const IconBot = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconClose = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ─── Quick questions ─────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
    '¿Cuánto vendí hoy?',
    'Top 5 productos más vendidos',
    '¿Qué productos tienen bajo stock?',
    '¿Quiénes me deben?',
    'Resumen de esta semana',
];

// ─── Main Component ──────────────────────────────────────────────────────────
export function AiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuthStore();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = {
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.post('/ai-chat', { question: text.trim() });
            const data = res.data?.data;

            const assistantMsg: Message = {
                role: 'assistant',
                content: data?.answer || 'No pude procesar tu pregunta.',
                sql: data?.sql || null,
                rows: data?.rows || null,
                exportData: data?.exportData || null,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (error: any) {
            const errorMsg = error?.response?.data?.error || 'Error de conexión con el asistente.';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ ${errorMsg}`,
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // ── Download CSV/Excel ────────────────────────────────────────────────────
    const downloadFile = async (data: any[], format: 'csv' | 'excel') => {
        try {
            const res = await api.post('/ai-chat/export', {
                data,
                format,
                filename: 'reporte_erp',
            }, {
                responseType: 'blob',
            });

            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = format === 'excel' ? 'reporte_erp.xlsx' : 'reporte_erp.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Error al descargar el archivo');
        }
    };

    // Don't render if not logged in
    if (!token) return null;

    return (
        <>
            {/* ── FAB Button ──────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    isOpen
                        ? 'bg-slate-800 text-white rotate-0'
                        : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white hover:scale-110 hover:shadow-xl'
                }`}
                title="Asistente IA"
            >
                {isOpen ? <IconClose /> : <IconBot />}
            </button>

            {/* Notification dot (when closed and no messages) */}
            {!isOpen && messages.length === 0 && (
                <div className="fixed bottom-[4.5rem] right-6 z-50">
                    <div className="bg-white rounded-2xl shadow-lg px-3 py-2 border border-slate-200 max-w-[200px] animate-bounce">
                        <p className="text-xs text-slate-600 font-medium">¿Necesitás ayuda? Preguntale a la IA 🤖</p>
                    </div>
                </div>
            )}

            {/* ── Chat Panel ──────────────────────────────────────────────── */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100dvh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center gap-3 shrink-0">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <IconBot />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-white">Asistente IA</h3>
                            <p className="text-[11px] text-indigo-200">Análisis de tu negocio</p>
                        </div>
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white">GRATIS</span>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-500 mb-4">
                                    <IconBot />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 mb-1">Hola, soy tu asistente IA</h4>
                                <p className="text-xs text-slate-500 mb-4">Preguntame lo que quieras sobre tu negocio</p>

                                {/* Quick questions */}
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {QUICK_QUESTIONS.map((q) => (
                                        <button
                                            key={q}
                                            type="button"
                                            onClick={() => sendMessage(q)}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-[11px] font-medium text-slate-600 hover:text-indigo-600 rounded-full transition-colors cursor-pointer"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                    msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                                }`}>
                                    {/* Answer text */}
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {formatMarkdown(msg.content)}
                                    </p>

                                    {/* Export buttons */}
                                    {(msg.exportData && msg.exportData.length > 0) || (msg.rows && msg.rows.length > 0 && msg.content.includes('📊')) ? (
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => downloadFile(msg.exportData && msg.exportData.length > 0 ? msg.exportData : msg.rows!, 'csv')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                                </svg>
                                                CSV
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => downloadFile(msg.exportData && msg.exportData.length > 0 ? msg.exportData : msg.rows!, 'excel')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                                </svg>
                                                Excel
                                            </button>
                                            <span className="text-[10px] text-slate-400">{(msg.exportData?.length || msg.rows?.length || 0)} registros</span>
                                        </div>
                                    ) : null}

                                    <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {msg.timestamp.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                        </div>
                                        <span className="text-xs text-slate-400 font-medium">Analizando...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="border-t border-slate-200 px-4 py-3 bg-white shrink-0">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Preguntale a la IA..."
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                            >
                                <IconSend />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                            Powered by Groq + Llama 3.1 · Solo consultas de lectura
                        </p>
                    </form>
                </div>
            )}
        </>
    );
}

// ─── Simple markdown → JSX ───────────────────────────────────────────────────
function formatMarkdown(text: string): React.ReactNode {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        // Italic
        const italicParts = part.split(/(_[^_]+_)/g);
        return italicParts.map((ip, j) => {
            if (ip.startsWith('_') && ip.endsWith('_')) {
                return <em key={`${i}-${j}`} className="italic text-slate-500">{ip.slice(1, -1)}</em>;
            }
            return <span key={`${i}-${j}`}>{ip}</span>;
        });
    });
}
