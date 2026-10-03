import { Cloud, CloudOff, RefreshCw, Server } from 'lucide-react';
import { useSyncStore, syncApi } from '@/services/sync.service';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getServerUrlCache } from '@/lib/server-url';

export function CloudSyncWidget() {
    const { isOnline, isSyncing, lastSync } = useSyncStore();
    const [rotating, setRotating] = useState(false);
    const serverHost = getServerUrlCache()?.replace(/^https?:\/\//, '') || null;

    useEffect(() => {
        if (isSyncing) setRotating(true);
        else {
            const timer = setTimeout(() => setRotating(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isSyncing]);

    const handleManualSync = async () => {
        if (isSyncing) return;
        await syncApi.triggerSync();
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-xl border border-slate-200/50">
            <div className="flex items-center gap-1.5">
                {isOnline ? (
                    <Server className="w-4 h-4 text-emerald-500" />
                ) : (
                    <CloudOff className="w-4 h-4 text-slate-400" />
                )}
                <div className="hidden lg:flex flex-col leading-none">
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tight",
                        isOnline ? "text-emerald-600" : "text-slate-500"
                    )}>
                        {isOnline ? 'Servidor OK' : 'Sin conexión'}
                    </span>
                    {serverHost && (
                        <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap max-w-[120px] truncate">
                            {serverHost}
                        </span>
                    )}
                    {!serverHost && lastSync && (
                        <span className="text-[8px] text-slate-400 font-medium whitespace-nowrap">
                            Sinc: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>

            <div className="w-px h-6 bg-slate-200 mx-0.5" />

            <button
                onClick={handleManualSync}
                disabled={!isOnline || isSyncing}
                title="Actualizar estado del servidor"
                className={cn(
                    "p-1.5 rounded-lg transition-all active:scale-90",
                    isSyncing ? "bg-indigo-100 text-indigo-600" : "hover:bg-white text-slate-500 hover:text-indigo-600",
                    (!isOnline || isSyncing) && "opacity-50 cursor-not-allowed"
                )}
            >
                <RefreshCw className={cn(
                    "w-4 h-4",
                    rotating && "animate-spin"
                )} />
            </button>
        </div>
    );
}
