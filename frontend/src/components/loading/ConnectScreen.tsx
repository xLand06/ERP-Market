import { useState } from 'react';
import { Monitor, Link2, Loader2 } from 'lucide-react';

// =============================================================================
// CONNECT SCREEN — Pantalla de conexión del thin client (Electron).
// Se muestra cuando la app de escritorio no tiene serverUrl configurado.
// El cliente pega la URL del servidor (o el link allmarket://) y conecta.
// =============================================================================

export default function ConnectScreen() {
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);

    const parseInput = (value: string): string | null => {
        const v = value.trim();
        if (!v) return null;
        // Acepta el link completo o solo la URL
        if (v.startsWith('allmarket://')) {
            try {
                return new URL(v).searchParams.get('server');
            } catch {
                return null;
            }
        }
        return v;
    };

    const handleConnect = async () => {
        setError(null);
        const server = parseInput(input);
        if (!server) {
            setError('Ingresá la URL de tu negocio (ej: https://test.89.167.46.144.sslip.io)');
            return;
        }
        setConnecting(true);
        const res = await (window as any).erpApi.connectServer(server);
        if (!res?.ok) {
            setError(res?.error || 'No se pudo conectar');
            setConnecting(false);
        }
        // Si ok, el main recrea la ventana y la app conecta — no hace falta nada acá
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">ALL MARKET</h1>
                    <p className="text-slate-400 text-sm mt-1">by ALLCODE · App de escritorio</p>
                </div>

                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                    <h2 className="text-base font-bold text-white mb-1">Conectar con mi negocio</h2>
                    <p className="text-xs text-slate-400 mb-4">
                        Pegá el link o la URL que te envió tu proveedor. La app se conecta a tu sistema en la nube.
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                                placeholder="https://mi-negocio.89.167.46.144.sslip.io"
                                autoFocus
                                autoComplete="off"
                                className="w-full pl-9 pr-4 h-11 rounded-lg border border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
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

                        <p className="text-[10px] text-slate-500 text-center mt-1">
                            También podés conectar con un clic desde el link de tu proveedor
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-600 mt-4">
                    ALL MARKET · ALLCODE
                </p>
            </div>
        </div>
    );
}