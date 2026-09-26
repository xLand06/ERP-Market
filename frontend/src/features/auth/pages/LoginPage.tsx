import { useState, useCallback, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, User, Loader2, Cloud, CloudOff, RefreshCw, Smartphone, Monitor, Download, QrCode, Camera, Shield, AlertTriangle, ArrowRight, Zap, BarChart3, ShoppingCart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLoginForm, useLogin } from '@/features/auth/hooks';
import { AppStorage } from '@/services/app-storage';
import { MathCaptcha, getLoginRateLimit, recordLoginAttempt, resetLoginAttempts, getShowCaptcha } from '@/components/auth/MathCaptcha';
import { AnimatedMeshBg } from '@/components/ui/AnimatedMeshBg';
import type { LoginPayload } from '@/features/auth/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

const isCapacitor = !!(window as any).Capacitor;
const DESKTOP_WINDOWS_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Setup-Windows.exe';
const DESKTOP_LINUX_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Linux.AppImage';

const ECOSYSTEM = [
    { name: 'ALL MARKET', desc: 'ERP para bodegas y supermercados', icon: ShoppingCart, color: 'from-emerald-500 to-emerald-700', active: true },
    { name: 'ALL REPAIR', desc: 'Gestión para talleres y reparaciones', icon: Zap, color: 'from-amber-500 to-orange-600', active: false },
    { name: 'ALL ANALYTICS', desc: 'Dashboard inteligente de negocio', icon: BarChart3, color: 'from-indigo-500 to-purple-600', active: false },
];

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const { form, errors, validate, updateField } = useLoginForm();
    const { login, loading, parseError } = useLogin();
    const [generalError, setGeneralError] = useState<string>('');

    const [captchaValid, setCaptchaValid] = useState(false);
    const [captchaKey, setCaptchaKey] = useState(0);
    const [rateState, setRateState] = useState(() => getLoginRateLimit());
    const showCaptcha = getShowCaptcha();

    const [cloudOnline, setCloudOnline] = useState<boolean | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            try {
                const { data } = await api.get('/sync/initial-status');
                if (!cancelled) { setCloudOnline(data?.data?.isOnline ?? false); setLastSync(data?.data?.lastSyncAt ?? null); }
            } catch { if (!cancelled) setCloudOnline(false); }
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
                    if (data?.data?.hasCloudData) { clearInterval(poll); setSyncing(false); setCloudOnline(true); setLastSync(new Date().toISOString()); toast.success('Sincronización completada'); setTimeout(() => window.location.reload(), 1500); return; }
                } catch {}
                if (attempts >= 15) { clearInterval(poll); setSyncing(false); toast.success('Sincronización en progreso — recargando...'); setTimeout(() => window.location.reload(), 1000); }
            }, 1000);
        } catch (err: any) { setSyncing(false); setCloudOnline(false); toast.error(err?.message || 'Error al sincronizar'); }
    }, [syncing]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError('');
        const rl = getLoginRateLimit();
        if (rl.blocked) { setGeneralError(`Demasiados intentos fallidos. Esperá ${Math.ceil(rl.remainingMs / 1000)} segundos.`); return; }
        if (showCaptcha && !captchaValid) { setGeneralError('Resolvé la operación matemática para continuar.'); return; }
        if (!validate()) return;
        try { await login(form as LoginPayload); resetLoginAttempts(); } catch (err) {
            if (err instanceof Error) { const parsed = parseError(err); if (parsed.username || parsed.password) return; setGeneralError(err.message); recordLoginAttempt(); setRateState(getLoginRateLimit()); setCaptchaKey(k => k + 1); }
        }
    }, [form, validate, login, parseError, captchaValid, showCaptcha]);

    const connectDesktop = () => { window.location.href = `allmarket://connect?server=${encodeURIComponent(window.location.origin)}`; };

    const [qrDataUrl, setQrDataUrl] = useState('');
    const [showQr, setShowQr] = useState(false);
    useEffect(() => { if (showQr && !qrDataUrl) { QRCode.toDataURL(`allmarket://connect?server=${encodeURIComponent(window.location.origin)}`, { width: 200, margin: 2, color: { dark: '#ffffff', light: '#00000000' } }).then(setQrDataUrl); } }, [showQr, qrDataUrl]);

    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerReady, setScannerReady] = useState(false);
    const [connectingServer, setConnectingServer] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const connectingRef = useRef(false);

    const validateAndConnect = async (server: string) => {
        if (connectingRef.current) return;
        connectingRef.current = true;
        setConnectingServer(server);
        const checkHealth = async (url: string): Promise<boolean> => {
            if (isCapacitor) { try { const { CapacitorHttp } = await import('@capacitor/core'); const res = await CapacitorHttp.get({ url, connectTimeout: 5000, readTimeout: 5000 }); return res.status >= 200 && res.status < 300; } catch { return false; } }
            const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
            try { const r = await fetch(url, { signal: c.signal }); clearTimeout(t); return r.ok; } catch { clearTimeout(t); return false; }
        };
        for (let i = 1; i <= 8; i++) {
            if (await checkHealth(`${server}/api/health`)) { toast.success('Negocio conectado'); await AppStorage.setItem('serverUrl', server); setTimeout(() => window.location.reload(), 300); return; }
            if (i < 8) setConnectingServer(`${server} (intento ${i + 1}/8)`);
            await new Promise(r => setTimeout(r, 2000));
        }
        connectingRef.current = false; setConnectingServer(null); toast.error('No se pudo conectar. Verificá tu conexión.');
    };

    useEffect(() => {
        if (!scannerOpen) { if (scannerRef.current) { (async () => { try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; })(); } setScannerReady(false); setConnectingServer(null); connectingRef.current = false; return; }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode'); if (cancelled) return;
                const scanner = new Html5Qrcode('login-qr-scanner', { verbose: false }); scannerRef.current = scanner;
                const cameras = await Html5Qrcode.getCameras(); if (cancelled || !cameras?.length) { toast.error('Sin cámara'); setScannerOpen(false); return; }
                const back = cameras.find((d: any) => /back|trasera|environment/i.test(d.label));
                await scanner.start(back?.id || cameras[0].id, { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 }, (decoded) => {
                    if (connectingRef.current) return;
                    const t = decoded.trim(); let s: string | null = null;
                    if (t.startsWith('allmarket://')) { try { s = new URL(t).searchParams.get('server'); } catch {} }
                    if (!s && /^https?:\/\//.test(t)) s = t;
                    if (s) { if (navigator.vibrate) try { navigator.vibrate(100); } catch {} try { const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 1000; g.gain.setValueAtTime(0.1, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.1); } catch {} validateAndConnect(s); }
                }, () => {});
                if (!cancelled) setScannerReady(true);
            } catch (err: any) { if (!cancelled) { toast.error(err?.message || 'Error cámara'); setScannerOpen(false); } }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [scannerOpen]);

    return (
        <>
        <AnimatedMeshBg />

        {/* ── Desktop: split layout ─────────────────────────────────────── */}
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative z-10">
            <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-6 lg:gap-16">

                {/* Left: Branding (desktop only) */}
                <div className="hidden lg:flex flex-1 text-left space-y-8 lg:max-w-lg">
                    <div className="animate-fadeInUp">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30">
                            <span className="text-3xl font-black text-white tracking-tight">AM</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                            ALL <span className="text-emerald-400">MARKET</span>
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base mt-3 max-w-md leading-relaxed">
                            Sistema de gestión inteligente para bodegas, supermercados y negocios de retail en Latinoamérica.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Ecosistema ALLCODE</p>
                        {ECOSYSTEM.map((p) => (
                            <div key={p.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${p.active ? 'glass-strong ring-1 ring-emerald-500/30' : 'glass opacity-50'}`}>
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shrink-0 shadow-lg`}>
                                    <p.icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{p.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{p.desc}</p>
                                </div>
                                {p.active && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Center: Form ────────────────────────────────────────── */}
                <div className="w-full max-w-md">
                    {/* Mobile: minimal logo */}
                    <div className="lg:hidden text-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-emerald-500/30">
                            <span className="text-2xl font-black text-white">AM</span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            ALL <span className="text-emerald-400">MARKET</span>
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Iniciá sesión para continuar</p>
                    </div>

                    <div className="glass-strong rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/20">
                        {/* Error */}
                        {(generalError || rateState.blocked) && (
                            <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2 animate-slideDown">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {rateState.blocked ? `Bloqueado ${Math.ceil(rateState.remainingMs / 1000)}s` : generalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username */}
                            <div>
                                <label htmlFor="username" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 block">Usuario</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <Input
                                        id="username" type="text" autoFocus autoComplete="username"
                                        placeholder="admin o V-12345678"
                                        value={form.username} onChange={(e) => updateField('username', e.target.value)}
                                        disabled={rateState.blocked}
                                        className={`pl-11 h-13 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08] transition-all text-base ${errors.username ? 'border-red-500/50' : ''}`}
                                    />
                                </div>
                                {errors.username && <p className="text-red-400 text-xs mt-2">{errors.username}</p>}
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 block">Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <Input
                                        id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                                        placeholder="Tu contraseña"
                                        value={form.password} onChange={(e) => updateField('password', e.target.value)}
                                        disabled={rateState.blocked}
                                        className={`pl-11 pr-12 h-13 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08] transition-all text-base ${errors.password ? 'border-red-500/50' : ''}`}
                                    />
                                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Mostrar contraseña" className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                                        {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-400 text-xs mt-2">{errors.password}</p>}
                            </div>

                            {/* CAPTCHA */}
                            {showCaptcha && (
                                <div className="animate-slideDown">
                                    <MathCaptcha onVerify={setCaptchaValid} resetKey={captchaKey} />
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || rateState.blocked || (showCaptcha && !captchaValid)}
                                className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-base shadow-lg shadow-emerald-500/25 transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        Ingresar
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            {/* Attempts indicator */}
                            {rateState.attempts > 0 && !rateState.blocked && (
                                <p className="text-center text-xs text-amber-500/80">{rateState.attempts}/5 intentos — {rateState.attempts >= 3 ? 'CAPTCHA activado' : 'CAPTCHA después de 3'}</p>
                            )}

                            {/* QR Scanner — APK only */}
                            {isCapacitor && (
                                <button type="button" onClick={() => setScannerOpen(true)} className="w-full h-12 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all active:scale-95">
                                    <Camera className="w-4 h-4" /> Escanear QR
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                {/* ── Right: Connect + Sync (desktop only) ────────────────── */}
                <div className="hidden lg:block w-full max-w-xs space-y-3 animate-fadeInUp delay-300">
                    {/* Sync */}
                    <div className="glass rounded-2xl px-4 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {cloudOnline === null ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> : cloudOnline ? <Cloud className="w-3.5 h-3.5 text-emerald-400" /> : <CloudOff className="w-3.5 h-3.5 text-amber-400" />}
                            <span className={`text-xs font-semibold ${cloudOnline === null ? 'text-slate-500' : cloudOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {cloudOnline === null ? 'Verificando...' : cloudOnline ? 'Conectado' : 'Sin conexión'}
                            </span>
                        </div>
                        <button onClick={handleSync} disabled={syncing} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 flex items-center gap-1.5 transition-colors">
                            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {syncing ? 'Sync...' : 'Sincronizar'}
                        </button>
                    </div>

                    {/* Connect */}
                    <div className="glass rounded-2xl p-4 space-y-3">
                        <button onClick={connectDesktop} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-600/20">
                            <Monitor className="w-4 h-4" /> Conectar escritorio
                        </button>

                        <button onClick={() => setShowQr(!showQr)} className="w-full h-11 rounded-xl border border-white/10 text-slate-300 text-sm font-bold flex items-center justify-center gap-2 hover:border-emerald-500/40 hover:text-emerald-400 transition-all active:scale-95">
                            <QrCode className="w-4 h-4" /> {showQr ? 'Ocultar QR' : 'QR para APK'}
                        </button>

                        {showQr && qrDataUrl && (
                            <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl border border-white/10 animate-slideDown">
                                <img src={qrDataUrl} alt="QR" className="w-40 h-40 rounded-xl" />
                                <p className="text-[10px] text-slate-500 text-center">Escaneá con la APK</p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {[{ href: DESKTOP_WINDOWS_URL, label: 'Windows', icon: Download }, { href: DESKTOP_LINUX_URL, label: 'Linux', icon: Download }, { href: '/apk/app.apk', label: 'APK', icon: Smartphone }].map(d => (
                                <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" download={d.href.endsWith('.apk')} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30 rounded-lg py-2.5 transition-all">
                                    <d.icon className="w-3.5 h-3.5" /> {d.label}
                                </a>
                            ))}
                        </div>
                    </div>

                    {lastSync && <p className="text-center text-[10px] text-slate-600">Última sync: {new Date(lastSync).toLocaleString('es-VE')}</p>}
                    <p className="text-center text-[10px] text-slate-600">ALL MARKET · ALLCODE</p>
                </div>

                {/* ── Mobile: compact connect bar ─────────────────────────── */}
                <div className="lg:hidden w-full max-w-md space-y-3">
                    {/* Sync compact */}
                    <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {cloudOnline === null ? <Loader2 className="w-3 h-3 animate-spin text-slate-500" /> : cloudOnline ? <Cloud className="w-3 h-3 text-emerald-400" /> : <CloudOff className="w-3 h-3 text-amber-400" />}
                            <span className={`text-[11px] font-semibold ${cloudOnline === null ? 'text-slate-500' : cloudOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {cloudOnline === null ? 'Verificando...' : cloudOnline ? 'Conectado' : 'Sin conexión'}
                            </span>
                        </div>
                        <button onClick={handleSync} disabled={syncing} className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {syncing ? 'Sync...' : 'Sincronizar'}
                        </button>
                    </div>

                    {/* Connect buttons compact */}
                    <div className="flex gap-2">
                        <button onClick={connectDesktop} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                            <Monitor className="w-3.5 h-3.5" /> Escritorio
                        </button>
                        <button onClick={() => setShowQr(!showQr)} className="flex-1 h-11 rounded-xl border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                            <QrCode className="w-3.5 h-3.5" /> QR
                        </button>
                    </div>

                    {showQr && qrDataUrl && (
                        <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl border border-white/10 animate-slideDown">
                            <img src={qrDataUrl} alt="QR" className="w-36 h-36 rounded-xl" />
                            <p className="text-[10px] text-slate-500 text-center">Escaneá con la APK</p>
                        </div>
                    )}

                    {/* Downloads compact */}
                    <div className="flex gap-2">
                        {[{ href: DESKTOP_WINDOWS_URL, label: 'Win', icon: Download }, { href: DESKTOP_LINUX_URL, label: 'Linux', icon: Download }, { href: '/apk/app.apk', label: 'APK', icon: Smartphone }].map(d => (
                            <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" download={d.href.endsWith('.apk')} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-400 border border-white/5 rounded-lg py-2.5 transition-all">
                                <d.icon className="w-3 h-3" /> {d.label}
                            </a>
                        ))}
                    </div>

                    <p className="text-center text-[10px] text-slate-600">ALL MARKET · ALLCODE</p>
                </div>
            </div>
        </div>

        {/* QR Scanner Modal */}
        {scannerOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                <div className="w-full max-w-sm bg-[#0a0f1a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            {connectingServer ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <Camera className="w-4 h-4 text-emerald-400" />}
                            <span className="text-sm font-bold text-white">{connectingServer ? 'Conectando...' : 'Escanear QR'}</span>
                        </div>
                        {!connectingServer && <button onClick={() => setScannerOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>}
                    </div>
                    <div className="relative min-h-[280px] bg-black">
                        <div id="login-qr-scanner" className="w-full min-h-[280px]" />
                        {connectingServer && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10">
                                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white mb-1">Conectando...</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{connectingServer}</p>
                                </div>
                            </div>
                        )}
                        {scannerReady && !connectingServer && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[220px] h-[220px] border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col justify-between p-2">
                                    <div className="flex justify-between"><span className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" /><span className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" /></div>
                                    <div className="w-full h-0.5 bg-emerald-400/50" />
                                    <div className="flex justify-between"><span className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" /><span className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" /></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-4 py-3 border-t border-white/10 text-center">
                        <p className="text-[10px] text-slate-500">{connectingServer ? 'Esperando respuesta...' : 'Apuntá al QR del panel web'}</p>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
