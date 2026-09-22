import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Eye, EyeOff, Lock, User, Loader2, Cloud, CloudOff, RefreshCw, Smartphone, Monitor, Download, QrCode, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLoginForm, useLogin } from '@/features/auth/hooks';
import { useConfigStore } from '@/hooks/useConfigStore';
import { AppStorage } from '@/services/app-storage';
import type { LoginPayload } from '@/features/auth/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

// ── Detectar si es APK (Capacitor) ──────────────────────────────────────────
const isCapacitor = !!(window as any).Capacitor;

// ── Descargas de escritorio ────────────────────────────────────────────────
// Se sirven desde el management server del VPS (repo privado, no GitHub).
const DESKTOP_WINDOWS_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Setup-Windows.exe';
const DESKTOP_LINUX_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Linux.AppImage';

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const { form, errors, validate, updateField } = useLoginForm();
    const { login, loading, parseError } = useLogin();
    const [generalError, setGeneralError] = useState<string>('');
    const activeTheme = useConfigStore((s) => s.activeTheme);
    const isDark = activeTheme === 'dark';
    // ─── Sync / Connection State ─────────────────────────────────────────
    const [cloudOnline, setCloudOnline] = useState<boolean | null>(null); // null = checking
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    // Verificar conexión al montar
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
        // Re-verificar cada 30s
        const interval = setInterval(check, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const handleSync = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await api.post('/sync/trigger');
            toast.success('Sincronización iniciada');

            // Poll por unos segundos para ver resultado
            let attempts = 0;
            let lastStatus: any = null;
            const poll = setInterval(async () => {
                attempts++;
                try {
                    const { data } = await api.get('/sync/initial-status');
                    lastStatus = data;
                    if (data?.data?.hasCloudData) {
                        clearInterval(poll);
                        setSyncing(false);
                        setCloudOnline(true);
                        setLastSync(new Date().toISOString());
                        toast.success('Sincronización completada');

                        // Forzar recarga para que vea los nuevos usuarios
                        setTimeout(() => window.location.reload(), 1500);
                        return;
                    }
                } catch { /* seguir esperando */ }

                if (attempts >= 15) { // 15s timeout
                    clearInterval(poll);
                    setSyncing(false);
                    const wasOnline = lastStatus?.data?.isOnline ?? false;
                    setCloudOnline(wasOnline);
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

        if (!validate()) return;

        try {
            await login(form as LoginPayload);
        } catch (err) {
            if (err instanceof Error) {
                const parsed = parseError(err);
                if (parsed.username || parsed.password) {
                    return;
                }
                setGeneralError(err.message);
            }
        }
    }, [form, validate, login, parseError]);

    // Deep link del desktop: conecta la app instalada con este tenant
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
            QRCode.toDataURL(deepLink, {
                width: 200,
                margin: 2,
                color: { dark: '#1e293b', light: '#ffffff' },
            }).then(setQrDataUrl);
        }
    }, [showQr, qrDataUrl]);

    // ── QR Scanner para APK ────────────────────────────────────────────────
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerReady, setScannerReady] = useState(false);
    const [connectingServer, setConnectingServer] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const connectingRef = useRef(false); // Flag para evitar múltiples escaneos

    /** Valida que el servidor responda antes de guardar y recargar */
    const validateAndConnect = async (server: string) => {
        if (connectingRef.current) return; // Ya está conectando
        connectingRef.current = true;
        setConnectingServer(server);

        const MAX_ATTEMPTS = 8;
        const TIMEOUT_MS = 5000;

        for (let i = 1; i <= MAX_ATTEMPTS; i++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(`${server}/api/health`, {
                    method: 'GET',
                    signal: controller.signal,
                });
                clearTimeout(timer);

                if (res.ok) {
                    // Servidor responde — guardar y recargar
                    toast.success('Negocio conectado');
                    await AppStorage.setItem('serverUrl', server);
                    setTimeout(() => window.location.reload(), 300);
                    return;
                }
            } catch {
                // Servidor no responde aún
            }

            // Esperar antes del siguiente intento
            if (i < MAX_ATTEMPTS) {
                setConnectingServer(`${server} (intento ${i + 1}/${MAX_ATTEMPTS})`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // Todos los intentos fallaron
        connectingRef.current = false;
        setConnectingServer(null);
        toast.error('No se pudo conectar. Verificá tu conexión y volvé a escanear.');
    };

    useEffect(() => {
        if (!scannerOpen) {
            // Cleanup scanner
            if (scannerRef.current) {
                (async () => {
                    try {
                        if (scannerRef.current.isScanning) await scannerRef.current.stop();
                        scannerRef.current.clear();
                    } catch {}
                    scannerRef.current = null;
                })();
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
                if (cancelled || !cameras || cameras.length === 0) {
                    toast.error('No se detectaron cámaras');
                    setScannerOpen(false);
                    return;
                }

                const back = cameras.find((d: any) =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('trasera') ||
                    d.label.toLowerCase().includes('environment')
                );

                await scanner.start(
                    back ? back.id : cameras[0].id,
                    { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
                    (decoded) => {
                        // Bloquear si ya está conectando
                        if (connectingRef.current) return;

                        const text = decoded.trim();
                        let server: string | null = null;

                        // Parse allmarket://connect?server=...
                        if (text.startsWith('allmarket://')) {
                            try {
                                const url = new URL(text);
                                server = url.searchParams.get('server');
                            } catch {}
                        }
                        // Plain URLs
                        if (!server && (text.startsWith('https://') || text.startsWith('http://'))) {
                            server = text;
                        }

                        if (server) {
                            // Haptic + beep
                            if (navigator.vibrate) try { navigator.vibrate(100); } catch {}
                            try {
                                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                                const osc = ctx.createOscillator();
                                const g = ctx.createGain();
                                osc.connect(g); g.connect(ctx.destination);
                                osc.frequency.value = 1000;
                                g.gain.setValueAtTime(0.1, ctx.currentTime);
                                osc.start(); osc.stop(ctx.currentTime + 0.1);
                            } catch {}

                            // Pausar scanner y validar
                            validateAndConnect(server);
                        }
                    },
                    () => {}
                );

                if (!cancelled) setScannerReady(true);
            } catch (err: any) {
                if (!cancelled) {
                    toast.error(err?.message || 'Error al iniciar cámara');
                    setScannerOpen(false);
                }
            }
        }, 300);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [scannerOpen]);

    return (
        <>
        <div className={`min-h-screen flex items-center justify-center p-3 sm:p-6 ${
            isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950'
                : 'bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50'
        }`}>
            <div className="w-full max-w-md">
                <div className="text-center mb-6 sm:mb-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-emerald-900/40">
                        <span className="text-lg sm:text-xl font-black text-white tracking-tight">AM</span>
                    </div>
                    <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>ALL MARKET</h1>
                    <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>by ALLCODE · Sistema de gestión para bodegas y supermercados</p>
                </div>

                {/* ── Login Form ───────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className={`border rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl ${
                    isDark
                        ? 'bg-white/[0.06] border-white/10'
                        : 'bg-white/70 border-slate-200'
                }`}>
                    <h2 className={`text-base font-bold mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Iniciar sesión</h2>

                    {generalError && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm" role="alert">
                            {generalError}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="username" className={`text-xs font-semibold mb-1.5 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                Usuario o Cédula
                            </label>
                            <div className="relative">
                                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden="true" />
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
                                    className={`pl-9 ${
                                        isDark
                                            ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500'
                                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600'
                                    } ${errors.username ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.username && (
                                <p id="username-error" className="text-red-400 text-xs mt-1" role="alert">
                                    {errors.username}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className={`text-xs font-semibold mb-1.5 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden="true" />
                                <Input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    aria-invalid={!!errors.password}
                                    placeholder="Tu contraseña"
                                    value={form.password}
                                    onChange={(e) => updateField('password', e.target.value)}
                                    className={`pl-9 pr-10 ${
                                        isDark
                                            ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500'
                                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600'
                                    } ${errors.password ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" className="text-red-400 text-xs mt-1" role="alert">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-2"
                            size="lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Iniciando...
                                </>
                            ) : (
                                'Ingresar al sistema'
                            )}
                        </Button>

                        {/* QR Scanner button — solo en APK */}
                        {isCapacitor && (
                            <button
                                type="button"
                                onClick={() => setScannerOpen(true)}
                                className={`w-full h-12 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                    isDark
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                            >
                                <Camera className="w-4 h-4" />
                                Escanear QR para conectar
                            </button>
                        )}
                    </div>
                </form>

                {/* ── Sync / Connection Bar ────────────────────────────────── */}
                <div className={`mt-4 flex items-center justify-between rounded-xl px-4 py-2.5 backdrop-blur-xl ${
                    isDark
                        ? 'bg-white/[0.04] border border-white/10'
                        : 'bg-white/60 border border-slate-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {cloudOnline === null ? (
                            <Loader2 className={`w-3.5 h-3.5 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        ) : cloudOnline ? (
                            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                            <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span className={`text-xs font-medium ${
                            cloudOnline === null ? (isDark ? 'text-slate-500' : 'text-slate-400')
                            : cloudOnline ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}>
                            {cloudOnline === null ? 'Verificando...'
                            : cloudOnline ? 'Conectado a la nube'
                            : 'Sin conexión a la nube'}
                        </span>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                            isDark
                                ? 'text-emerald-400 hover:text-emerald-300 disabled:text-slate-600'
                                : 'text-emerald-600 hover:text-emerald-700 disabled:text-slate-400'
                        }`}
                    >
                        {syncing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>

                {/* ── Downloads + QR ──────────────────────────────────────────── */}
                <div className={`mt-4 rounded-xl p-4 backdrop-blur-xl ${
                    isDark
                        ? 'bg-white/[0.04] border border-white/10'
                        : 'bg-white/60 border border-slate-200'
                }`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Conectar aplicación</p>

                    <button
                        onClick={connectDesktop}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors active:scale-95"
                    >
                        <Monitor className="w-4 h-4" />
                        Conectar app de escritorio
                    </button>
                    <p className={`text-[10px] mt-1.5 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Si ya instalaste la app, hacé clic para conectar con este negocio.
                    </p>

                    {/* QR Toggle */}
                    <button
                        onClick={() => setShowQr(!showQr)}
                        className={`w-full flex items-center justify-center gap-2 mt-3 rounded-lg px-4 py-2.5 text-sm font-bold transition-all active:scale-95 border ${
                            showQr
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : isDark
                                    ? 'bg-white/5 border-white/10 text-slate-300 hover:border-indigo-400 hover:text-indigo-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                        }`}
                    >
                        <QrCode className="w-4 h-4" />
                        {showQr ? 'Ocultar QR' : 'Escanear QR para conectar APK'}
                    </button>

                    {showQr && qrDataUrl && (
                        <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-700">Escaneá con la APK para conectarte</p>
                            <img src={qrDataUrl} alt="QR Code para conectar APK" className="w-48 h-48 rounded-lg" />
                            <p className="text-[10px] text-slate-400 text-center">
                                Abrí ALL MARKET en tu celular → "Escanear QR" → apuntá a este código
                            </p>
                        </div>
                    )}

                    {/* Download links */}
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <a
                            href={DESKTOP_WINDOWS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors py-2 rounded-lg ${
                                isDark
                                    ? 'text-slate-400 hover:text-emerald-400 border border-white/10'
                                    : 'text-slate-500 hover:text-emerald-600 border border-slate-200'
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Windows (.exe)
                        </a>
                        <a
                            href={DESKTOP_LINUX_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors py-2 rounded-lg ${
                                isDark
                                    ? 'text-slate-400 hover:text-emerald-400 border border-white/10'
                                    : 'text-slate-500 hover:text-emerald-600 border border-slate-200'
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Linux (AppImage)
                        </a>
                        <a
                            href="/apk/app.apk"
                            download
                            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors py-2 rounded-lg ${
                                isDark
                                    ? 'text-slate-400 hover:text-emerald-400 border border-white/10'
                                    : 'text-slate-500 hover:text-emerald-600 border border-slate-200'
                            }`}
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                            Android (APK)
                        </a>
                    </div>
                </div>

                {lastSync && (
                    <p className={`text-center text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        Última sincronización: {new Date(lastSync).toLocaleString('es-VE')}
                    </p>
                )}

                <p className={`text-center text-xs mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    ALL MARKET · ALLCODE
                </p>
            </div>
        </div>

        {/* QR Scanner Modal — solo APK */}
        {scannerOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            {connectingServer ? (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                            ) : (
                                <Camera className="w-4 h-4 text-emerald-400" />
                            )}
                            <span className="text-sm font-bold text-white">
                                {connectingServer ? 'Conectando...' : 'Escanear QR'}
                            </span>
                        </div>
                        {!connectingServer && (
                            <button
                                onClick={() => setScannerOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Scanner */}
                    <div className="relative min-h-[280px] flex items-center justify-center bg-black">
                        <div id="login-qr-scanner" className="w-full min-h-[280px]" />

                        {/* Connecting overlay */}
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

                        {/* Viewfinder */}
                        {scannerReady && !connectingServer && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[220px] h-[220px] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2">
                                    <div className="flex justify-between">
                                        <span className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                                        <span className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                                    </div>
                                    <div className="w-full h-0.5 bg-emerald-400/60 shadow-[0_0_8px_#34d399]" />
                                    <div className="flex justify-between">
                                        <span className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                                        <span className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-800 text-center">
                        {connectingServer ? (
                            <p className="text-[10px] text-amber-400 font-medium">
                                Esperando respuesta del servidor...
                            </p>
                        ) : (
                            <p className="text-[10px] text-slate-500">
                                Apuntá al QR que muestra el panel web de tu negocio
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}