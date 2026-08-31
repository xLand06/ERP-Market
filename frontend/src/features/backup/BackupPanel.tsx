// =============================================================================
// BackupPanel — Panel de Backup y Purga de Supabase
// Escalable para Google Drive OAuth2 (ver comentarios TODO)
// =============================================================================

import React, { useState } from 'react';
import {
    Download, Trash2, Cloud, CloudOff, AlertTriangle, CheckCircle2,
    HardDrive, RefreshCw, Shield, Info, Archive, ChevronDown, ChevronUp,
    Upload
} from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface BackupMeta {
    filename: string;
    sizeBytes: number;
    createdAt: string;
    tablesIncluded: string[];
}

interface CloudStat {
    table: string;
    count: number;
    oldestRecord: string | null;
}

interface PurgeResult {
    table: string;
    deletedCount: number;
}

interface CloudStorageStats {
    usedBytes: number;
    totalBytes: number;
    percentUsed: number;
}

const fmt = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, color = 'indigo' }: {
    icon: React.ElementType; title: string; subtitle: string; color?: string;
}) {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className={`p-2 rounded-lg ${colors[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
        </div>
    );
}

// ── Sección 1: Generar y gestionar backups locales ────────────────────────────

function BackupExportSection() {
    const queryClient = useQueryClient();
    const [exporting, setExporting] = useState(false);

    const { data: backups = [], isLoading } = useQuery<BackupMeta[]>({
        queryKey: ['backups'],
        queryFn: async () => {
            const res = await api.get('/backup/list');
            return res.data.data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (filename: string) => {
            await api.delete(`/backup/${encodeURIComponent(filename)}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups'] });
            toast.success('Backup eliminado');
        },
        onError: () => toast.error('Error al eliminar el backup'),
    });

    const handleExport = async () => {
        setExporting(true);
        const toastId = toast.loading('Generando backup desde SQLite...');
        try {
            const res = await api.post('/backup/export');
            const { filename } = res.data.data;
            queryClient.invalidateQueries({ queryKey: ['backups'] });
            toast.success(`Backup creado: ${filename}`, { id: toastId, duration: 5000 });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al generar backup', { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    const handleDownload = async (filename: string) => {
        const toastId = toast.loading('Descargando backup...');
        try {
            const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
                responseType: 'blob',
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Descarga completada', { id: toastId });
        } catch (error: any) {
            toast.error('Error al descargar el backup', { id: toastId });
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <SectionHeader
                icon={Archive}
                title="Copias de Seguridad Locales"
                subtitle="Exporta todos los datos de SQLite como archivo comprimido .json.gz"
            />

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-5">
                <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-700 space-y-1">
                    <p className="font-semibold">¿Qué incluye el backup?</p>
                    <p>Todos los datos del sistema: productos, ventas, inventario, clientes, usuarios y configuración. El archivo se genera desde la base de datos local (SQLite) y <strong>no modifica ningún dato</strong>.</p>
                    {/* TODO (Google Drive): reemplazar el párrafo de abajo por el botón de "Subir a Drive" 
                        una vez implementado OAuth2 con Google Cloud Console */}
                    <p className="mt-1 font-medium text-indigo-600">💡 Descarga el archivo y súbelo manualmente a Google Drive, OneDrive o cualquier almacenamiento en la nube de tu preferencia.</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button
                    id="btn-generate-backup"
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm shadow-indigo-200 disabled:opacity-60"
                >
                    <HardDrive className="w-4 h-4" />
                    {exporting ? 'Generando...' : 'Generar Nuevo Backup'}
                </button>

                <label
                    htmlFor="restore-upload-input"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                    <Upload className="w-4 h-4 text-slate-500" />
                    Subir y Restaurar Backup
                </label>
                <input
                    type="file"
                    id="restore-upload-input"
                    accept=".gz"
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (!window.confirm(
                            `¡ALERTA DE SEGURIDAD!\n\n` +
                            `• Esta acción REEMPLAZARÁ COMPLETAMENTE todos los datos de este equipo por los de "${file.name}".\n` +
                            `• Las ventas, productos y configuraciones actuales se borrarán de este equipo.\n` +
                            `• Se guardará una copia preventiva local por seguridad.\n\n` +
                            `¿Estás absolutamente seguro de continuar con la restauración?`
                        )) {
                            e.target.value = '';
                            return;
                        }

                        const toastId = toast.loading('Subiendo y restaurando base de datos...');
                        try {
                            const buffer = await file.arrayBuffer();
                            await api.post('/backup/upload-restore', buffer, {
                                headers: { 'Content-Type': 'application/gzip' }
                            });
                            toast.success('Restauración completada exitosamente.', { id: toastId });
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        } catch (err: any) {
                            toast.error(err?.response?.data?.error || 'Error al restaurar el backup', { id: toastId });
                        } finally {
                            e.target.value = '';
                        }
                    }}
                />
            </div>

            {/* Lista de backups */}
            <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Backups disponibles ({backups.length})
                </h4>
                {isLoading ? (
                    <div className="py-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : backups.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                        <Archive className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                        <p className="text-sm text-slate-400 font-medium">No hay backups generados aún</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {backups.map(b => (
                            <div key={b.filename} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 font-mono">{b.filename}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(b.createdAt)} · {fmt(b.sizeBytes)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleDownload(b.filename)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all"
                                        title="Descargar backup"
                                    >
                                        <Download className="w-3.5 h-3.5" /> Descargar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm(
                                                `¡ALERTA DE SEGURIDAD!\n\n` +
                                                `• Estás a punto de restaurar los datos del archivo "${b.filename}".\n` +
                                                `• Se borrará la información actual de este equipo.\n` +
                                                `• Se guardará un respaldo preventivo local por seguridad.\n\n` +
                                                `¿Confirmas la restauración completa?`
                                            )) return;

                                            const toastId = toast.loading('Restaurando datos desde el servidor...');
                                            try {
                                                await api.post(`/backup/restore/${encodeURIComponent(b.filename)}`);
                                                toast.success('Restauración completada exitosamente.', { id: toastId });
                                                setTimeout(() => {
                                                    window.location.reload();
                                                }, 2000);
                                            } catch (err: any) {
                                                toast.error(err?.response?.data?.error || 'Error al restaurar', { id: toastId });
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-amber-600 text-xs font-bold rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-all"
                                        title="Restaurar backup"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> Restaurar
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`¿Eliminar el backup ${b.filename}? Esta acción no se puede deshacer.`)) {
                                                deleteMutation.mutate(b.filename);
                                            }
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar backup"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Sección 2: Purgar Supabase ────────────────────────────────────────────────

function CloudPurgeSection() {
    const [olderThanDays, setOlderThanDays] = useState('30');
    const [logRetentionDays] = useState(90);
    const [showStats, setShowStats] = useState(false);
    const [purgeResults, setPurgeResults] = useState<PurgeResult[] | null>(null);
    const [purging, setPurging] = useState(false);

    const { data: cloudStorage, isLoading: loadingStorage } = useQuery<CloudStorageStats>({
        queryKey: ['cloud-storage'],
        queryFn: async () => {
            const res = await api.get('/backup/cloud-storage');
            return res.data.data;
        },
        refetchInterval: 60_000,
    });

    const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery<CloudStat[]>({
        queryKey: ['cloud-stats', olderThanDays],
        queryFn: async () => {
            const days = parseInt(olderThanDays) || 0;
            const res = await api.get(`/backup/cloud-stats?days=${days}`);
            return res.data.data;
        },
        enabled: showStats,
        staleTime: 60_000,
    });

    console.log('stats', stats);
    const totalToDelete = stats?.reduce((s, r) => s + (r as any).count, 0) ?? 0;
    const totalInCloud = stats?.reduce((s, r) => s + (r as any).totalCount, 0) ?? 0;

    const handlePurge = async () => {
        if (!window.confirm(
            `¿Confirmas la purga de registros con más de ${olderThanDays} días en Supabase?\n\n` +
            `• Se eliminarán aproximadamente ${totalToDelete.toLocaleString()} registros de la NUBE.\n` +
            `• Los datos locales (SQLite) permanecerán INTACTOS.\n` +
            `• Solo se borran registros ya sincronizados (SYNCED).`
        )) return;

        setPurging(true);
        const toastId = toast.loading('Purgando Supabase...');
        try {
            const days = parseInt(olderThanDays) || 30;
            const res = await api.post('/backup/purge-cloud', { olderThanDays: days, logRetentionDays });
            setPurgeResults(res.data.data.results);
            toast.success(res.data.data.message, { id: toastId, duration: 6000 });
            refetchStats();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al purgar Supabase', { id: toastId });
        } finally {
            setPurging(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <SectionHeader
                icon={Cloud}
                title="Gestión de Supabase"
                subtitle="Libera espacio en la nube borrando registros antiguos ya sincronizados"
                color="amber"
            />

            {/* Consumo de Almacenamiento en Supabase */}
            <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold text-slate-700">Espacio en Supabase (Plan Gratuito 500 MB)</span>
                    </div>
                    {loadingStorage ? (
                        <span className="text-xs text-slate-400 font-medium">Calculando...</span>
                    ) : (
                        <span className="text-xs font-bold text-slate-600">
                            {cloudStorage ? `${fmt(cloudStorage.usedBytes)} / ${fmt(cloudStorage.totalBytes)}` : 'N/A'}
                        </span>
                    )}
                </div>
                {!loadingStorage && cloudStorage && (
                    <div className="space-y-1.5">
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    cloudStorage.percentUsed > 80 ? 'bg-red-500' :
                                    cloudStorage.percentUsed > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${cloudStorage.percentUsed}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-semibold">{cloudStorage.percentUsed}% utilizado</span>
                            <span className={`font-bold ${
                                cloudStorage.percentUsed > 80 ? 'text-red-600' :
                                cloudStorage.percentUsed > 50 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                                {fmt(cloudStorage.totalBytes - cloudStorage.usedBytes)} libres
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Advertencia */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl mb-5">
                <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Política de Purga Inteligente</p>
                    <ul className="space-y-0.5 list-disc list-inside text-amber-700">
                        <li>Solo se borran registros marcados como <strong>SYNCED</strong> (ya en la nube)</li>
                        <li><strong>Purga Automática:</strong> Se activa al superar el <strong>70%</strong> de uso en Supabase.</li>
                        <li><strong>Retención:</strong> Registros antiguos (&gt;15 días) y Logs (&gt;60 días) se eliminan al purgar.</li>
                        <li>Las cajas abiertas nunca se borran.</li>
                        <li><strong>Los datos locales (SQLite) permanecen intactos.</strong></li>
                    </ul>
                </div>
            </div>

            {/* Control de días */}
            <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                        Borrar registros con más de:
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            id="input-purge-days"
                            type="text"
                            inputMode="numeric"
                            value={olderThanDays}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d+$/.test(val)) {
                                    setOlderThanDays(val);
                                }
                            }}
                            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                        />
                        <span className="text-sm font-semibold text-slate-600">días</span>
                        <button
                            onClick={() => { setShowStats(true); refetchStats(); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Ver impacto
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats de la purga */}
            {showStats && (
                <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowStats(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <span>
                            Impacto de la Purga: {totalToDelete.toLocaleString()} registros a eliminar 
                            <span className="text-slate-400 font-normal ml-2">(de {totalInCloud.toLocaleString()} totales en nube)</span>
                        </span>
                        {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {loadingStats ? (
                        <div className="p-4 text-center text-sm text-slate-400">Consultando Supabase...</div>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-y border-slate-100">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase">Tabla</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">A eliminar</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Total en Nube</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase">Más antiguo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(stats as any[])?.map(s => (
                                    <tr key={s.table} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 font-mono text-slate-700">
                                            {s.table === 'transactionItems' ? '📦 Detalle de Transacciones' :
                                             s.table === 'transactions' ? '📝 Transacciones / Ventas' :
                                             s.table === 'cashRegisters' ? '💰 Sesiones de Caja' :
                                             s.table === 'auditLogs' ? '🔍 Logs de Auditoría' : s.table}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-bold ${s.count > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {s.count.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-slate-500">
                                            {s.totalCount?.toLocaleString() ?? '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-slate-400 text-xs">
                                            {s.oldestRecord ? fmtDate(s.oldestRecord) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalToDelete === 0 && (stats?.some(s => (s as any).totalCount > 0)) && (
                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center italic">
                                Nota: Hay registros en la nube, pero ninguno supera los {olderThanDays} días de antigüedad seleccionados.
                            </div>
                        )}
                    </>
                )}
            </div>
        )}

            {/* Resultados de la última purga */}
            {purgeResults && (
                <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700">Purga completada exitosamente</span>
                    </div>
                    <div className="space-y-1.5">
                        {purgeResults.map(r => (
                            <div key={r.table} className="flex justify-between text-xs">
                                <span className="font-mono text-emerald-700">{r.table}</span>
                                <span className="font-bold text-emerald-800">{r.deletedCount.toLocaleString()} eliminados</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                id="btn-purge-cloud"
                onClick={handlePurge}
                disabled={purging || olderThanDays < 7}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-all active:scale-95 shadow-sm shadow-amber-200 disabled:opacity-60"
            >
                {purging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudOff className="w-4 h-4" />}
                {purging ? 'Purgando Supabase...' : `Purgar registros > ${olderThanDays} días`}
            </button>

            {olderThanDays < 7 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Mínimo 7 días para evitar pérdida de datos activos
                </p>
            )}
        </div>
    );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export function BackupPanel() {
    return (
        <div className="max-w-3xl space-y-6 animate-fade-in">
            <BackupExportSection />
            <CloudPurgeSection />
        </div>
    );
}
