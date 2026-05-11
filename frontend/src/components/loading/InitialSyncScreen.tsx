// =============================================================================
// INITIAL SYNC SCREEN — Pantalla de carga en el primer inicio de la app
// Muestra progreso de la sincronización inicial con Supabase.
// En inicios posteriores (o si no hay internet), pasa directo al login.
// =============================================================================

import { useEffect, useState, useRef } from 'react';
import { Loader2, CloudOff, CheckCircle2, Database, Cloud, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

type SyncStage = 'checking' | 'connecting' | 'syncing' | 'offline' | 'done' | 'error';

interface InitialStatus {
    needsInitialSync: boolean;
    hasCloudData: boolean;
    isOnline: boolean;
    lastSyncAt: string | null;
    isSyncing: boolean;
    stage: string;
}

interface Props {
    onComplete: () => void;
}

export default function InitialSyncScreen({ onComplete }: Props) {
    const [stage, setStage] = useState<SyncStage>('checking');
    const [statusText, setStatusText] = useState('Verificando conexión...');
    const [progress, setProgress] = useState(0);
    const [pulledItems, setPulledItems] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        let attempts = 0;
        const MAX_ATTEMPTS = 30; // 30s timeout total

        async function checkAndSync() {
            if (!mountedRef.current) return;

            try {
                // 1. Verificar estado inicial
                const { data: statusData } = await api.get<{ success: boolean; data: InitialStatus }>('/sync/initial-status');
                const status = statusData.data;

                if (!mountedRef.current) return;

                // Si ya tiene datos de cloud o no necesita sync → listo
                if (status.hasCloudData || !status.needsInitialSync) {
                    setStage('done');
                    setStatusText('Datos sincronizados');

                    // Si la app es Electron, marcar en store que ya se hizo el sync inicial
                    if ((window as any).erpApi?.store) {
                        try {
                            await (window as any).erpApi.store.set('initialSyncDone', true);
                        } catch { /* Electron store no disponible en dev */ }
                    }

                    setTimeout(() => {
                        if (mountedRef.current) onComplete();
                    }, 1500);
                    return;
                }

                // 2. Sin conexión → modo offline directo
                if (!status.isOnline) {
                    setStage('offline');
                    setStatusText('Sin conexión a internet');
                    setProgress(100);
                    setTimeout(() => {
                        if (mountedRef.current) onComplete();
                    }, 2000);
                    return;
                }

                // 3. Necesita sync → disparar ciclo
                setStage('connecting');
                setStatusText('Conectando con Supabase...');
                setProgress(20);

                await api.post('/sync/trigger');

                setStage('syncing');
                setStatusText('Descargando datos desde la nube...');
                setProgress(40);

                // 4. Polling hasta que el sync termine
                pollRef.current = setInterval(async () => {
                    if (!mountedRef.current) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        return;
                    }

                    attempts++;
                    try {
                        const { data: pollData } = await api.get<{ success: boolean; data: InitialStatus }>('/sync/initial-status');
                        const pollStatus = pollData.data;

                        // Si ya cloud data, el sync funcionó
                        if (pollStatus.hasCloudData) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            setStage('done');
                            setProgress(100);
                            setStatusText('¡Sincronización completada!');

                            if ((window as any).erpApi?.store) {
                                try {
                                    await (window as any).erpApi.store.set('initialSyncDone', true);
                                } catch { /* ignorar */ }
                            }

                            setTimeout(() => {
                                if (mountedRef.current) onComplete();
                            }, 1500);
                            return;
                        }

                        // Progreso estimado mientras espera
                        const elapsedProgress = Math.min(40 + (attempts * 2), 90);
                        setProgress(elapsedProgress);
                        setStatusText(`Sincronizando... (${Math.round(elapsedProgress)}%)`);

                    } catch { /* Error en poll, reintentar */ }

                    // Timeout: si lleva más de 30s, pasar a offline
                    if (attempts >= MAX_ATTEMPTS) {
                        if (pollRef.current) clearInterval(pollRef.current);
                        setStage('offline');
                        setProgress(100);
                        setStatusText('Tiempo de espera agotado — modo offline');
                        setTimeout(() => {
                            if (mountedRef.current) onComplete();
                        }, 2000);
                    }
                }, 1000);

            } catch (err: any) {
                if (!mountedRef.current) return;
                // Error de conexión con el backend → probablemente offline
                setStage('offline');
                setProgress(100);
                setStatusText('Servidor local disponible — modo offline');
                setTimeout(() => {
                    if (mountedRef.current) onComplete();
                }, 1500);
            }
        }

        checkAndSync();

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center z-50">
            {/* Logo / Marca */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    ALL<span className="text-emerald-400">MARKET</span>
                </h1>
                <p className="text-slate-400 text-sm mt-1">Abastos Sofimar</p>
            </div>

            {/* Animación / Icono de estado */}
            <div className="mb-8">
                {stage === 'checking' && (
                    <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
                )}
                {stage === 'connecting' && (
                    <div className="relative">
                        <Cloud className="w-16 h-16 text-blue-400 animate-pulse" />
                        <ArrowRight className="w-5 h-5 text-emerald-400 absolute -bottom-1 -right-1 animate-bounce" />
                    </div>
                )}
                {stage === 'syncing' && (
                    <div className="relative">
                        <Database className="w-16 h-16 text-emerald-400" />
                        <Loader2 className="w-6 h-6 text-blue-400 absolute -bottom-2 -right-2 animate-spin" />
                    </div>
                )}
                {stage === 'offline' && (
                    <CloudOff className="w-16 h-16 text-amber-400" />
                )}
                {stage === 'done' && (
                    <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                )}
                {stage === 'error' && (
                    <CloudOff className="w-16 h-16 text-red-400" />
                )}
            </div>

            {/* Texto de estado */}
            <p className="text-slate-300 text-lg font-medium mb-2">{statusText}</p>
            <p className="text-slate-500 text-sm mb-6">
                {stage === 'checking' && 'Preparando el sistema...'}
                {stage === 'connecting' && 'Estableciendo conexión segura...'}
                {stage === 'syncing' && 'Los datos de todas las sucursales se están descargando'}
                {stage === 'offline' && 'Podés usar la app sin conexión'}
                {stage === 'done' && 'Redirigiendo al inicio de sesión...'}
            </p>

            {/* Barra de progreso */}
            <div className="w-72 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                        stage === 'done'
                            ? 'bg-emerald-400'
                            : stage === 'offline'
                            ? 'bg-amber-400'
                            : 'bg-gradient-to-r from-blue-400 to-emerald-400'
                    }`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Footer */}
            <p className="text-slate-600 text-xs mt-12">
                ERP-Market v1.0.0 — Sistema Híbrido Offline-First
            </p>
        </div>
    );
}
