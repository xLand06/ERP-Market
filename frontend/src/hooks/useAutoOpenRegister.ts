import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

interface UseAutoOpenRegisterOptions {
    branchId: string | null;
    hasOpenRegister: boolean;
    onOpened?: () => void;
}

export function useAutoOpenRegister({ branchId, hasOpenRegister, onOpened }: UseAutoOpenRegisterOptions) {
    const { autoOpenTime } = useConfigStore();
    const openedTodayRef = useRef<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!autoOpenTime || !branchId) return;

        const [targetH, targetM] = autoOpenTime.split(':').map(Number);

        const scheduleNext = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            const now = new Date();
            const next = new Date(now);
            next.setHours(targetH, targetM, 0, 0);

            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }

            const delay = next.getTime() - now.getTime();
            timeoutRef.current = setTimeout(async () => {
                if (hasOpenRegister) {
                    scheduleNext();
                    return;
                }

                const now2 = new Date();
                const todayKey = `${now2.getFullYear()}-${now2.getMonth()}-${now2.getDate()}-${targetH}:${targetM}`;

                if (openedTodayRef.current === todayKey) {
                    scheduleNext();
                    return;
                }

                openedTodayRef.current = todayKey;
                try {
                    await api.post('/cash-flow/open', { branchId, openingAmount: 0 });
                    toast.success(`Caja abierta automáticamente a las ${autoOpenTime} hrs`);
                    onOpened?.();
                } catch (err: any) {
                    console.warn('[AutoOpenRegister]', err?.response?.data?.error || err.message);
                }

                scheduleNext();
            }, delay);
        };

        scheduleNext();

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [autoOpenTime, branchId, hasOpenRegister, onOpened]);
}