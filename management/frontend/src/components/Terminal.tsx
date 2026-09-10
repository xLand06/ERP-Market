import { useEffect, useRef } from 'react';

/* ── Estilos inyectados ────────────────────────────────────────────────── */

const STYLES_ID = 'terminal-component-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLES_ID)) {
    const style = document.createElement('style');
    style.id = STYLES_ID;
    style.textContent = `
@keyframes terminalFadeIn {
    from { opacity: 0; transform: translateY(2px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes terminalBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}`;
    document.head.appendChild(style);
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */

export interface TerminalLine {
    timestamp: Date;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

interface TerminalProps {
    lines: TerminalLine[];
    maxHeight?: number;
}

/* ── Estilos ────────────────────────────────────────────────────────────── */

const TERMINAL_BG = '#1a1a2e';
const TERMINAL_FG = '#e2e8f0';
const SUCCESS_COLOR = '#059669';
const ERROR_COLOR = '#dc2626';
const WARNING_COLOR = '#d97706';
const INFO_COLOR = '#94a3b8';
const TIMESTAMP_COLOR = '#475569';

const lineTypeColor = (type: TerminalLine['type']) => {
    switch (type) {
        case 'success': return SUCCESS_COLOR;
        case 'error': return ERROR_COLOR;
        case 'warning': return WARNING_COLOR;
        default: return INFO_COLOR;
    }
};

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function Terminal({ lines, maxHeight = 400 }: TerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll al fondo cuando llegan nuevas lineas
    useEffect(() => {
        const el = containerRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [lines.length]);

    return (
        <div
            ref={containerRef}
            style={{
                background: TERMINAL_BG,
                borderRadius: 8,
                padding: '0.75rem 1rem',
                maxHeight,
                overflowY: 'auto',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                fontSize: '0.78rem',
                lineHeight: 1.6,
                border: '1px solid #2d2d44',
            }}
        >
            {lines.length === 0 && (
                <div style={{ color: TIMESTAMP_COLOR, fontStyle: 'italic' }}>
                    Esperando logs...
                </div>
            )}
            {lines.map((line, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                        color: TERMINAL_FG,
                        animation: 'terminalFadeIn 0.15s ease',
                    }}
                >
                    {/* Timestamp */}
                    <span style={{ color: TIMESTAMP_COLOR, flexShrink: 0, userSelect: 'none' }}>
                        {line.timestamp.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })}
                    </span>
                    {/* Indicador de tipo */}
                    <span
                        style={{
                            color: lineTypeColor(line.type),
                            flexShrink: 0,
                            fontWeight: 600,
                            userSelect: 'none',
                        }}
                    >
                        {line.type === 'success' ? '[OK]'
                            : line.type === 'error' ? '[ERR]'
                            : line.type === 'warning' ? '[WRN]'
                            : '    '}
                    </span>
                    {/* Mensaje */}
                    <span style={{ color: lineTypeColor(line.type), wordBreak: 'break-word' }}>
                        {line.message}
                    </span>
                </div>
            ))}
            {/* Cursor parpadeante */}
            {lines.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: TIMESTAMP_COLOR }}>
                        {new Date().toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })}
                    </span>
                    <span style={{ color: SUCCESS_COLOR, animation: 'terminalBlink 1s step-end infinite' }}>
                        _
                    </span>
                </div>
            )}
        </div>
    );
}
