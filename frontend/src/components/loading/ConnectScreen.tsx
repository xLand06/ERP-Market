import { useState, useEffect, useRef } from 'react';
import { Monitor, Link2, Loader2, QrCode, Camera, X } from 'lucide-react';

// =============================================================================
// CONNECT SCREEN — Pantalla de conexión del thin client (Electron / APK).
// Muestra QR scanner (principal) y input de URL (fallback).
// =============================================================================

export default function ConnectScreen() {
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [mode, setMode] = useState<'qr' | 'url'>('qr');
    const [qrReady, setQrReady] = useState(false);
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
                // Dynamic import to avoid bundling html5-qrcode in non-Capacitor builds
                const { Html5Qrcode } = await import('html5-qrcode');

                if (cancelled || !scannerContainerRef.current) return;

                const scanner = new Html5Qrcode('qr-connect-scanner', { verbose: false });
                scannerRef.current = scanner;

                const cameras = await Html5Qrcode.getCameras();
                if (cancelled) return;

                if (!cameras || cameras.length === 0) {
                    setError('No se detectaron cámaras. Usá la opción URL.');
                    setMode('url');
                    return;
                }

                // Prefer back camera
                const backCamera = cameras.find(
                    (d: any) => d.label.toLowerCase().includes('back') ||
                               d.label.toLowerCase().includes('trasera') ||
                               d.label.toLowerCase().includes('environment')
                );
                const cameraId = backCamera ? backCamera.id : cameras[0].id;

                await scanner.start(
                    cameraId,
                    { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
                    (decodedText) => {
                        handleQrScan(decodedText.trim());
                    },
                    () => {} // ignore decode errors per frame
                );

                if (!cancelled) setQrReady(true);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || 'Error al iniciar la cámara');
                    setMode('url');
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
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch {}
            scannerRef.current = null;
        }
        setQrReady(false);
    };

    // ── Handle QR decoded ────────────────────────────────────────────────────
    const handleQrScan = (raw: string) => {
        // Haptic feedback
        if (navigator.vibrate) {
            try { navigator.vibrate(100); } catch {}
        }

        // Audio beep
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 1000;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch {}

        const server = parseInput(raw);
        if (server) {
            connectToServer(server);
        } else {
            setError('QR inválido. Intentá con la URL manual.');
            setMode('url');
        }
    };

    // ── Parse input (URL or deep link) ───────────────────────────────────────
    const parseInput = (value: string): string | null => {
        const v = value.trim();
        if (!v) return null;
        if (v.startsWith('allmarket://')) {
            try {
                return new URL(v).searchParams.get('server');
            } catch {
                return null;
            }
        }
        // Accept plain URLs
        if (v.startsWith('http://') || v.startsWith('https://')) {
            return v;
        }
        return null;
    };

    // ── Connect ──────────────────────────────────────────────────────────────
    const connectToServer = async (server: string) => {
        setError(null);
        setConnecting(true);
        try {
            // Electron path
            if ((window as any).erpApi?.connectServer) {
                const res = await (window as any).erpApi.connectServer(server);
                if (!res?.ok) {
                    setError(res?.error || 'No se pudo conectar');
                    setConnecting(false);
                }
                return;
            }
            // Capacitor / Web path: store URL and reload
            localStorage.setItem('serverUrl', server);
            window.location.reload();
        } catch (err: any) {
            setError(err?.message || 'Error al conectar');
            setConnecting(false);
        }
    };

    const handleUrlConnect = () => {
        setError(null);
        const server = parseInput(input);
        if (!server) {
            setError('Ingresá una URL válida (https://... o allmarket://...)');
            return;
        }
        connectToServer(server);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">ALL MARKET</h1>
                    <p className="text-slate-400 text-sm mt-1">by ALLCODE · Conectar a mi negocio</p>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setMode('qr')}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border ${
                            mode === 'qr'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white/5 text-slate-400 border-white/10 hover:border-emerald-500'
                        }`}
                    >
                        <QrCode className="w-4 h-4" />
                        Escanear QR
                    </button>
                    <button
                        onClick={() => { setMode('url'); stopScanner(); }}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border ${
                            mode === 'url'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white/5 text-slate-400 border-white/10 hover:border-indigo-500'
                        }`}
                    >
                        <Link2 className="w-4 h-4" />
                        Ingresar URL
                    </button>
                </div>

                {/* QR Scanner */}
                {mode === 'qr' && (
                    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl">
                        <div className="relative min-h-[280px] flex items-center justify-center bg-black rounded-xl overflow-hidden">
                            <div id="qr-connect-scanner" className="w-full min-h-[280px]" />

                            {/* Viewfinder overlay */}
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

                            {/* Error overlay */}
                            {error && mode === 'qr' && (
                                <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center bg-slate-900/95 space-y-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                        <Camera className="w-5 h-5 text-red-400" />
                                    </div>
                                    <p className="text-xs text-red-300 max-w-xs">{error}</p>
                                    <button
                                        onClick={() => { setError(null); setMode('url'); }}
                                        className="text-xs text-emerald-400 font-bold underline"
                                    >
                                        Usar URL manual
                                    </button>
                                </div>
                            )}
                        </div>

                        <p className="text-[10px] text-slate-500 text-center mt-3">
                            Pedile el QR a tu administrador desde el panel web.
                        </p>
                    </div>
                )}

                {/* URL Input */}
                {mode === 'url' && (
                    <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                        <h2 className="text-base font-bold text-white mb-1">Ingresar URL del negocio</h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Pegá la URL que te envió tu proveedor.
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm" role="alert">
                                {error}
                            </div>
                        )}

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
                                    className="w-full pl-9 pr-4 h-11 rounded-lg border border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={handleUrlConnect}
                                disabled={connecting}
                                className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
                            >
                                {connecting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Conectando...
                                    </>
                                ) : (
                                    <>
                                        <Monitor className="w-4 h-4" />
                                        Conectar
                                    </>
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
