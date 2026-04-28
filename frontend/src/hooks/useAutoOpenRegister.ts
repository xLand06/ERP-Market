// =============================================================================
// useAutoOpenRegister — Hook de apertura automática de caja por horario
// Se ejecuta cada 60 segundos y abre la caja si la hora configurada coincide
// =============================================================================

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

interface UseAutoOpenRegisterOptions {
    /** ID de la sede activa */
    branchId: string | null;
    /** ¿Hay una caja ya abierta? Si es true, no hace nada */
    hasOpenRegister: boolean;
    /** Callback para refrescar el query de caja abierta después de abrir */
    onOpened?: () => void;
}

export function useAutoOpenRegister({ branchId, hasOpenRegister, onOpened }: UseAutoOpenRegisterOptions) {
    const { autoOpenTime } = useConfigStore();

    // Track whether we already opened today to avoid opening multiple times
    const openedTodayRef = useRef<string | null>(null);

    useEffect(() => {
        if (!autoOpenTime || !branchId) return;

        const check = async () => {
            if (hasOpenRegister) return; // Ya hay caja abierta

            const now = new Date();
            const [hh, mm] = autoOpenTime.split(':').map(Number);
            const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hh}:${mm}`;

            // Ya la abrimos hoy a esta hora
            if (openedTodayRef.current === todayKey) return;

            const currentH = now.getHours();
            const currentM = now.getMinutes();

            // Coincide en la hora y dentro del minuto configurado
            if (currentH === hh && currentM === mm) {
                openedTodayRef.current = todayKey;
                try {
                    await api.post('/cash-flow/open', { branchId, openingAmount: 0 });
                    toast.success(`🕐 Caja abierta automáticamente a las ${autoOpenTime} hrs`);
                    onOpened?.();
                } catch (err: any) {
                    // Si ya hay una caja abierta (carrera), ignorar el error P2002/duplicate
                    console.warn('[AutoOpenRegister]', err?.response?.data?.error || err.message);
                }
            }
        };

        // Ejecutar inmediatamente y luego cada 30 segundos
        check();
        const interval = setInterval(check, 30_000);
        return () => clearInterval(interval);
    }, [autoOpenTime, branchId, hasOpenRegister, onOpened]);
}
