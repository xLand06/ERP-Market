import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, Cloud, CloudOff, RefreshCw, Smartphone, Monitor, Download, QrCode, Camera, Shield, AlertTriangle, ArrowRight, Zap, BarChart3, ShoppingCart, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLoginForm, useLogin } from '@/features/auth/hooks';
import { useAuthStore } from '@/features/auth/store/authStore';
import { AppStorage } from '@/services/app-storage';
import { MathCaptcha, getLoginRateLimit, recordLoginAttempt, resetLoginAttempts, getShowCaptcha } from '@/components/auth/MathCaptcha';
import type { LoginPayload } from '@/features/auth/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { normalizeServerUrl, setServerUrlCache, getServerUrlCache } from '@/lib/server-url';
import { isOnline } from '@/lib/api';
import { isNativeApp, nativePost } from '@/lib/native-http';
import { ConnectServerScreen } from './ConnectServerScreen';
import { useConfigStore } from '@/hooks/useConfigStore';
const isCapacitor = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() ||
    (window as any).Capacitor?.platform === 'android' ||
    (window as any).Capacitor?.platform === 'ios' ||
    window.location.protocol === 'capacitor:'
);
export const APP_BUILD = '2.1';
const DESKTOP_WINDOWS_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Setup-Windows.exe';
const DESKTOP_LINUX_URL = 'https://mgmt.allcode.site/downloads/ALL-MARKET-Linux.AppImage';

const ECOSYSTEM = [
    { name: 'ALL MARKET', desc: 'ERP para bodegas y supermercados', icon: ShoppingCart, color: 'from-emerald-500 to-emerald-700', active: true },
    { name: 'ALL REPAIR', desc: 'Gestión para talleres y reparaciones', icon: Zap, color: 'from-amber-500 to-orange-600', active: false },
    { name: 'ALL ANALYTICS', desc: 'Dashboard inteligente de negocio', icon: BarChart3, color: 'from-indigo-500 to-purple-600', active: false },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const token = useAuthStore(s => s.token);

    useEffect(() => {
        if (token) {
            navigate('/dashboard', { replace: true });
        }
    }, [token, navigate]);

    const [showPw, setShowPw] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const { form, errors, validate, updateField } = useLoginForm();
    const { login, loading, parseError } = useLogin();
    const [generalError, setGeneralError] = useState<string>('');

    const [captchaValid, setCaptchaValid] = useState(false);
    const [captchaKey, setCaptchaKey] = useState(0);
    const [rateState, setRateState] = useState(() => getLoginRateLimit());
    const showCaptcha = getShowCaptcha();

    const [cloudOnline, setCloudOnline] = useState<boolean | null>(null);
    const [activeServer, setActiveServer] = useState<string | null>(null);
    useEffect(() => {
        setActiveServer(getServerUrlCache());
    }, []);
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
                // Fallback: health del tenant (APK/QR) sin depender del interceptor
                if (cancelled) return;
                try {
                    const ok = await isOnline();
                    setCloudOnline(ok);
                } catch {
                    if (!cancelled) setCloudOnline(false);
                }
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
            // Server mode: trigger is a no-op — just re-check health and refresh UI
            try {
                await api.post('/sync/trigger');
            } catch { /* ignore — server mode may reject OWNER guard */ }
            const { data } = await api.get('/sync/initial-status').catch(() => ({ data: null } as any));
            const online = data?.data?.isOnline ?? (await isOnline());
            setCloudOnline(online);
            if (online) {
                setLastSync(new Date().toISOString());
                toast.success('Servidor actualizado');
            } else {
                toast.error('Sin conexión al servidor del negocio');
            }
            setSyncing(false);
        } catch (err: any) {
            setSyncing(false);
            toast.error(err?.message || 'Error al actualizar estado');
        }
    }, [syncing]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError('');
        const rl = getLoginRateLimit();
        if (rl.blocked) { setGeneralError(`Demasiados intentos fallidos. Esperá ${Math.ceil(rl.remainingMs / 1000)} segundos.`); return; }
        if (showCaptcha && !captchaValid) { setGeneralError('Resolvé la operación matemática para continuar.'); return; }
        if (!validate()) return;
        try {
            if (isNativeApp()) {
                const res = await nativePost('/api/auth/login', {
                    username: form.username,
                    password: form.password,
                    email: form.username,
                });
                if (!res.ok) {
                    const apiMsg = res.data?.error || res.data?.message || `HTTP ${res.status}`;
                    throw new Error(typeof apiMsg === 'string' ? apiMsg : JSON.stringify(apiMsg));
                }
                const payload = res.data?.data ?? res.data;
                const token = payload?.token || payload?.accessToken;
                const user = payload?.user || payload?.data?.user;
                if (token && user) {
                    useAuthStore.getState().setAuth(token, user);
                    resetLoginAttempts();
                    toast.success(`Bienvenido, ${user.nombre || user.username || 'Usuario'}!`);
                    navigate('/dashboard', { replace: true });
                    return;
                }
                await login(form as LoginPayload);
                resetLoginAttempts();
                return;
            }
            await login(form as LoginPayload);
            resetLoginAttempts();
        } catch (err) {
            if (err instanceof Error) {
                const parsed = parseError(err);
                if (parsed.username || parsed.password) return;
                const server = getServerUrlCache();
                const host = server ? server.replace(/^https?:\/\//, '') : 'sin servidor';
                const isNet = /network|failed to fetch|timeout|CAP_HTTP/i.test(err.message);
                setGeneralError(
                    isNet
                        ? `${err.message} — API: ${host}/api`
                        : err.message
                );
                recordLoginAttempt(); setRateState(getLoginRateLimit()); setCaptchaKey(k => k + 1);
            }
        }
    }, [form, validate, login, parseError, captchaValid, showCaptcha]);

    const connectDesktop = () => { window.location.href = `allmarket://connect?server=${encodeURIComponent(window.location.origin)}`; };

    const [qrDataUrl, setQrDataUrl] = useState('');
    const [showQr, setShowQr] = useState(false);
    useEffect(() => {
        if (showQr && typeof window !== 'undefined') {
            void QRCode.toDataURL(`allmarket://connect?server=${encodeURIComponent(window.location.origin)}`, {
                width: 360,
                margin: 3,
                errorCorrectionLevel: 'M',
                color: { dark: '#000000', light: '#FFFFFF' },
            }).then(setQrDataUrl);
        }
    }, [showQr]);

    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerStatus, setScannerStatus] = useState<'idle' | 'requesting' | 'starting' | 'ready' | 'error' | 'pick-camera'>('idle');
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<{ deviceId: string; label: string; kind: 'front' | 'back' | 'other' }[]>([]);
    const [connectingServer, setConnectingServer] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const connectingRef = useRef(false);

    const stopScanner = async () => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const box = document.getElementById('login-qr-scanner');
        if (box) box.innerHTML = '';
    };

    const classifyCameras = (list: MediaDeviceInfo[]) => list
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => {
            const label = (d.label || '').trim();
            const l = label.toLowerCase();
            let kind: 'front' | 'back' | 'other' = 'other';
            if (/front|user|selfie|delanter|cámara frontal|cámara delantera/i.test(l)) kind = 'front';
            else if (/back|rear|environment|trasera|posterior|cámara trasera/i.test(l)) kind = 'back';
            else if (!label && i === 0) kind = 'front'; // Huawei often leaves labels empty
            else if (!label) kind = 'back';
            return {
                deviceId: d.deviceId,
                label: label || (kind === 'front' ? `Cámara frontal (${i + 1})` : kind === 'back' ? `Cámara trasera (${i + 1})` : `Cámara ${i + 1}`),
                kind,
            };
        });

    const openCamera = async (deviceId?: string, facing?: 'environment' | 'user'): Promise<MediaStream> => {
        const base: MediaStreamConstraints = deviceId
            ? { video: { deviceId: { exact: deviceId } }, audio: false }
            : { video: { facingMode: facing || 'environment' }, audio: false };
        try {
            return await navigator.mediaDevices.getUserMedia(base);
        } catch {
            if (deviceId) return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing || 'environment' }, audio: false });
            if (facing === 'environment') return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            throw new Error('camera-fail');
        }
    };

    const waitForFrames = async (video: HTMLVideoElement, ms = 1800) => {
        const start = performance.now();
        while (performance.now() - start < ms) {
            if (video.readyState >= 2 && video.videoWidth > 0) return true;
            await new Promise(r => setTimeout(r, 80));
        }
        return video.readyState >= 2 && video.videoWidth > 0;
    };

    const startDecodeLoop = (video: HTMLVideoElement, jsQR: any) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        const tick = () => {
            if (connectingRef.current) return;
            if (video.readyState >= 2 && video.videoWidth > 0) {
                const w = Math.min(video.videoWidth, 480);
                const scale = w / video.videoWidth;
                canvas.width = w;
                canvas.height = Math.round(video.videoHeight * scale);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                if (code?.data) {
                    const t = code.data.trim();
                    let s: string | null = null;
                    if (t.startsWith('allmarket://')) {
                        try { s = new URL(t).searchParams.get('server'); } catch { /* ignore */ }
                    }
                    if (!s && /^https?:\/\//.test(t)) s = t;
                    if (s) {
                        if (navigator.vibrate) try { navigator.vibrate(100); } catch { /* ignore */ }
                        try {
                            const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const o = actx.createOscillator();
                            const g = actx.createGain();
                            o.connect(g); g.connect(actx.destination);
                            o.frequency.value = 1000;
                            g.gain.setValueAtTime(0.1, actx.currentTime);
                            o.start(); o.stop(actx.currentTime + 0.1);
                        } catch { /* ignore */ }
                        void validateAndConnect(s);
                        return;
                    }
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    };

    const launchCamera = async (deviceId?: string, facing?: 'environment' | 'user'): Promise<boolean> => {
        setScannerStatus('starting');
        setScannerError(null);
        await stopScanner();
        let stream: MediaStream;
        try {
            stream = await openCamera(deviceId, facing);
        } catch {
            fail('No se pudo abrir la cámara.');
            return false;
        }
        streamRef.current = stream;

        const container = document.getElementById('login-qr-scanner');
        if (!container) {
            stream.getTracks().forEach(t => t.stop());
            fail('Contenedor QR no encontrado.');
            return false;
        }
        container.innerHTML = '';
        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.autoplay = true;
        video.style.cssText = 'width:100%;height:280px;object-fit:cover;display:block;background:#000;';
        video.srcObject = stream;
        container.appendChild(video);
        await video.play().catch(() => { /* ignore */ });

        const ok = await waitForFrames(video);
        if (!ok) {
            // Huawei P40 Pro: rear often opens black — offer picker / try front
            stream.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setScannerStatus('pick-camera');
            return false;
        }

        try {
            const jsQR = (await import('jsqr')).default;
            startDecodeLoop(video, jsQR);
            setScannerStatus('ready');
            return true;
        } catch {
            stream.getTracks().forEach(t => t.stop());
            fail('Error al iniciar el decodificador QR.');
            return false;
        }
    };

    const validateAndConnect = useCallback(async (server: string) => {
        if (connectingRef.current) return;
        connectingRef.current = true;

        const normalized = normalizeServerUrl(server);
        if (!normalized) {
            connectingRef.current = false;
            toast.error('URL del servidor inválida en el QR');
            return;
        }

        // 1. Guardar inmediatamente en SQLite y localStorage para no perder la conexión
        try {
            await AppStorage.setItem('serverUrl', normalized);
            setServerUrlCache(normalized);
            setActiveServer(normalized);
        } catch (e) {
            console.error('[QR connect] error saving serverUrl:', e);
        }

        setScannerOpen(false);
        setConnectingServer(normalized);

        // 2. Comprobación rápida (3.5s) de conectividad
        const checkHealth = async (url: string): Promise<{ ok: boolean; detail?: string }> => {
            if (isCapacitor) {
                try {
                    const { CapacitorHttp } = await import('@capacitor/core');
                    const res = await CapacitorHttp.get({
                        url,
                        connectTimeout: 3500,
                        readTimeout: 3500,
                        headers: { Accept: 'application/json' },
                    });
                    return { ok: res.status >= 200 && res.status < 300, detail: `HTTP ${res.status}` };
                } catch (e: any) {
                    return { ok: false, detail: String(e?.message || e) };
                }
            }
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 3500);
            try {
                const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
                clearTimeout(t);
                return { ok: r.ok, detail: `HTTP ${r.status}` };
            } catch (e: any) {
                clearTimeout(t);
                return { ok: false, detail: String(e?.message || e) };
            }
        };

        const result = await checkHealth(`${normalized}/api/health`);
        connectingRef.current = false;
        setConnectingServer(null);

        const cleanHost = normalized.replace(/^https?:\/\//, '');
        if (result.ok) {
            setCloudOnline(true);
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate([40, 60, 40]); } catch {}
            }
            toast.success(`Conectado a ${cleanHost}`);
            try { void useConfigStore.getState().fetchSettings(); } catch {}
        } else {
            toast(`Servidor guardado (${cleanHost}), comprobación: ${result.detail || 'sin respuesta'}`, { icon: '⚠️' });
        }
    }, []);

    const handleQrPayload = useCallback((raw: string) => {
        const normalized = normalizeServerUrl(raw);
        if (!normalized) {
            toast.error('El código QR escaneado no contiene una URL o servidor válido');
            return;
        }
        if (navigator.vibrate) try { navigator.vibrate(60); } catch { /* ignore */ }
        void validateAndConnect(normalized);
    }, [validateAndConnect]);

    const startNativeScanner = useCallback(async () => {
        const plugins = (window as any)?.Capacitor?.Plugins;
        const native = plugins?.QrScanner;
        if (!native?.scan) {
            setShowConnectModal(true);
            return;
        }
        setScannerError(null);
        try {
            const result = await native.scan();
            if (result?.text) {
                handleQrPayload(String(result.text));
            }
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (!/cancelled|cancel/i.test(msg)) {
                toast.error('No se pudo abrir el escáner de la cámara');
            }
        }
    }, [handleQrPayload]);

    const openScanner = useCallback(() => {
        if (isCapacitor) {
            void startNativeScanner();
            return;
        }
        setScannerOpen(true);
    }, [startNativeScanner]);

    const fail = (msg: string) => {
        setScannerStatus('error');
        setScannerError(msg);
    };

    useEffect(() => {
        if (!scannerOpen) {
            void stopScanner();
            setScannerStatus('idle');
            setScannerError(null);
            setCameras([]);
            setConnectingServer(null);
            connectingRef.current = false;
            return;
        }

        let cancelled = false;

        const boot = async () => {
            setScannerStatus('requesting');
            setScannerError(null);

            // Permission kick (any camera) then list devices
            try {
                const tmp = await Promise.race([
                    navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
                    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
                ]);
                tmp.getTracks().forEach(t => t.stop());
            } catch (e: any) {
                if (cancelled) return;
                const msg = String(e?.message || e?.name || '');
                if (/timeout/i.test(msg)) fail('La cámara no respondió. Cerrá y volvé a abrir.');
                else if (/NotAllowed|Permission|denied/i.test(msg)) fail('Permiso de cámara denegado. Activalo en Ajustes de la app → Cámara.');
                else fail('No se pudo abrir la cámara.');
                return;
            }
            if (cancelled) return;

            let list: { deviceId: string; label: string; kind: 'front' | 'back' | 'other' }[] = [];
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                list = classifyCameras(devices);
                setCameras(list);
            } catch { /* keep empty */ }
            if (cancelled) return;

            // Prefer rear; Huawei P40 Pro often paints black → fall back to front, then picker
            const back = list.find(c => c.kind === 'back');
            const front = list.find(c => c.kind === 'front');
            const first = back || list[0];

            if (!first) {
                fail('No se encontró ninguna cámara.');
                return;
            }

            const ok = await launchCamera(first.deviceId, first.kind === 'front' ? 'user' : 'environment');
            if (cancelled) return;

            // Rear black on Huawei — try front once, then show picker
            if (!ok && front && first.kind !== 'front') {
                const okFront = await launchCamera(front.deviceId, 'user');
                if (cancelled) return;
                if (!okFront) setScannerStatus('pick-camera');
            } else if (!ok) {
                setScannerStatus('pick-camera');
            }
        };

        const raf = requestAnimationFrame(() => { void boot(); });
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            void stopScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scannerOpen]);

    return (
        <>
        {/* ── Background: landing theme — solid so theme-dark !important can't flatten a gradient into mud ── */}
        <div className="fixed inset-0 bg-[#faf9f6] dark:bg-[#0D1117] z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f1c38]/5 via-transparent to-[#3a7d89]/5 dark:from-teal-500/10 dark:via-transparent dark:to-indigo-500/10" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#4ecdc4]/10 dark:bg-teal-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3a7d89]/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        {/* ── Desktop: split layout ─────────────────────────────────────── */}
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative z-10">
            <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

                {/* Left: Branding (desktop only) */}
                <div className="hidden lg:flex flex-1 flex-col justify-center space-y-8 max-w-md">
                    <div className="animate-fadeInUp">
                        <div className="w-20 h-20 rounded-full overflow-hidden mb-6 shadow-2xl shadow-[#3a7d89]/30 dark:shadow-teal-500/20 bg-white dark:bg-[#161B22] ring-1 ring-slate-200 dark:ring-[#30363D]">
                            <img src="/logo-allmarket.webp" alt="ALLMARKET" className="w-full h-full object-cover" draggable={false} />
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-[#0f1c38] dark:text-white tracking-tight leading-tight">
                            ALL <span className="text-[#3a7d89] dark:text-teal-400">MARKET</span>
                        </h1>
                        <p className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3a7d89]/10 dark:bg-teal-500/15 text-[#3a7d89] dark:text-teal-300 font-mono text-[11px] font-bold">
                            build v{APP_BUILD}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-3 max-w-md leading-relaxed">
                            Sistema de gestión inteligente para bodegas, supermercados y negocios de retail en Latinoamérica.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Ecosistema ALLCODE</p>
                        {ECOSYSTEM.map((p) => (
                            <div key={p.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${p.active ? 'bg-white dark:bg-[#161B22] shadow-sm ring-1 ring-[#4ecdc4]/30 dark:ring-teal-500/25' : 'bg-slate-200/70 dark:bg-slate-800/70 opacity-70'}`}>
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shrink-0 shadow-lg`}>
                                    <p.icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-[#0f1c38] dark:text-slate-100">{p.name}</p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{p.desc}</p>
                                </div>
                                {p.active && <span className="text-[9px] font-bold text-[#3a7d89] dark:text-teal-300 bg-[#4ecdc4]/10 dark:bg-teal-500/15 px-2 py-0.5 rounded-full">ACTIVO</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Center: Form ────────────────────────────────────────── */}
                <div className="w-full max-w-lg lg:max-w-md">
                    {/* Mobile: minimal logo */}
                    <div className="lg:hidden text-center mb-6">
                        <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 shadow-xl shadow-[#3a7d89]/30 dark:shadow-teal-500/20 bg-white dark:bg-[#161B22] ring-1 ring-slate-200 dark:ring-[#30363D]">
                            <img src="/logo-allmarket.webp" alt="ALLMARKET" className="w-full h-full object-cover" draggable={false} />
                        </div>
                        <h1 className="text-3xl font-black text-[#0f1c38] dark:text-white tracking-tight">
                            ALL <span className="text-[#3a7d89] dark:text-teal-400">MARKET</span>
                        </h1>
                        <p className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3a7d89]/10 dark:bg-teal-500/15 text-[#3a7d89] dark:text-teal-300 font-mono text-[10px] font-bold">
                            v{APP_BUILD}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Iniciá sesión para continuar</p>
                    </div>

                    <div className="bg-white dark:bg-[#161B22] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40 border border-slate-200/60 dark:border-[#30363D]">
                        {/* Mobile: Connected server indicator + Change button */}
                        {isCapacitor && (
                            <div className="mb-5 p-2.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 leading-tight">Servidor conectado</span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono truncate max-w-[170px] sm:max-w-[220px]">
                                            {(activeServer || getServerUrlCache())?.replace(/^https?:\/\//, '') || 'Sin servidor'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowConnectModal(true)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                                >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Cambiar</span>
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {(generalError || rateState.blocked) && (
                            <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2 animate-slideDown">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span className="min-w-0 break-words">
                                    {rateState.blocked ? `Bloqueado ${Math.ceil(rateState.remainingMs / 1000)}s` : generalError}
                                </span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username */}
                            <div>
                                <label htmlFor="username" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 block">Usuario</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#3a7d89] dark:group-focus-within:text-teal-400 transition-colors" />
                                    <Input
                                        id="username" type="text" autoFocus autoComplete="username"
                                        placeholder="admin o V-12345678"
                                        value={form.username} onChange={(e) => updateField('username', e.target.value)}
                                        disabled={rateState.blocked}
                                        className={`pl-11 h-13 rounded-xl bg-slate-50 dark:bg-[#0D1117] border-slate-200 dark:border-[#30363D] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#3a7d89] dark:focus:border-teal-500 focus:ring-[#3a7d89]/20 dark:focus:ring-teal-500/20 focus:bg-white dark:focus:bg-[#0D1117] transition-all text-base ${errors.username ? 'border-red-400 dark:border-red-500' : ''}`}
                                    />
                                </div>
                                {errors.username && <p className="text-red-500 text-xs mt-2">{errors.username}</p>}
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2.5 block">Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#3a7d89] dark:group-focus-within:text-teal-400 transition-colors" />
                                    <Input
                                        id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                                        placeholder="Tu contraseña"
                                        value={form.password} onChange={(e) => updateField('password', e.target.value)}
                                        disabled={rateState.blocked}
                                        className={`pl-11 pr-12 h-13 rounded-xl bg-slate-50 dark:bg-[#0D1117] border-slate-200 dark:border-[#30363D] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#3a7d89] dark:focus:border-teal-500 focus:ring-[#3a7d89]/20 dark:focus:ring-teal-500/20 focus:bg-white dark:focus:bg-[#0D1117] transition-all text-base ${errors.password ? 'border-red-400 dark:border-red-500' : ''}`}
                                    />
                                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Mostrar contraseña" className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-[#0f1c38] dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                                        {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs mt-2">{errors.password}</p>}
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
                                className="w-full h-14 rounded-xl bg-[#3a7d89] dark:bg-teal-600 hover:bg-[#0f1c38] dark:hover:bg-teal-500 text-white font-bold text-base shadow-lg shadow-[#3a7d89]/25 dark:shadow-teal-500/25 transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 group"
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
                                <p className="text-center text-xs text-amber-600">{rateState.attempts}/5 intentos — {rateState.attempts >= 3 ? 'CAPTCHA activado' : 'CAPTCHA después de 3'}</p>
                            )}
                        </form>
                    </div>
                </div>

                {/* ── Right: Connect + Sync (desktop only) ────────────────── */}
                <div className="hidden lg:flex flex-col w-full max-w-xs space-y-3 animate-fadeInUp delay-300">
                    {/* Sync */}
                    <div className="bg-white dark:bg-[#161B22] rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm border border-slate-200/60 dark:border-[#30363D]">
                        <div className="flex items-center gap-2">
                            {cloudOnline === null ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : cloudOnline ? <Cloud className="w-3.5 h-3.5 text-[#3a7d89] dark:text-teal-400" /> : <CloudOff className="w-3.5 h-3.5 text-amber-500" />}
                            <span className={`text-xs font-semibold ${cloudOnline === null ? 'text-slate-400' : cloudOnline ? 'text-[#3a7d89] dark:text-teal-400' : 'text-amber-500'}`}>
                                {cloudOnline === null ? 'Verificando...' : cloudOnline ? 'Conectado' : 'Sin conexión'}
                            </span>
                        </div>
                        <button onClick={handleSync} disabled={syncing} className="text-xs font-semibold text-[#3a7d89] dark:text-teal-400 hover:text-[#0f1c38] dark:hover:text-teal-300 disabled:text-slate-400 flex items-center gap-1.5 transition-colors">
                            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {syncing ? 'Sync...' : 'Sincronizar'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConnectModal(true)}
                        className="w-full text-center hover:opacity-80 transition-opacity cursor-pointer"
                        title="Configurar servidor"
                    >
                        {activeServer ? (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-2 truncate hover:underline hover:text-teal-400">
                                API: {activeServer.replace(/^https?:\/\//, '')}/api
                            </p>
                        ) : (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold px-2 hover:underline">
                                Sin servidor configurado — tocá para configurar
                            </p>
                        )}
                    </button>

                    {/* Connect */}
                    <div className="bg-white dark:bg-[#161B22] rounded-2xl p-4 space-y-3 shadow-sm border border-slate-200/60 dark:border-[#30363D]">
                        <button onClick={connectDesktop} className="w-full h-11 rounded-xl bg-[#3a7d89] dark:bg-teal-600 hover:bg-[#0f1c38] dark:hover:bg-teal-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-[#3a7d89]/20 dark:shadow-teal-500/20">
                            <Monitor className="w-4 h-4" /> Conectar escritorio
                        </button>

                        <button onClick={() => setShowQr(!showQr)} className="w-full h-11 rounded-xl border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center justify-center gap-2 hover:border-[#3a7d89]/40 dark:hover:border-teal-500/40 hover:text-[#3a7d89] dark:hover:text-teal-300 transition-all active:scale-95">
                            <QrCode className="w-4 h-4" /> {showQr ? 'Ocultar QR' : 'QR para APK'}
                        </button>

                        {showQr && qrDataUrl && (
                            <div className="flex flex-col items-center gap-2.5 p-4 bg-slate-50 dark:bg-[#0D1117] rounded-2xl border border-slate-200 dark:border-[#30363D] animate-slideDown">
                                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                    <img src={qrDataUrl} alt="QR" className="w-56 h-56 object-contain rounded-lg" />
                                </div>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Escaneá con la APK</p>
                            </div>
                        )}

                        {/* Downloads desktop */}
                        <div className="pt-2 border-t border-slate-200 dark:border-[#30363D]">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center mb-2">Descargar app</p>
                            {[{ href: DESKTOP_WINDOWS_URL, label: 'Windows', icon: Download, color: 'text-blue-400' }, { href: DESKTOP_LINUX_URL, label: 'Linux', icon: Download, color: 'text-amber-400' }, { href: '/apk/allmarket.apk', label: 'Android APK', icon: Smartphone, color: 'text-emerald-500 dark:text-teal-400' }].map(d => (
                                <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" download={d.href.endsWith('.apk')}
                                    className="flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-xl border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-95">
                                    <d.icon className={`w-5 h-5 ${d.color} shrink-0`} />
                                    <span className="text-sm font-bold">{d.label}</span>
                                    <Download className="w-4 h-4 text-slate-400 ml-auto" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {lastSync && <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">Última sync: {new Date(lastSync).toLocaleString('es-VE')}</p>}
                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">ALL MARKET · ALLCODE</p>
                </div>

                {/* ── Mobile: compact connect bar ─────────────────────────── */}
                <div className="lg:hidden w-full max-w-md space-y-3">
                    {/* Sync compact */}
                    <div className="bg-white dark:bg-[#161B22] rounded-2xl px-4 py-3 shadow-sm border border-slate-200/60 dark:border-[#30363D] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {cloudOnline === null ? <Loader2 className="w-3 h-3 animate-spin text-slate-500" /> : cloudOnline ? <Cloud className="w-3 h-3 text-[#3a7d89] dark:text-teal-400" /> : <CloudOff className="w-3 h-3 text-amber-400" />}
                            <span className={`text-[11px] font-semibold ${cloudOnline === null ? 'text-slate-500 dark:text-slate-400' : cloudOnline ? 'text-[#3a7d89] dark:text-teal-400' : 'text-amber-400'}`}>
                                {cloudOnline === null ? 'Verificando...' : cloudOnline ? 'Conectado' : 'Sin conexión'}
                            </span>
                        </div>
                        <button onClick={handleSync} disabled={syncing} className="text-[11px] font-semibold text-[#3a7d89] dark:text-teal-400 flex items-center gap-1">
                            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {syncing ? 'Sync...' : 'Sincronizar'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConnectModal(true)}
                        className="w-full text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono px-2 truncate hover:underline hover:text-teal-400 transition-colors cursor-pointer"
                        title="Tocar para configurar servidor"
                    >
                        {activeServer ? `API: ${activeServer.replace(/^https?:\/\//, '')}/api` : 'Sin servidor — tocá para configurar o escanear QR'}
                    </button>

                    {/* Botones para app móvil (APK) */}
                    {isCapacitor && (
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={openScanner}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                            >
                                <QrCode className="w-4 h-4" />
                                <span>{activeServer ? 'Escanear QR para Cambiar Negocio' : 'Escanear QR de Conexión'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowConnectModal(true)}
                                className="w-full h-9 rounded-lg border border-slate-200 dark:border-[#30363D] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                <span>Ingresar servidor manualmente</span>
                            </button>
                        </div>
                    )}

                    {!isCapacitor && (
                        <>
                            {/* Connect buttons compact */}
                            <div className="flex gap-2">
                                <button onClick={connectDesktop} className="flex-1 h-11 rounded-xl bg-emerald-600 dark:bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                    <Monitor className="w-3.5 h-3.5" /> Escritorio
                                </button>
                                <button onClick={() => setShowQr(!showQr)} className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                                    <QrCode className="w-3.5 h-3.5" /> QR
                                </button>
                            </div>

                            {showQr && qrDataUrl && (
                                <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-[#0D1117] rounded-2xl border border-slate-200 dark:border-[#30363D] animate-slideDown">
                                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                                        <img src={qrDataUrl} alt="QR" className="w-52 h-52 object-contain rounded-lg" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Escaneá con la APK</p>
                                </div>
                            )}

                            {/* Downloads */}
                            <div className="bg-white dark:bg-[#161B22] rounded-2xl p-3 space-y-2 shadow-sm border border-slate-200/60 dark:border-[#30363D]">
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Descargar app</p>
                                {[{ href: DESKTOP_WINDOWS_URL, label: 'Windows', icon: Download, color: 'text-blue-400' }, { href: DESKTOP_LINUX_URL, label: 'Linux', icon: Download, color: 'text-amber-400' }, { href: '/apk/allmarket.apk', label: 'Android APK', icon: Smartphone, color: 'text-emerald-500 dark:text-teal-400' }].map(d => (
                                    <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" download={d.href.endsWith('.apk')}
                                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-95">
                                        <d.icon className={`w-5 h-5 ${d.color} shrink-0`} />
                                        <span className="text-sm font-bold">{d.label}</span>
                                        <Download className="w-4 h-4 text-slate-400 ml-auto" />
                                    </a>
                                ))}
                            </div>
                        </>
                    )}

                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">ALL MARKET · ALLCODE</p>
                </div>
            </div>
        </div>

        {/* QR Scanner Modal */}
        {scannerOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                <div className="w-full max-w-sm bg-[#0a0f1a] rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            {connectingServer || scannerStatus === 'requesting' || scannerStatus === 'starting'
                                ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                : <Camera className="w-4 h-4 text-[#3a7d89]" />}
                            <span className="text-sm font-bold text-white">
                                {connectingServer
                                    ? 'Conectando...'
                                    : scannerStatus === 'requesting'
                                        ? 'Solicitando cámara...'
                                        : scannerStatus === 'starting'
                                            ? 'Iniciando cámara...'
                                            : scannerStatus === 'pick-camera'
                                                ? 'Elegí una cámara'
                                                : scannerStatus === 'error'
                                                    ? 'Error de cámara'
                                                    : 'Escanear QR'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {scannerStatus === 'ready' && cameras.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => { void stopScanner(); setScannerStatus('pick-camera'); }}
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    Cámara
                                </button>
                            )}
                            {!connectingServer && (
                                <button onClick={() => setScannerOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
                            )}
                        </div>
                    </div>
                    <div className="relative min-h-[280px] bg-black">
                        <div id="login-qr-scanner" className="w-full h-[280px] min-h-[280px]" />
                        {scannerStatus === 'pick-camera' && (
                            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-10 px-4">
                                <Camera className="w-8 h-8 text-teal-400" />
                                <p className="text-sm text-white font-bold text-center">Elegí la cámara</p>
                                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                                    En algunos teléfonos (ej. Huawei) la trasera sale negra. Probá con la frontal.
                                </p>
                                <div className="w-full max-w-[260px] space-y-2 mt-1">
                                    {(cameras.length ? cameras : [{ deviceId: '', label: 'Cámara predeterminada', kind: 'other' as const }]).map((c) => (
                                        <button
                                            key={c.deviceId || c.label}
                                            type="button"
                                            onClick={() => { void launchCamera(c.deviceId || undefined, c.kind === 'front' ? 'user' : 'environment'); }}
                                            className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-teal-600 text-white text-sm font-bold transition-colors text-left"
                                        >
                                            {c.kind === 'front' ? '📷 ' : c.kind === 'back' ? '📹 ' : '🎥 '}
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(scannerStatus === 'requesting' || scannerStatus === 'starting') && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-10">
                                <div className="w-14 h-14 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
                                <p className="text-xs text-slate-300 font-medium">
                                    {scannerStatus === 'requesting' ? 'Pedí permiso de cámara...' : 'Abriendo cámara...'}
                                </p>
                            </div>
                        )}
                        {scannerStatus === 'error' && scannerError && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-10 px-6 text-center">
                                <AlertTriangle className="w-8 h-8 text-amber-400" />
                                <p className="text-sm text-white leading-relaxed">{scannerError}</p>
                                <button
                                    type="button"
                                    onClick={() => setScannerOpen(false)}
                                    className="mt-1 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        )}
                        {connectingServer && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10">
                                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white mb-1">Conectando...</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{connectingServer}</p>
                                </div>
                            </div>
                        )}
                        {scannerStatus === 'ready' && !connectingServer && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[220px] h-[220px] border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col justify-between p-2">
                                    <div className="flex justify-between"><span className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" /><span className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" /></div>
                                    <div className="w-full h-0.5 bg-emerald-400/50" />
                                    <div className="flex justify-between"><span className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" /><span className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" /></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-200 text-center">
                        <p className="text-[10px] text-slate-500">
                            {connectingServer
                                ? 'Esperando respuesta...'
                                : scannerStatus === 'error'
                                    ? 'Revisá permisos de cámara en Ajustes'
                                    : scannerStatus === 'pick-camera'
                                        ? 'Elegí frontal si la trasera sale negra'
                                        : 'Apuntá al QR del panel web'}
                        </p>
                    </div>
                </div>
            </div>
        )}

        {showConnectModal && (
            <ConnectServerScreen
                currentServer={getServerUrlCache()}
                onCancel={() => setShowConnectModal(false)}
                onConnected={(newUrl) => {
                    setShowConnectModal(false);
                    setActiveServer(newUrl);
                    setServerUrlCache(newUrl);
                    toast.success(`Conectado a ${newUrl.replace(/^https?:\/\//, '')}`);
                }}
            />
        )}
        </>
    );
}
