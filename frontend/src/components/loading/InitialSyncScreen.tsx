// =============================================================================
// INITIAL SYNC SCREEN — Pantalla de carga en el primer inicio de la app
// 
// CRÍTICO: La DB local NO tiene seed data. Todos los datos (usuarios,
// productos, sucursales, etc.) se descargan desde Supabase en el primer sync.
// 
// Si no hay internet en el primer inicio → BLOQUEA la app con botón reintentar.
// No permite pasar al login hasta que tenga datos reales de la nube.
// 
// En inicios posteriores (datos ya descargados), si no hay internet pasa
// directo al login y opera offline hasta que la conexión se restablezca.
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, CloudOff, CheckCircle2, Database, Cloud, ArrowRight, RefreshCw } from 'lucide-react';
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
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const cleanup = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const markDone = useCallback(async () => {
        if ((window as any).erpApi?.store) {
            try {
                await (window as any).erpApi.store.set('initialSyncDone', true);
            } catch { /* Electron store no disponible en dev */ }
        }
    }, []);

    const checkAndSync = useCallback(async () => {
        if (!mountedRef.current) return;
        cleanup();
        setStage('checking');
        setProgress(0);
        setStatusText('Verificando conexión...');

        let attempts = 0;
        const MAX_ATTEMPTS = 30;

        try {
            // 1. Verificar estado inicial
            const { data: statusData } = await api.get<{ success: boolean; data: InitialStatus }>('/sync/initial-status');
            const status = statusData.data;

            if (!mountedRef.current) return;

            // ✅ Ya tiene datos de cloud (inicio posterior) → pasar directo
            if (status.hasCloudData || !status.needsInitialSync) {
                setStage('done');
                setProgress(100);
                setStatusText('Datos sincronizados');
                await markDone();
                setTimeout(() => { if (mountedRef.current) onComplete(); }, 500);
                return;
            }

            // 🚫 Sin conexión + necesita datos de cloud → BLOQUEAR
            if (!status.isOnline) {
                setStage('offline');
                setProgress(0);
                setStatusText('Se requiere conexión a internet');
                return;
            }

            // 2. Hay conexión y necesita sync → disparar ciclo
            setStage('connecting');
            setStatusText('Conectando con Supabase...');
            setProgress(15);

            await api.post('/sync/trigger');

            setStage('syncing');
            setStatusText('Descargando datos desde la nube...');
            setProgress(30);

            // 3. Polling hasta que el sync termine
            pollRef.current = setInterval(async () => {
                if (!mountedRef.current) { cleanup(); return; }

                attempts++;
                try {
                    const { data: pollData } = await api.get<{ success: boolean; data: InitialStatus }>('/sync/initial-status');
                    const pollStatus = pollData.data;

                    // ✅ Sync completado
                    if (pollStatus.hasCloudData) {
                        cleanup();
                        setStage('done');
                        setProgress(100);
                        setStatusText('¡Sincronización completada!');
                        await markDone();
                        setTimeout(() => { if (mountedRef.current) onComplete(); }, 500);
                        return;
                    }

                    // Progreso estimado mientras espera
                    const elapsedProgress = Math.min(30 + (attempts * 2), 90);
                    setProgress(elapsedProgress);

                } catch { /* Error en poll, reintentar */ }

                // ⏱ Timeout: no llegaron datos después de 30s → bloquear
                if (attempts >= MAX_ATTEMPTS) {
                    cleanup();
                    setStage('offline');
                    setProgress(0);
                    setStatusText('Tiempo de espera agotado — verifica tu conexión');
                }
            }, 1000);

        } catch (err: any) {
            if (!mountedRef.current) return;
            // Error de conexión con el backend local
            setStage('offline');
            setProgress(0);
            setStatusText('Error de conexión con el servidor local');
        }
    }, [onComplete, cleanup, markDone]);

    // Efecto principal: arrancar sync al montar
    useEffect(() => {
        checkAndSync();
        return cleanup;
    }, [checkAndSync, cleanup]);

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
                    <CloudOff className="w-16 h-16 text-red-400" />
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
            <p className="text-slate-500 text-sm mb-8 text-center max-w-xs">
                {stage === 'checking' && 'Preparando el sistema...'}
                {stage === 'connecting' && 'Estableciendo conexión segura...'}
                {stage === 'syncing' && 'Los datos de todas las sucursales se están descargando'}
                {(stage === 'offline') && 'La app necesita descargar los datos de Supabase para funcionar. Verificá que el cable de red esté conectado o que el Wi-Fi esté activo.'}
                {stage === 'done' && 'Redirigiendo al inicio de sesión...'}
            </p>

            {/* Barra de progreso (solo cuando hay progreso real) */}
            {stage !== 'offline' && stage !== 'error' && (
                <div className="w-72 h-2 bg-slate-700 rounded-full overflow-hidden mb-8">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                            stage === 'done'
                                ? 'bg-emerald-400'
                                : 'bg-gradient-to-r from-blue-400 to-emerald-400'
                        }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Botón reintentar (solo en offline/error) */}
            {(stage === 'offline' || stage === 'error') && (
                <button
                    onClick={checkAndSync}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/30 active:scale-95"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar conexión
                </button>
            )}

            {/* Footer */}
            <p className="text-slate-600 text-xs mt-12">
                ERP-Market v2.0 — Sistema Híbrido Offline-First
            </p>
        </div>
    );
}
