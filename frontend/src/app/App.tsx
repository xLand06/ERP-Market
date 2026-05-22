// =============================================================================
// APP — Componente principal con Providers
// 
// En Electron: muestra pantalla de carga inicial la primera vez que se inicia
// para sincronizar datos desde Supabase. En inicios posteriores va directo.
// 
// SEGURIDAD: aunque `initialSyncDone` esté marcado, verifica que realmente
// haya datos en la DB local. Si no hay (DB corrupta/reemplazada), fuerza un
// nuevo sync. Sin esto, el usuario quedaría atrapado en login sin usuarios.
// =============================================================================

import { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './queryClient';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './global.css';

import { useConfigStore } from '@/hooks/useConfigStore';
import InitialSyncScreen from '@/components/loading/InitialSyncScreen';
import api from '@/lib/api';

export default function App() {
    const { fetchSettings } = useConfigStore();
    const [initialSyncDone, setInitialSyncDone] = useState(true); // Por defecto: pasar directo
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        async function checkFirstRun() {
            const isElectron = (window as any).erpApi?.isElectron;

            // Solo mostrar carga en Electron compilado, no en dev (browser)
            if (!isElectron) {
                setChecking(false);
                setInitialSyncDone(true);
                return;
            }

            try {
                const stored = await (window as any).erpApi.store.get('initialSyncDone');

                if (stored === true) {
                    // Ya se hizo sync antes → verificar que los datos SIGAN ahí
                    // (seguro contra DB corrupta o reemplazada)
                    try {
                        const { data: statusData } = await api.get('/sync/initial-status');
                        const hasData = statusData?.data?.hasCloudData === true
                            || statusData?.data?.needsInitialSync === false;

                        if (hasData) {
                            setInitialSyncDone(true);
                        } else {
                            // La DB está vacía aunque el flag diga que ya sincronizó
                            console.warn('[App] initialSyncDone=true pero DB vacía — forzando re-sync');
                            setInitialSyncDone(false);
                        }
                    } catch {
                        // Backend no disponible aún (arrancando) — asumir que está bien
                        setInitialSyncDone(true);
                    }
                } else {
                    // Primera vez o nunca se completó → mostrar loading
                    setInitialSyncDone(false);
                }
            } catch {
                // Si falla el store, asumir que ya está sincronizado
                setInitialSyncDone(true);
            }

            setChecking(false);
        }

        checkFirstRun();
    }, []);

    // Mientras verificamos si es primer inicio, mostrar un loading simple
    if (checking) {
        return (
            <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
                <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    // Primer inicio en Electron: mostrar pantalla de sync
    if (!initialSyncDone) {
        return (
            <InitialSyncScreen onComplete={() => setInitialSyncDone(true)} />
        );
    }

    // Normal: arrancar la app
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#0F172A',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                    },
                    success: {
                        iconTheme: { primary: '#10B981', secondary: '#fff' },
                    },
                    error: {
                        iconTheme: { primary: '#EF4444', secondary: '#fff' },
                    },
                }}
            />
        </QueryClientProvider>
    );
}