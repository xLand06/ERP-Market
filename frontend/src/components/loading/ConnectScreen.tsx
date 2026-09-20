import { useState, useEffect, useRef } from 'react';
import { Monitor, Link2, Loader2, QrCode, Camera, Hash } from 'lucide-react';

// =============================================================================
// CONNECT SCREEN — Pantalla de conexión del thin client (Electron / APK).
// 3 métodos: QR (principal) → Código de negocio (fallback fácil) → URL (fallback último)
// =============================================================================

const MGMT_API = 'https://mgmt.allcode.site';

type Mode = 'qr' | 'code' | 'url';

export default function ConnectScreen() {
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [mode, setMode] = useState<Mode>('qr');
    const [qrReady, setQrReady] = useState(false);
    const [resolving, setResolving] = useState(false);
    const scannerRef = useRef<any>(null);
    const scannerContainerRef = useRef<HTMLDivElement>(null);

    // ── QR Scanner lifecycle ─────────────────────────────────────────────────
    useEffect(() => {
        if (mode !== 'qr') {
            stopScanner();
            return;
        }

        let cancelled = false;

        const initScanner = async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (cancelled || !scannerContainerRef.current) return;

                const scanner = new Html5Qrcode('qr-connect-scanner', { verbose: false });
                scannerRef.current = scanner;

                const cameras = await Html5Qrcode.getCameras();
                if (cancelled) return;

                if (!cameras || cameras.length === 0) {
                    setError('No se detectaron cámaras disponibles.');
                    setMode('code');
                    return;
                }

                const backCamera = cameras.find(
                    (d: any) => d.label.toLowerCase().includes('back') ||
                               d.label.toLowerCase().includes('trasera') ||
                               d.label.toLowerCase().includes('environment')
                );
                const cameraId = backCamera ? backCamera.id : cameras[0].id;

                await scanner.start(
                    cameraId,
                    { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
                    (decodedText) => handleQrScan(decodedText.trim()),
                    () => {}
                );

                if (!cancelled) setQrReady(true);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || 'Error al iniciar la cámara');
                    setMode('code');
                }
            }
        };

        const timer = setTimeout(initScanner, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
            stopScanner();
        };
    }, [mode]);

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {}
            scannerRef.current = null;
        }
        setQrReady(false);
    };

    // ── Handle QR decoded ────────────────────────────────────────────────────
    const handleQrScan = (raw: string) => {
        if (navigator.vibrate) { try { navigator.vibrate(100); } catch {} }
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 1000;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch {}

        const server = parseInput(raw);
        if (server) {
            connectToServer(server);
        } else {
            setError('QR no reconocido. Probá con código o URL.');
            setMode('code');
        }
    };

    // ── Parse input ──────────────────────────────────────────────────────────
    const parseInput = (value: string): string | null => {
        const v = value.trim();
        if (!v) return null;
        if (v.startsWith('allmarket://')) {
            try { return new URL(v).searchParams.get('server'); } catch { return null; }
        }
        if (v.startsWith('http://') || v.startsWith('https://')) return v;
        return null;
    };

    // ── Resolve business code → URL ──────────────────────────────────────────
    const handleCodeConnect = async () => {
        setError(null);
        const code = input.trim().toLowerCase();
        if (!code) {
            setError('Ingresá el código de tu negocio');
            return;
        }
        setResolving(true);
        try {
            const res = await fetch(`${MGMT_API}/api/resolve-business?code=${encodeURIComponent(code)}`);
            const data = await res.json();
            if (!res.ok || !data.url) {
                setError(data.error || 'Negocio no encontrado. Verificá el código.');
                setResolving(false);
                return;
            }
            connectToServer(data.url);
        } catch {
            setError('No se pudo conectar al servidor de gestión. Probá con la URL.');
            setResolving(false);
        }
    };

    // ── Connect ──────────────────────────────────────────────────────────────
    const connectToServer = async (server: string) => {
        setError(null);
        setConnecting(true);
        try {
            if ((window as any).erpApi?.connectServer) {
                const res = await (window as any).erpApi.connectServer(server);
                if (!res?.ok) {
                    setError(res?.error || 'No se pudo conectar');
                    setConnecting(false);
                }
                return;
            }
            localStorage.setItem('serverUrl', server);
            window.location.reload();
        } catch (err: any) {
            setError(err?.message || 'Error al conectar');
            setConnecting(false);
        }
    };

    // ── URL connect ──────────────────────────────────────────────────────────
    const handleUrlConnect = () => {
        setError(null);
        const server = parseInput(input);
        if (!server) {
            setError('Ingresá una URL válida (https://...)');
            return;
        }
        connectToServer(server);
    };

    const isLoading = connecting || resolving;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">ALL MARKET</h1>
                    <p className="text-slate-400 text-sm mt-1">Conectá con tu negocio</p>
                </div>

                {/* Mode tabs */}
                <div className="flex gap-1.5 mb-4 bg-white/5 rounded-xl p-1 border border-white/10">
                    {([
                        { key: 'qr' as Mode, icon: QrCode, label: 'QR' },
                        { key: 'code' as Mode, icon: Hash, label: 'Código' },
                        { key: 'url' as Mode, icon: Link2, label: 'URL' },
                    ]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setMode(tab.key); setError(null); setInput(''); }}
                            className={`flex-1 h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                                mode === tab.key
                                    ? tab.key === 'qr' ? 'bg-emerald-600 text-white'
                                    : tab.key === 'code' ? 'bg-amber-600 text-white'
                                    : 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm" role="alert">
                        {error}
                    </div>
                )}

                {/* QR Scanner */}
                {mode === 'qr' && (
                    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl">
                        <div className="relative min-h-[280px] flex items-center justify-center bg-black rounded-xl overflow-hidden">
                            <div id="qr-connect-scanner" className="w-full min-h-[280px]" />
                            {qrReady && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div className="w-[220px] h-[220px] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2 animate-pulse">
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
                        <p className="text-[10px] text-slate-500 text-center mt-3">
                            Pedile el QR a tu administrador desde el panel web.
                        </p>
                    </div>
                )}

                {/* Business Code */}
                {mode === 'code' && (
                    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1">Código de negocio</h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Ingresá el código que te dio tu administrador (ej: <strong className="text-slate-300">mitienda</strong>).
                        </p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                onKeyDown={(e) => e.key === 'Enter' && handleCodeConnect()}
                                placeholder="mitienda"
                                autoFocus
                                autoComplete="off"
                                className="w-full px-4 h-12 rounded-xl border border-slate-700 bg-slate-900/60 text-white text-center text-lg font-mono font-bold placeholder:text-slate-600 focus:border-amber-500 outline-none transition-all tracking-wider uppercase"
                            />
                            <button
                                onClick={handleCodeConnect}
                                disabled={isLoading}
                                className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                                ) : (
                                    <><Hash className="w-4 h-4" /> Conectar</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* URL Input */}
                {mode === 'url' && (
                    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1">URL del negocio</h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Pegá la URL completa que te envió tu proveedor.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUrlConnect()}
                                    placeholder="https://mi-negocio.allcode.site"
                                    autoFocus
                                    autoComplete="off"
                                    className="w-full pl-9 pr-4 h-12 rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <button
                                onClick={handleUrlConnect}
                                disabled={isLoading}
                                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                                ) : (
                                    <><Monitor className="w-4 h-4" /> Conectar</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <p className="text-center text-xs text-slate-600 mt-4">
                    ALL MARKET · ALLCODE
                </p>
            </div>
        </div>
    );
}
