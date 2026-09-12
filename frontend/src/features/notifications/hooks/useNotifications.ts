// =============================================================================
// USE NOTIFICATIONS HOOK
// Sondea /api/notifications cada 60s y mantiene el estado de descarte (dismiss)
// en localStorage, PER-USUARIO. El descarte solo oculta la notificación; si el
// problema subyacente persiste, reaparece en el próximo poll (comportamiento
// correcto: la alerta vuelve mientras el fiado/stock bajo siga vigente).
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { notificationsApi, AppNotification } from '@/services/notifications.service';

const POLL_INTERVAL_MS = 60 * 1000; // 60 segundos

/**
 * Clave de localStorage única por usuario para el arreglo de notificaciones
 * descartadas. Usa id cuando existe, con fallback al username.
 */
function getStorageKey(userId?: string, username?: string): string | null {
    const identifier = userId || username;
    return identifier ? `notif-dismissed-${identifier}` : null;
}

function readDismissed(storageKey: string): string[] {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
    } catch {
        // Storage corrupto → arrancar limpio
        return [];
    }
}

function writeDismissed(storageKey: string, keys: string[]): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(keys));
    } catch {
        // localStorage lleno o indisponible → no es crítico
    }
}

interface UseNotificationsResult {
    items: AppNotification[];
    loading: boolean;
    refresh: () => Promise<void>;
    dismiss: (key: string) => void;
}

export function useNotifications(): UseNotificationsResult {
    const user = useAuthStore((s) => s.user);
    const storageKey = getStorageKey(user?.id, user?.username);

    const [items, setItems] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    // Set de claves descartadas (inicializado desde localStorage por usuario)
    const [dismissed, setDismissed] = useState<Set<string>>(
        () => new Set(storageKey ? readDismissed(storageKey) : [])
    );

    // Cuando cambia el usuario, re-cargar su propio estado de descarte
    useEffect(() => {
        if (storageKey) {
            setDismissed(new Set(readDismissed(storageKey)));
        } else {
            setDismissed(new Set());
        }
    }, [storageKey]);

    const refresh = useCallback(async () => {
        try {
            const { items: freshItems } = await notificationsApi.getNotifications();
            setItems(freshItems);
        } catch {
            // Fallo silencioso: conserva las notificaciones previas y reintenta
            // en el próximo poll.
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch inicial + poll cada 60s con limpieza del interval
    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    // Persistir el set de descartes en localStorage ante cada cambio
    useEffect(() => {
        if (storageKey) {
            writeDismissed(storageKey, [...dismissed]);
        }
    }, [dismissed, storageKey]);

    const dismiss = useCallback((key: string) => {
        setDismissed((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    // Filtrar las notificaciones descartadas por el usuario
    const visibleItems = items.filter((item) => !dismissed.has(item.key));

    return {
        items: visibleItems,
        loading,
        refresh,
        dismiss,
    };
}