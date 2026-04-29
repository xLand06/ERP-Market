import { useLocalStats, useClearPending, useForceSync, useSyncStatus, useClearSyncTokens } from '../hooks/useMaintenance';
import { 
    Database, Package, Receipt, ShoppingCart, Archive, Wallet, 
    Trash2, RefreshCw, Cloud, AlertTriangle, ArrowRight, Server
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600', 
        amber: 'bg-amber-50 text-amber-600',
        blue: 'bg-blue-50 text-blue-600',
        rose: 'bg-rose-50 text-rose-600',
        cyan: 'bg-cyan-50 text-cyan-600',
    };
    return (
        <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all">
            <div className={`p-3 rounded-lg ${colors[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-2xl font-black text-slate-900">{value.toLocaleString('es-CO')}</p>
                <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
        </div>
    );
}

function SectionCard({ icon: Icon, title, description, children, color = 'indigo' }: {
    icon: React.ElementType; title: string; description: string; children: React.ReactNode; color?: string;
}) {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-base font-bold text-slate-900">{title}</h3>
                    <p className="text-xs text-slate-500">{description}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

export function MaintenanceTab() {
    const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useLocalStats();
    const clearPending = useClearPending();
    const forceSync = useForceSync();
    const { data: syncStatus, isLoading: loadingSync } = useSyncStatus();
    const clearTokens = useClearSyncTokens();

    const handleClearPending = () => {
        if (!window.confirm('¿Eliminar transacciones ya sincronizadas de la base de datos local?\n\nEsto reducirá el tamaño de la base SQLite pero no afectará la nube.')) return;
        clearPending.mutate();
    };

    const handleForceSync = () => {
        if (!window.confirm('¿Forzar sincronización inmediata?\n\nSe intentarán sincronizar todos los registros pendientes.')) return;
        forceSync.mutate();
    };

    const handleClearTokens = () => {
        if (!window.confirm('¿Reiniciar sincronización desde cero?\n\nSe borrarán los tokens de sync y se forzará una re-sincronización completa.')) return;
        clearTokens.mutate();
        toast.success('Tokens limpiados — reinicia la app para aplicar');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Sección 1: Estadísticas del sistema */}
            <SectionCard icon={Server} title="Estadísticas del Sistema" description="Uso de la base de datos SQLite local" color="indigo">
                {loadingStats ? (
                    <div className="py-8 text-center text-slate-400">Cargando estadísticas...</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard icon={Database} label="Sucursales" value={stats?.branchCount ?? 0} color="indigo" />
                        <StatCard icon={Package} label="Productos" value={stats?.productCount ?? 0} color="emerald" />
                        <StatCard icon={Receipt} label="Transacciones" value={stats?.transactionCount ?? 0} color="amber" />
                        <StatCard icon={ShoppingCart} label="Ventas" value={stats?.saleCount ?? 0} color="blue" />
                        <StatCard icon={Archive} label="Compras" value={stats?.purchaseCount ?? 0} color="rose" />
                        <StatCard icon={Wallet} label="Cajas" value={stats?.registerCount ?? 0} color="cyan" />
                    </div>
                )}
            </SectionCard>

            {/* Sección 2: Limpiar transacciones sincronizadas */}
            <SectionCard icon={Trash2} title="Limpiar Transacciones Sincronizadas" description="Eliminar registros ya respaldados en la nube para reducir tamaño de SQLite" color="amber">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-700 font-medium">Transacciones sincronizadas</p>
                        <p className="text-xs text-slate-500 mt-1">Borra las transacciones que ya están en Supabase (marcadas como SYNCED)</p>
                    </div>
                    <button
                        onClick={handleClearPending}
                        disabled={clearPending.isPending}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        {clearPending.isPending ? 'Limpiando...' : 'Limpiar'}
                    </button>
                </div>
            </SectionCard>

            {/* Sección 3: Opciones de sincronización */}
            <SectionCard icon={RefreshCw} title="Sincronización" description="Control manual del proceso de sync con la nube" color="emerald">
                <div className="space-y-4">
                    {/* Estado actual */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${syncStatus?.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <div>
                                    <p className="text-sm font-bold text-slate-800">
                                        {loadingSync ? 'Verificando...' : syncStatus?.isOnline ? 'Conectado a la nube' : 'Sin conexión'}
                                    </p>
                                    <p className="text-xs text-slate-500">Última sync: {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString('es-CO') : 'Nunca'}</p>
                                </div>
                            </div>
                            {syncStatus?.pendingCount !== undefined && (
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                    {syncStatus.pendingCount} pendientes
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleForceSync}
                            disabled={forceSync.isPending}
                            className="flex-1 min-w-[200px] px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${forceSync.isPending ? 'animate-spin' : ''}`} />
                            {forceSync.isPending ? 'Sincronizando...' : 'Forzar Sincronización'}
                        </button>
                        <button
                            onClick={handleClearTokens}
                            className="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Reiniciar Sync
                        </button>
                    </div>
                </div>
            </SectionCard>

            {/* Sección 4: Link a Purga de Supabase (del tab Backup) */}
            <SectionCard icon={Cloud} title="Purga de Base de Datos en la Nube" description="Gestionar datos en Supabase (backup, restore, purge)" color="blue">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-700 font-medium">Supabase Cloud</p>
                        <p className="text-xs text-slate-500 mt-1">Crear backups, restaurar datos o purgar registros antiguos de la nube</p>
                    </div>
                    <button
                        onClick={() => window.location.hash = 'settings/backup'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                        Gestionar en Backup
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </SectionCard>
        </div>
    );
}