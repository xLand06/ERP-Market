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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BusinessReportInfo {
    businessName: string;
    taxId?: string;
    fiscalAddress?: string;
    fiscalPhone?: string;
}

export interface ReportPDFOptions {
    title: string;
    periodLabel: string;
    business: BusinessReportInfo;
    fileName: string;
    summaryCards?: { label: string; value: string }[];
    tables: {
        title?: string;
        headers: string[];
        rows: (string | number)[][];
    }[];
}

export function exportReportToPDF(options: ReportPDFOptions) {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let currentY = 16;

        // Header: Business Name (Clean, Bold, NO LOGOS per user requirement)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text((options.business.businessName || 'ERP MARKET').toUpperCase(), 14, currentY);
        currentY += 5.5;

        // Business Fiscal Details (RIF, Teléfono, Dirección)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); // slate-500
        const metaParts = [
            options.business.taxId ? `RIF/Cédula: ${options.business.taxId}` : '',
            options.business.fiscalPhone ? `Tel: ${options.business.fiscalPhone}` : '',
            options.business.fiscalAddress ? `Dir: ${options.business.fiscalAddress}` : '',
        ].filter(Boolean);

        if (metaParts.length > 0) {
            doc.text(metaParts.join('   |   '), 14, currentY);
            currentY += 5;
        }

        // Divider line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentY += 6;

        // Report Title & Period info
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(options.title.toUpperCase(), 14, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const dateStr = `Emisión: ${new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}  |  Período: ${options.periodLabel}`;
        doc.text(dateStr, pageWidth - 14, currentY, { align: 'right' });
        currentY += 7;

        // Summary Cards (KPIs)
        if (options.summaryCards && options.summaryCards.length > 0) {
            const count = options.summaryCards.length;
            const gap = 3;
            const availableWidth = pageWidth - 28;
            const cardWidth = (availableWidth - (count - 1) * gap) / count;
            const cardHeight = 15;

            options.summaryCards.forEach((c, idx) => {
                const x = 14 + idx * (cardWidth + gap);
                doc.setFillColor(248, 250, 252); // slate-50
                doc.setDrawColor(226, 232, 240); // slate-200
                doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.text(c.label.toUpperCase(), x + 3, currentY + 4.5);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(15, 23, 42);
                doc.text(String(c.value), x + 3, currentY + 10.5);
            });
            currentY += cardHeight + 7;
        }

        // Tables
        for (const table of options.tables) {
            if (table.title) {
                // Check if page break needed
                if (currentY > pageHeight - 35) {
                    doc.addPage();
                    currentY = 16;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(30, 41, 59);
                doc.text(table.title, 14, currentY);
                currentY += 4;
            }

            autoTable(doc, {
                startY: currentY,
                head: [table.headers],
                body: table.rows,
                theme: 'striped',
                headStyles: {
                    fillColor: [30, 41, 59], // slate-800
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'left',
                },
                bodyStyles: {
                    textColor: [51, 65, 85], // slate-700
                    fontSize: 7.5,
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252], // slate-50
                },
                margin: { left: 14, right: 14, bottom: 15 },
                didDrawPage: () => {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text(
                        `${options.business.businessName || 'ERP Market'} — Documento de reporte administrativo`,
                        14,
                        pageHeight - 8
                    );
                },
            });

            currentY = (doc as any).lastAutoTable.finalY + 8;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        doc.save(`${options.fileName}_${timestamp}.pdf`);
        toast.success(`PDF descargado: ${options.fileName}.pdf`);
    } catch (err: any) {
        console.error('Error al generar PDF:', err);
        toast.error('Error al exportar el reporte a PDF');
    }
}
