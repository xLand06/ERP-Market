import { useState, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, Loader2, Cloud, CloudOff, RefreshCw, Smartphone, Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLoginForm, useLogin } from '@/features/auth/hooks';
import type { LoginPayload } from '@/features/auth/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Descargas de escritorio ────────────────────────────────────────────────
// Se sirven desde el management server del VPS (repo privado, no GitHub).
const DESKTOP_WINDOWS_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Setup-Windows.exe';
const DESKTOP_LINUX_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Linux.AppImage';

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const { form, errors, validate, updateField } = useLoginForm();
    const { login, loading, parseError } = useLogin();
    const [generalError, setGeneralError] = useState<string>('');

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-6 sm:mb-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-emerald-900/40">
                        <span className="text-lg sm:text-xl font-black text-white tracking-tight">AM</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">ALL MARKET</h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">by ALLCODE · Sistema de gestión para bodegas y supermercados</p>
                </div>

                {/* ── Login Form ───────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
                    <h2 className="text-base font-bold text-white mb-5">Iniciar sesión</h2>

                    {generalError && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm" role="alert">
                            {generalError}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="username" className="text-xs font-semibold text-slate-300 mb-1.5 block">
                                Usuario o Cédula
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
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
                                    className={`pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 ${errors.username ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.username && (
                                <p id="username-error" className="text-red-400 text-xs mt-1" role="alert">
                                    {errors.username}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="text-xs font-semibold text-slate-300 mb-1.5 block">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                                <Input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    aria-invalid={!!errors.password}
                                    placeholder="Tu contraseña"
                                    value={form.password}
                                    onChange={(e) => updateField('password', e.target.value)}
                                    className={`pl-9 pr-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 ${errors.password ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                    </div>
                </form>

                {/* ── Sync / Connection Bar ────────────────────────────────── */}
                <div className="mt-4 flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                        {cloudOnline === null ? (
                            <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                        ) : cloudOnline ? (
                            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className={`text-xs font-medium ${
                            cloudOnline === null ? 'text-slate-500'
                            : cloudOnline ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}>
                            {cloudOnline === null ? 'Verificando...'
                            : cloudOnline ? 'Conectado a la nube'
                            : 'Sin conexión a la nube'}
                        </span>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 transition-colors"
                    >
                        {syncing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>

                {/* ── Downloads ─────────────────────────────────────────────── */}
                <div className="mt-4 bg-white/[0.04] border border-white/10 rounded-xl p-4 backdrop-blur-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Descargar aplicación</p>

                    <button
                        onClick={connectDesktop}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition-colors"
                    >
                        <Monitor className="w-4 h-4" />
                        Conectar app de escritorio
                    </button>
                    <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                        Si ya instalaste la app para PC, la abre y conecta con este negocio.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <a
                            href={DESKTOP_WINDOWS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors py-2 border border-white/10 rounded-lg"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Windows (.exe)
                        </a>
                        <a
                            href={DESKTOP_LINUX_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors py-2 border border-white/10 rounded-lg"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Linux (AppImage)
                        </a>
                        <a
                            href="/apk/app.apk"
                            download
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors py-2 border border-white/10 rounded-lg"
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                            Android (APK)
                        </a>
                    </div>
                </div>

                {lastSync && (
                    <p className="text-center text-[10px] text-slate-600 mt-2">
                        Última sincronización: {new Date(lastSync).toLocaleString('es-VE')}
                    </p>
                )}

                <p className="text-center text-xs text-slate-600 mt-4">
                    ALL MARKET · ALLCODE
                </p>
            </div>
        </div>
    );
}