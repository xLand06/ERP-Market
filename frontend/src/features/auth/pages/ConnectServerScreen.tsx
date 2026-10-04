import React, { useState, useRef, useCallback } from 'react';
import { QrCode, Globe, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppStorage } from '@/services/app-storage';
import { normalizeServerUrl, setServerUrlCache, TEST_SERVER_URL } from '@/lib/server-url';
import toast from 'react-hot-toast';

interface ConnectServerScreenProps {
    onConnected: (serverUrl: string) => void;
    currentServer?: string | null;
    onCancel?: () => void;
}

export function ConnectServerScreen({ onConnected, currentServer, onCancel }: ConnectServerScreenProps) {
    const [manualUrl, setManualUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'scanning' | 'validating' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showManual, setShowManual] = useState(false);
    const [validatedHost, setValidatedHost] = useState<string | null>(null);

    const isCapacitor = typeof window !== 'undefined' && (
        !!(window as any)?.Capacitor?.isNativePlatform?.() ||
        window.location.protocol === 'capacitor:'
    );

    const validateAndSaveServer = useCallback(async (rawInput: string) => {
        let input = rawInput.trim();
        if (!input) return;

        // Parse deep link allmarket://connect?server=...
        if (input.startsWith('allmarket://')) {
            try {
                const parsed = new URL(input);
                input = parsed.searchParams.get('server') || input;
            } catch { /* keep raw */ }
        }

        // If the user only typed a subdomain like "miempresa", expand it
        if (!input.includes('.') && !input.startsWith('http')) {
            input = `${input}.allcode.site`;
        }

        const normalized = normalizeServerUrl(input);
        if (!normalized) {
            setStatus('error');
            setErrorMessage('La dirección ingresada no es válida.');
            return;
        }

        setStatus('validating');
        setErrorMessage(null);

        const candidates = [
            `${normalized}/api/health`,
            `${normalized}/health`,
        ];

        let isOnline = false;
        let lastErr = '';

        for (const targetUrl of candidates) {
            try {
                if (isCapacitor) {
                    try {
                        const { CapacitorHttp } = await import('@capacitor/core');
                        const res = await CapacitorHttp.get({
                            url: targetUrl,
                            connectTimeout: 5000,
                            readTimeout: 5000,
                            headers: { 'Accept': 'application/json' },
                        });
                        if (res.status >= 200 && res.status < 300) {
                            isOnline = true;
                            break;
                        } else {
                            lastErr = `HTTP ${res.status}`;
                        }
                    } catch (nativeErr: any) {
                        lastErr = nativeErr?.message || 'Error nativo';
                    }
                } else {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    const res = await fetch(targetUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        isOnline = true;
                        break;
                    } else {
                        lastErr = `HTTP ${res.status}`;
                    }
                }
            } catch (err: any) {
                lastErr = err?.name === 'AbortError'
                    ? 'Tiempo de espera agotado'
                    : (err?.message || 'Error de red');
            }
        }

        // Persist immediately in SQLite, localStorage, and in-memory cache
        await AppStorage.setItem('serverUrl', normalized);
        setServerUrlCache(normalized);

        const cleanHost = normalized.replace(/^https?:\/\//, '');
        setValidatedHost(cleanHost);
        setStatus('success');

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([40, 60, 40]); } catch {}
        }

        toast.success(`Conectado a ${cleanHost}`);
        setTimeout(() => {
            onConnected(normalized);
        }, 500);
    }, [isCapacitor, onConnected]);

    const handleNativeScan = async () => {
        const plugins = (window as any)?.Capacitor?.Plugins;
        const nativeScanner = plugins?.QrScanner;

        if (!nativeScanner?.scan) {
            // If native scanner plugin is not present, fall back to manual entry
            setShowManual(true);
            toast.error('El escáner nativo no está disponible. Podés ingresar la dirección manualmente.');
            return;
        }

        setStatus('scanning');
        setErrorMessage(null);

        try {
            const result = await nativeScanner.scan();
            const text = result?.text;
            if (text) {
                void validateAndSaveServer(text);
            } else {
                setStatus('idle');
            }
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (/cancelled|cancel/i.test(msg)) {
                setStatus('idle');
            } else {
                setStatus('error');
                setErrorMessage('No se pudo acceder a la cámara para escanear el QR.');
            }
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualUrl.trim()) return;
        void validateAndSaveServer(manualUrl);
    };

    const handleQuickConnectTest = () => {
        void validateAndSaveServer(TEST_SERVER_URL);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#0A0E17] text-white flex flex-col justify-between overflow-y-auto px-4 py-8 safe-area-bottom safe-area-top select-none">
            {/* Header branding */}
            <div className="flex flex-col items-center text-center mt-4">
                <div className="relative mb-4">
                    <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-30 animate-pulse" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 flex items-center justify-center shadow-xl">
                        <Store className="w-8 h-8 text-emerald-400" />
                    </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ALLMARKET Universal</span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-white">
                    Vincular Negocio
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Escaneá el código QR desde tu pantalla de inicio o configuración en el panel web.
                </p>

                {currentServer && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="truncate max-w-[200px]">Actual: {currentServer.replace(/^https?:\/\//, '')}</span>
                    </div>
                )}
            </div>

            {/* Central Action Area */}
            <div className="w-full max-w-sm mx-auto my-6 space-y-4">
                {/* State: Validating / Connecting */}
                {status === 'validating' && (
                    <div className="p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/40 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                        <h3 className="text-sm font-black text-white">Verificando conexión...</h3>
                        <p className="text-xs text-slate-400">Comprobando disponibilidad del servidor</p>
                    </div>
                )}

                {/* State: Success */}
                {status === 'success' && (
                    <div className="p-6 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto animate-bounce" />
                        <h3 className="text-sm font-black text-emerald-300">¡Conexión Exitosa!</h3>
                        <p className="text-xs text-slate-300 font-mono truncate">{validatedHost}</p>
                    </div>
                )}

                {/* State: Error message */}
                {status === 'error' && errorMessage && (
                    <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-red-300">Error de conexión</p>
                            <p className="text-xs text-red-200/80 mt-0.5 leading-snug">{errorMessage}</p>
                        </div>
                    </div>
                )}

                {/* Primary Button: QR Scanner */}
                {status !== 'validating' && status !== 'success' && (
                    <>
                        <button
                            type="button"
                            onClick={handleNativeScan}
                            className="w-full min-h-[58px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-extrabold text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <QrCode className="w-6 h-6 shrink-0" />
                            <span>Escanear Código QR</span>
                        </button>

                        <div className="relative flex items-center justify-center py-2">
                            <div className="border-t border-slate-800 w-full absolute" />
                            <span className="bg-[#0A0E17] px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest relative">
                                o ingresar manual
                            </span>
                        </div>

                        {!showManual ? (
                            <button
                                type="button"
                                onClick={() => setShowManual(true)}
                                className="w-full h-12 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Globe className="w-4 h-4 text-slate-400" />
                                <span>Ingresar dominio o URL</span>
                            </button>
                        ) : (
                            <form onSubmit={handleManualSubmit} className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={manualUrl}
                                        onChange={(e) => setManualUrl(e.target.value)}
                                        placeholder="ej: cliente.allcode.site"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        className="w-full h-12 px-3.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualUrl.trim()}
                                        className="absolute right-1.5 top-1.5 bottom-1.5 w-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white flex items-center justify-center transition-all"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 text-center">
                                    Podés escribir el subdominio o la URL completa con https://
                                </p>
                            </form>
                        )}
                    </>
                )}
            </div>

            {/* Footer options */}
            <div className="w-full max-w-sm mx-auto text-center space-y-3 pb-2">
                <button
                    type="button"
                    onClick={handleQuickConnectTest}
                    className="text-xs text-slate-500 hover:text-emerald-400 transition-colors font-medium underline underline-offset-4 cursor-pointer"
                >
                    ¿Querés probar la demo? Conectar a servidor de pruebas
                </button>

                {onCancel && (
                    <div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                            Volver atrás
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Conexión segura cifrada TLS/HTTPS</span>
                </div>
            </div>
        </div>
    );
}
