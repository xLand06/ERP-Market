import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Eye, EyeOff, Lock, User, Loader2, Cloud, CloudOff, RefreshCw, Smartphone, Monitor, Download, QrCode, Camera, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLoginForm, useLogin } from '@/features/auth/hooks';
import { useConfigStore } from '@/hooks/useConfigStore';
import { AppStorage } from '@/services/app-storage';
import { MathCaptcha, getLoginRateLimit, recordLoginAttempt, resetLoginAttempts, getShowCaptcha } from '@/components/auth/MathCaptcha';
import type { LoginPayload } from '@/features/auth/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

// ── Detectar si es APK (Capacitor) ──────────────────────────────────────────
const isCapacitor = !!(window as any).Capacitor;

// ── Descargas de escritorio ────────────────────────────────────────────────
const DESKTOP_WINDOWS_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Setup-Windows.exe';
const DESKTOP_LINUX_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Linux.AppImage';

// ── CSS Animations (inyectadas una vez) ────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('login-animations')) {
    const style = document.createElement('style');
    style.id = 'login-animations';
    style.textContent = `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.15); } 50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.3); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-fadeInUp { animation: fadeInUp 0.6s ease-out both; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out both; }
        .animate-slideDown { animation: slideDown 0.3s ease-out both; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
    `;
    document.head.appendChild(style);
}

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const { form, errors, validate, updateField } = useLoginForm();
    const { login, loading, parseError } = useLogin();
    const [generalError, setGeneralError] = useState<string>('');
    const activeTheme = useConfigStore((s) => s.activeTheme);
    const isDark = activeTheme === 'dark';

    // ─── Rate Limiting & CAPTCHA ────────────────────────────────────────────
    const [captchaValid, setCaptchaValid] = useState(false);
    const [captchaKey, setCaptchaKey] = useState(0);
    const [rateState, setRateState] = useState(() => getLoginRateLimit());
    const showCaptcha = getShowCaptcha();

    // ─── Sync / Connection State ─────────────────────────────────────────
    const [cloudOnline, setCloudOnline] = useState<boolean | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            try {
                const { data } = await api.get('/sync/initial-status');
                if (!cancelled) {
                    setCloudOnline(data?.data?.isOnline ?? false);
                    setLastSync(data?.data?.lastSyncAt ?? null);
                }
            } catch {
                if (!cancelled) setCloudOnline(false);
            }
        }
        check();
        const interval = setInterval(check, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const handleSync = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await api.post('/sync/trigger');
            toast.success('Sincronización iniciada');
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                try {
                    const { data } = await api.get('/sync/initial-status');
                    if (data?.data?.hasCloudData) {
                        clearInterval(poll);
                        setSyncing(false);
                        setCloudOnline(true);
                        setLastSync(new Date().toISOString());
                        toast.success('Sincronización completada');
                        setTimeout(() => window.location.reload(), 1500);
                        return;
                    }
                } catch {}
                if (attempts >= 15) {
                    clearInterval(poll);
                    setSyncing(false);
                    toast.success('Sincronización en progreso — recargando...');
                    setTimeout(() => window.location.reload(), 1000);
                }
            }, 1000);
        } catch (err: any) {
            setSyncing(false);
            setCloudOnline(false);
            toast.error(err?.message || 'Error al sincronizar');
        }
    }, [syncing]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError('');

        // Rate limit check
        const rl = getLoginRateLimit();
        if (rl.blocked) {
            setGeneralError(`Demasiados intentos fallidos. Esperá ${Math.ceil(rl.remainingMs / 1000)} segundos.`);
            return;
        }

        // CAPTCHA check
        if (showCaptcha && !captchaValid) {
            setGeneralError('Resolvé la operación matemática para continuar.');
            return;
        }

        if (!validate()) return;

        try {
            await login(form as LoginPayload);
            resetLoginAttempts();
        } catch (err) {
            if (err instanceof Error) {
                const parsed = parseError(err);
                if (parsed.username || parsed.password) return;
                setGeneralError(err.message);
                recordLoginAttempt();
                setRateState(getLoginRateLimit());
                setCaptchaKey(k => k + 1);
            }
        }
    }, [form, validate, login, parseError, captchaValid, showCaptcha]);

    const connectDesktop = () => {
        const server = window.location.origin;
        window.location.href = `allmarket://connect?server=${encodeURIComponent(server)}`;
    };

    // ── QR Code para APK ────────────────────────────────────────────────────
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [showQr, setShowQr] = useState(false);

    useEffect(() => {
        if (showQr && !qrDataUrl) {
            const server = window.location.origin;
            const deepLink = `allmarket://connect?server=${encodeURIComponent(server)}`;
            QRCode.toDataURL(deepLink, { width: 200, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } }).then(setQrDataUrl);
        }
    }, [showQr, qrDataUrl]);

    // ── QR Scanner para APK ────────────────────────────────────────────────
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerReady, setScannerReady] = useState(false);
    const [connectingServer, setConnectingServer] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const connectingRef = useRef(false);

    const validateAndConnect = async (server: string) => {
        if (connectingRef.current) return;
        connectingRef.current = true;
        setConnectingServer(server);

        // En Capacitor, usar HTTP nativo en vez de fetch (bypass CORS/CSP)
        const checkHealth = async (url: string): Promise<boolean> => {
            if (isCapacitor) {
                try {
                    const { CapacitorHttp } = await import('@capacitor/core');
                    const res = await CapacitorHttp.get({ url, connectTimeout: 5000, readTimeout: 5000 });
                    return res.status >= 200 && res.status < 300;
                } catch { return false; }
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch(url, { method: 'GET', signal: controller.signal });
                clearTimeout(timer);
                return res.ok;
            } catch { clearTimeout(timer); return false; }
        };

        const MAX = 8;
        for (let i = 1; i <= MAX; i++) {
            if (await checkHealth(`${server}/api/health`)) {
                toast.success('Negocio conectado');
                await AppStorage.setItem('serverUrl', server);
                setTimeout(() => window.location.reload(), 300);
                return;
            }
            if (i < MAX) setConnectingServer(`${server} (intento ${i + 1}/${MAX})`);
            await new Promise(r => setTimeout(r, 2000));
        }
        connectingRef.current = false;
        setConnectingServer(null);
        toast.error('No se pudo conectar. Verificá tu conexión y volvé a escanear.');
    };

    useEffect(() => {
        if (!scannerOpen) {
            if (scannerRef.current) {
                (async () => { try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; })();
            }
            setScannerReady(false);
            setConnectingServer(null);
            connectingRef.current = false;
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (cancelled) return;
                const scanner = new Html5Qrcode('login-qr-scanner', { verbose: false });
                scannerRef.current = scanner;
                const cameras = await Html5Qrcode.getCameras();
                if (cancelled || !cameras || cameras.length === 0) { toast.error('No se detectaron cámaras'); setScannerOpen(false); return; }
                const back = cameras.find((d: any) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('environment'));
                await scanner.start(back ? back.id : cameras[0].id, { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 }, (decoded) => {
                    if (connectingRef.current) return;
                    const text = decoded.trim();
                    let server: string | null = null;
                    if (text.startsWith('allmarket://')) { try { server = new URL(text).searchParams.get('server'); } catch {} }
                    if (!server && (text.startsWith('https://') || text.startsWith('http://'))) server = text;
                    if (server) {
                        if (navigator.vibrate) try { navigator.vibrate(100); } catch {}
                        try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination); osc.frequency.value = 1000; g.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1); } catch {}
                        validateAndConnect(server);
                    }
                }, () => {});
                if (!cancelled) setScannerReady(true);
            } catch (err: any) { if (!cancelled) { toast.error(err?.message || 'Error al iniciar cámara'); setScannerOpen(false); } }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [scannerOpen]);

    return (
        <>
        <div className={`min-h-screen flex items-center justify-center p-3 sm:p-6 relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950' : 'bg-gradient-to-br from-slate-50 via-white to-emerald-50'}`}>
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl animate-float ${isDark ? 'bg-emerald-500/5' : 'bg-emerald-200/30'}`} />
                <div className={`absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-float delay-3 ${isDark ? 'bg-indigo-500/5' : 'bg-indigo-200/20'}`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl ${isDark ? 'bg-emerald-500/3' : 'bg-emerald-100/40'}`} />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo + Brand */}
                <div className="text-center mb-8 animate-fadeInUp">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/30 animate-pulse-glow">
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">AM</span>
                    </div>
                    <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ALL MARKET
                    </h1>
                    <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        by ALLCODE · Gestión inteligente para tu negocio
                    </p>
                </div>

                {/* Login Card */}
                <form onSubmit={handleSubmit} className={`animate-fadeInUp delay-1 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl ${isDark ? 'bg-white/[0.06] border border-white/10' : 'bg-white/80 border border-slate-200/80 shadow-slate-200/50'}`}>
                    <h2 className={`text-lg font-black mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Iniciar sesión
                    </h2>

                    {/* Rate Limit Warning */}
                    {rateState.blocked && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-slideDown">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Cuenta bloqueada temporalmente. Esperá <strong>{Math.ceil(rateState.remainingMs / 1000)}s</strong>.</span>
                        </div>
                    )}

                    {generalError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-slideDown">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {generalError}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Username */}
                        <div className="animate-fadeInUp delay-2">
                            <label htmlFor="username" className={`text-xs font-bold mb-2 block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Usuario
                            </label>
                            <div className="relative">
                                <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <Input
                                    id="username"
                                    type="text"
                                    autoFocus
                                    autoComplete="username"
                                    aria-describedby={errors.username ? 'username-error' : undefined}
                                    aria-invalid={!!errors.username}
                                    placeholder="admin o V-12345678"
                                    value={form.username}
                                    onChange={(e) => updateField('username', e.target.value)}
                                    disabled={rateState.blocked}
                                    className={`pl-10 h-12 rounded-xl text-sm ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-emerald-600/20'} ${errors.username ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.username && <p id="username-error" className="text-red-500 text-xs mt-1.5">{errors.username}</p>}
                        </div>

                        {/* Password */}
                        <div className="animate-fadeInUp delay-3">
                            <label htmlFor="password" className={`text-xs font-bold mb-2 block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <Input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    aria-invalid={!!errors.password}
                                    placeholder="Tu contraseña"
                                    value={form.password}
                                    onChange={(e) => updateField('password', e.target.value)}
                                    disabled={rateState.blocked}
                                    className={`pl-10 pr-10 h-12 rounded-xl text-sm ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-emerald-600/20'} ${errors.password ? 'border-red-500' : ''}`}
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)} className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} transition-colors`}>
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p id="password-error" className="text-red-500 text-xs mt-1.5">{errors.password}</p>}
                        </div>

                        {/* CAPTCHA */}
                        {showCaptcha && (
                            <div className="animate-slideDown">
                                <MathCaptcha onVerify={setCaptchaValid} resetKey={captchaKey} />
                            </div>
                        )}

                        {/* Submit */}
                        <div className="animate-fadeInUp delay-4">
                            <Button
                                type="submit"
                                disabled={loading || rateState.blocked || (showCaptcha && !captchaValid)}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Ingresando...</>
                                ) : (
                                    <><Shield className="w-4 h-4 mr-2" /> Ingresar al sistema</>
                                )}
                            </Button>
                        </div>

                        {/* Rate limit attempts indicator */}
                        {rateState.attempts > 0 && !rateState.blocked && (
                            <p className="text-center text-[10px] text-amber-500">
                                {rateState.attempts}/5 intentos fallidos — {rateState.attempts >= 3 ? 'CAPTCHA activado' : `CAPTCHA después de 3 intentos`}
                            </p>
                        )}

                        {/* QR Scanner — APK only */}
                        {isCapacitor && (
                            <button type="button" onClick={() => setScannerOpen(true)} className={`w-full h-11 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                <Camera className="w-4 h-4" /> Escanear QR para conectar
                            </button>
                        )}
                    </div>
                </form>

                {/* Sync Bar */}
                <div className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-3 backdrop-blur-xl animate-fadeInUp delay-2 ${isDark ? 'bg-white/[0.04] border border-white/10' : 'bg-white/60 border border-slate-200/80'}`}>
                    <div className="flex items-center gap-2">
                        {cloudOnline === null ? <Loader2 className={`w-3.5 h-3.5 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /> : cloudOnline ? <Cloud className="w-3.5 h-3.5 text-emerald-500" /> : <CloudOff className="w-3.5 h-3.5 text-amber-500" />}
                        <span className={`text-xs font-medium ${cloudOnline === null ? (isDark ? 'text-slate-500' : 'text-slate-400') : cloudOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {cloudOnline === null ? 'Verificando...' : cloudOnline ? 'Conectado a la nube' : 'Sin conexión a la nube'}
                        </span>
                    </div>
                    <button onClick={handleSync} disabled={syncing} className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${isDark ? 'text-emerald-400 hover:text-emerald-300 disabled:text-slate-600' : 'text-emerald-600 hover:text-emerald-700 disabled:text-slate-400'}`}>
                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>

                {/* Connect + Downloads */}
                <div className={`mt-4 rounded-2xl p-4 backdrop-blur-xl animate-fadeInUp delay-3 ${isDark ? 'bg-white/[0.04] border border-white/10' : 'bg-white/60 border border-slate-200/80'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Conectar aplicación</p>

                    <button onClick={connectDesktop} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 shadow-md shadow-emerald-600/20">
                        <Monitor className="w-4 h-4" /> Conectar app de escritorio
                    </button>

                    <button onClick={() => setShowQr(!showQr)} className={`w-full flex items-center justify-center gap-2 mt-2.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 border ${showQr ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:border-indigo-400 hover:text-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'}`}>
                        <QrCode className="w-4 h-4" /> {showQr ? 'Ocultar QR' : 'Escanear QR para conectar APK'}
                    </button>

                    {showQr && qrDataUrl && (
                        <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 animate-slideDown">
                            <p className="text-xs font-bold text-slate-700">Escaneá con la APK para conectarte</p>
                            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
                            <p className="text-[10px] text-slate-400 text-center">Abrí ALL MARKET en tu celular → "Escanear QR" → apuntá a este código</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        {[{ href: DESKTOP_WINDOWS_URL, label: 'Windows (.exe)', icon: Download }, { href: DESKTOP_LINUX_URL, label: 'Linux (AppImage)', icon: Download }, { href: '/apk/app.apk', label: 'Android (APK)', icon: Smartphone }].map(item => (
                            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" download={item.href.endsWith('.apk')} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-all py-2.5 rounded-xl ${isDark ? 'text-slate-400 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/40' : 'text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300'}`}>
                                <item.icon className="w-3.5 h-3.5" /> {item.label}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 space-y-1 animate-fadeInUp delay-4">
                    {lastSync && <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Última sincronización: {new Date(lastSync).toLocaleString('es-VE')}</p>}
                    <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>ALL MARKET · ALLCODE</p>
                </div>
            </div>
        </div>

        {/* QR Scanner Modal */}
        {scannerOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
                <div className="w-full max-w-sm bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            {connectingServer ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <Camera className="w-4 h-4 text-emerald-400" />}
                            <span className="text-sm font-bold text-white">{connectingServer ? 'Conectando...' : 'Escanear QR'}</span>
                        </div>
                        {!connectingServer && <button onClick={() => setScannerOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">✕</button>}
                    </div>
                    <div className="relative min-h-[280px] flex items-center justify-center bg-black">
                        <div id="login-qr-scanner" className="w-full min-h-[280px]" />
                        {connectingServer && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10">
                                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white mb-1">Conectando al negocio...</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{connectingServer}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">Reintentando automáticamente</p>
                                </div>
                            </div>
                        )}
                        {scannerReady && !connectingServer && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[220px] h-[220px] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2">
                                    <div className="flex justify-between"><span className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" /><span className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" /></div>
                                    <div className="w-full h-0.5 bg-emerald-400/60 shadow-[0_0_8px_#34d399]" />
                                    <div className="flex justify-between"><span className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" /><span className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" /></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-800 text-center">
                        {connectingServer ? <p className="text-[10px] text-amber-400 font-medium">Esperando respuesta del servidor...</p> : <p className="text-[10px] text-slate-500">Apuntá al QR que muestra el panel web de tu negocio</p>}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
