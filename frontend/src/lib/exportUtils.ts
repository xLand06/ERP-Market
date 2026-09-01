import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface ExportColumn<T> {
    header: string;
    key: keyof T | ((item: T) => any);
}

export function exportToExcel<T extends Record<string, any>>(
    data: T[],
    columns: ExportColumn<T>[],
    fileName: string,
    sheetName: string = 'Reporte'
) {
    try {
        if (!data || data.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }

        const formattedData = data.map((item) => {
            const row: Record<string, any> = {};
            columns.forEach((col) => {
                if (typeof col.key === 'function') {
                    row[col.header] = col.key(item);
                } else {
                    row[col.header] = item[col.key] ?? '';
                }
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(formattedData);

        // Anchos de columna automáticos
        const colWidths = columns.map((col) => {
            const maxLen = Math.max(
                col.header.length,
                ...formattedData.map((row) => String(row[col.header] || '').length)
            );
            return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
        });
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const timestamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);

        toast.success(`Excel exportado: ${fileName}.xlsx`);
    } catch (err: any) {
        console.error('Error al exportar Excel:', err);
        toast.error('Error al generar archivo Excel');
    }
}

export function exportToCSV<T extends Record<string, any>>(
    data: T[],
    columns: ExportColumn<T>[],
    fileName: string
) {
    try {
        if (!data || data.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }

        const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
        const rows = data.map((item) =>
            columns
                .map((col) => {
                    const val = typeof col.key === 'function' ? col.key(item) : item[col.key];
                    const str = val !== undefined && val !== null ? String(val) : '';
                    return `"${str.replace(/"/g, '""')}"`;
                })
                .join(',')
        );

        const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // UTF-8 BOM para Excel
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`CSV exportado: ${fileName}.csv`);
    } catch (err: any) {
        console.error('Error al exportar CSV:', err);
        toast.error('Error al generar archivo CSV');
    }
}
