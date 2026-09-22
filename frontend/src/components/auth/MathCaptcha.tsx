// =============================================================================
// MATH CAPTCHA — Componente CAPTCHA matemático sin dependencias externas.
// Genera una operación aritmética simple que el usuario debe resolver.
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';

interface MathCaptchaProps {
    onVerify: (correct: boolean) => void;
    resetKey?: number; // Cambiar para forzar regeneración
}

function generateOperation(): { a: number; b: number; op: string; answer: number; display: string } {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a: number, b: number;

    switch (op) {
        case '+':
            a = Math.floor(Math.random() * 20) + 1;
            b = Math.floor(Math.random() * 20) + 1;
            return { a, b, op, answer: a + b, display: `${a} + ${b}` };
        case '-':
            a = Math.floor(Math.random() * 20) + 10;
            b = Math.floor(Math.random() * a) + 1;
            return { a, b, op, answer: a - b, display: `${a} − ${b}` };
        case '×':
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            return { a, b, op, answer: a * b, display: `${a} × ${b}` };
        default:
            return { a: 1, b: 1, op: '+', answer: 2, display: '1 + 1' };
    }
}

export function MathCaptcha({ onVerify, resetKey }: MathCaptchaProps) {
    const [userAnswer, setUserAnswer] = useState('');
    const [shake, setShake] = useState(false);
    const operation = useMemo(() => generateOperation(), [resetKey]);

    useEffect(() => {
        setUserAnswer('');
    }, [resetKey]);

    useEffect(() => {
        if (userAnswer !== '') {
            const isCorrect = parseInt(userAnswer) === operation.answer;
            onVerify(isCorrect);
            if (!isCorrect && userAnswer.length >= String(operation.answer).length) {
                setShake(true);
                setTimeout(() => setShake(false), 500);
            }
        }
    }, [userAnswer]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verificación de seguridad</span>
            </div>
            <div className={`flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
                <div className="flex-1">
                    <p className="text-lg font-black text-slate-800 font-mono tracking-wider select-none">
                        {operation.display} = <span className="text-slate-300">?</span>
                    </p>
                </div>
                <input
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="?"
                    className="w-16 h-10 text-center text-lg font-bold border border-slate-300 rounded-lg bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    autoComplete="off"
                />
            </div>
        </div>
    );
}

// ── Rate Limiter ────────────────────────────────────────────────────────────
// Usa sessionStorage para persistir entre recargas de la misma pestaña.

const MAX_ATTEMPTS = 5;
const COOLDOWN_BASE_MS = 5_000; // 5s base
const COOLDOWN_MAX_MS = 60_000;  // 60s max
const LOCKOUT_MS = 300_000;      // 5 min lockout

export function getLoginRateLimit(): { blocked: boolean; attempts: number; cooldownMs: number; remainingMs: number } {
    const data = JSON.parse(sessionStorage.getItem('login_rate') || '{"attempts":0,"lastAttempt":0}');

    if (data.attempts >= MAX_ATTEMPTS) {
        const elapsed = Date.now() - data.lastAttempt;
        if (elapsed < LOCKOUT_MS) {
            return { blocked: true, attempts: data.attempts, cooldownMs: LOCKOUT_MS, remainingMs: LOCKOUT_MS - elapsed };
        }
        // Lockout expiró — reset
        sessionStorage.removeItem('login_rate');
        return { blocked: false, attempts: 0, cooldownMs: 0, remainingMs: 0 };
    }

    return { blocked: false, attempts: data.attempts, cooldownMs: 0, remainingMs: 0 };
}

export function recordLoginAttempt(): void {
    const data = JSON.parse(sessionStorage.getItem('login_rate') || '{"attempts":0,"lastAttempt":0}');
    data.attempts += 1;
    data.lastAttempt = Date.now();
    sessionStorage.setItem('login_rate', JSON.stringify(data));
}

export function resetLoginAttempts(): void {
    sessionStorage.removeItem('login_rate');
}

export function getShowCaptcha(): boolean {
    const data = JSON.parse(sessionStorage.getItem('login_rate') || '{"attempts":0}');
    return data.attempts >= 3;
}
