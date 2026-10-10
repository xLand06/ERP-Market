// =============================================================================
// AI CHAT CHART & DATA COMPONENT
// Renderiza gráficos interactivos y tablas directamente en el mensaje del chat
// con descarga instantánea a Excel, PDF y CSV (cero desperdicio de tokens).
// =============================================================================

import { useState, useMemo } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { FileSpreadsheet, FileText, Download, Table as TableIcon, BarChart3 } from 'lucide-react';

interface AiChatChartProps {
    data: any[];
    onDownload: (format: 'excel' | 'pdf' | 'csv') => void;
}

export function AiChatChart({ data, onDownload }: AiChatChartProps) {
    const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

    if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
    }

    const headers = Object.keys(data[0]);

    // Detectar columnas numéricas y de etiquetas
    const { labelKey, numericKeys, isDateSeries } = useMemo(() => {
        const numKeys = headers.filter(h =>
            data.some(r => {
                const val = r[h];
                return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '' && typeof val !== 'boolean');
            })
        );

        const lblKey =
            headers.find(h => /fecha|date|day|mes|dia|periodo/i.test(h)) ||
            headers.find(h => !numKeys.includes(h)) ||
            headers[0];

        // Verificar si los valores del label parecen fechas
        const sampleVal = String(data[0]?.[lblKey] || '');
        const isDate = /^\d{4}-\d{2}-\d{2}/.test(sampleVal) || /fecha|date|day/i.test(lblKey);

        return {
            labelKey: lblKey,
            numericKeys: numKeys,
            isDateSeries: isDate,
        };
    }, [data, headers]);

    // Preparar dataset para Recharts
    const chartData = useMemo(() => {
        return data.map(item => {
            const rawLabel = String(item[labelKey] ?? '');
            let formattedLabel = rawLabel;

            if (isDateSeries && rawLabel.length >= 10) {
                try {
                    const d = new Date(rawLabel.includes('T') ? rawLabel : rawLabel + 'T00:00:00');
                    if (!isNaN(d.getTime())) {
                        formattedLabel = d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
                    }
                } catch {}
            } else if (rawLabel.length > 14) {
                formattedLabel = rawLabel.slice(0, 12) + '…';
            }

            const rowFormatted: any = {
                __label: formattedLabel,
                __fullLabel: rawLabel,
            };

            numericKeys.forEach(nk => {
                rowFormatted[nk] = Number(item[nk]) || 0;
            });

            return rowFormatted;
        });
    }, [data, labelKey, numericKeys, isDateSeries]);

    const primaryMetricKey = numericKeys[0];
    const canRenderChart = chartData.length >= 2 && Boolean(primaryMetricKey);

    return (
        <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/60 flex flex-col gap-2.5">
            {/* Header del widget con toggles */}
            <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {canRenderChart && viewMode === 'chart' ? (
                        <>
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                            Visualización de datos
                        </>
                    ) : (
                        <>
                            <TableIcon className="w-3.5 h-3.5 text-slate-500" />
                            Tabla de datos
                        </>
                    )}
                </span>

                {canRenderChart && (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setViewMode('chart')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                viewMode === 'chart'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            Gráfico
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                        >
                            Tabla
                        </button>
                    </div>
                )}
            </div>

            {/* Contenido: Gráfico o Tabla */}
            {canRenderChart && viewMode === 'chart' ? (
                <div className="w-full h-[180px] min-w-0 bg-slate-50/80 dark:bg-slate-900/40 rounded-xl p-2 border border-slate-200/60 dark:border-slate-800/60">
                    <ResponsiveContainer width="100%" height="100%">
                        {isDateSeries ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                                <XAxis
                                    dataKey="__label"
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[11px] border border-slate-700">
                                                    <p className="font-semibold text-slate-300">{item.__fullLabel}</p>
                                                    <p className="font-bold text-emerald-400">
                                                        {primaryMetricKey}: {Number(payload[0].value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={primaryMetricKey}
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#emeraldGradient)"
                                />
                            </AreaChart>
                        ) : (
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                                <XAxis
                                    dataKey="__label"
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-[11px] border border-slate-700">
                                                    <p className="font-semibold text-slate-300">{item.__fullLabel}</p>
                                                    <p className="font-bold text-emerald-400">
                                                        {primaryMetricKey}: {Number(payload[0].value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey={primaryMetricKey}
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            ) : (
                /* Vista de Tabla */
                <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 shadow-inner">
                    <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-bold">
                            <tr>
                                {headers.map(h => (
                                    <th key={h} className="px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                        {h.replace(/_/g, ' ')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {data.slice(0, 50).map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    {headers.map(h => {
                                        const val = row[h];
                                        const isNum = typeof val === 'number';
                                        return (
                                            <td key={h} className={`px-2.5 py-1 whitespace-nowrap ${isNum ? 'text-right font-medium' : ''}`}>
                                                {isNum
                                                    ? val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : String(val ?? '-')}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Barra de botones de descarga instantánea */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => onDownload('excel')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer active:scale-95"
                        title="Descargar Excel con formato profesional"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => onDownload('pdf')}
                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 text-[11px] font-bold rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer active:scale-95"
                        title="Descargar PDF formateado"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => onDownload('csv')}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer active:scale-95"
                        title="Descargar CSV sin formato"
                    >
                        <Download className="w-3 h-3" />
                        CSV
                    </button>
                </div>

                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {data.length} {data.length === 1 ? 'fila' : 'filas'}
                </span>
            </div>
        </div>
    );
}
