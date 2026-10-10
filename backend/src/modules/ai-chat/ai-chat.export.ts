// =============================================================================
// AI CHAT EXPORT SERVICE — Generación programática de Excel y PDF
// Ahorro total de tokens: la IA solo provee los datos, el código genera los documentos.
// =============================================================================

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Genera un archivo Excel profesional (.xlsx) con estilos y formato condicional.
 */
export async function generateExcelReport(data: any[], title = 'Reporte de Gestión'): Promise<Buffer> {
    if (!data || data.length === 0) {
        throw new Error('No hay datos para generar el reporte Excel');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ALL MARKET ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Datos', {
        views: [{ showGridLines: true }],
    });

    const headers = Object.keys(data[0]);
    const numCols = headers.length;

    // ── 1. Banner de encabezado ──────────────────────────────────────────────
    // Título principal
    sheet.mergeCells(1, 1, 1, Math.max(numCols, 2));
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `ALL MARKET — ${title.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Subtítulo con metadata
    const dateStr = new Date().toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
    sheet.mergeCells(2, 1, 2, Math.max(numCols, 2));
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = `Generado el ${dateStr}  ·  Total: ${data.length} registros  ·  Asistente IA`;
    subtitleCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF475569' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Fila 3 en blanco
    sheet.getRow(3).height = 10;

    // ── 2. Encabezados de tabla (Fila 4) ──────────────────────────────────────
    const headerRow = sheet.getRow(4);
    headerRow.height = 24;
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h.replace(/_/g, ' ').toUpperCase();
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF047857' } },
            left: { style: 'thin', color: { argb: 'FF047857' } },
            bottom: { style: 'medium', color: { argb: 'FF047857' } },
            right: { style: 'thin', color: { argb: 'FF047857' } },
        };
    });

    // ── 3. Filas de datos ────────────────────────────────────────────────────
    const numericCols = new Set<string>();
    headers.forEach(h => {
        const hasNumber = data.some(r => typeof r[h] === 'number' || (!isNaN(Number(r[h])) && r[h] !== null && r[h] !== '' && typeof r[h] !== 'boolean'));
        if (hasNumber) numericCols.add(h);
    });

    let currentRowIdx = 5;
    data.forEach((row, rowNum) => {
        const rowObj = sheet.getRow(currentRowIdx);
        rowObj.height = 20;
        const isZebra = rowNum % 2 === 1;

        headers.forEach((h, colIdx) => {
            const cell = rowObj.getCell(colIdx + 1);
            const val = row[h];

            if (numericCols.has(h) && val !== null && val !== undefined && val !== '') {
                const num = Number(val);
                cell.value = isNaN(num) ? val : num;
                cell.numFmt = Number.isInteger(num) ? '#,##0' : '#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                cell.value = val === null || val === undefined ? '-' : String(val);
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }

            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isZebra ? 'FFF8FAFC' : 'FFFFFFFF' },
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        });

        currentRowIdx++;
    });

    // ── 4. Fila de Totales / Resumen ──────────────────────────────────────────
    if (numericCols.size > 0 && data.length > 1) {
        const totalRow = sheet.getRow(currentRowIdx);
        totalRow.height = 22;
        headers.forEach((h, colIdx) => {
            const cell = totalRow.getCell(colIdx + 1);
            if (colIdx === 0) {
                cell.value = 'TOTALES';
                cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (numericCols.has(h)) {
                const sum = data.reduce((acc, r) => acc + (Number(r[h]) || 0), 0);
                cell.value = sum;
                cell.numFmt = Number.isInteger(sum) ? '#,##0' : '#,##0.00';
                cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                cell.value = '';
            }

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
            };
        });
    }

    // ── 5. Autoajuste de anchos de columna ────────────────────────────────────
    headers.forEach((h, idx) => {
        let maxLen = h.length;
        data.forEach(r => {
            const val = r[h];
            const len = val !== null && val !== undefined ? String(val).length : 0;
            if (len > maxLen) maxLen = len;
        });
        const col = sheet.getColumn(idx + 1);
        col.width = Math.min(Math.max(maxLen + 4, 12), 45);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * Genera un archivo PDF profesional con tabla formateada, encabezados y paginación.
 */
export async function generatePdfReport(data: any[], title = 'Reporte de Gestión'): Promise<Buffer> {
    if (!data || data.length === 0) {
        throw new Error('No hay datos para generar el reporte PDF');
    }

    const headers = Object.keys(data[0]);
    const isLandscape = headers.length > 5;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            layout: isLandscape ? 'landscape' : 'portrait',
            margin: 40,
            bufferPages: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', b => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const pageWidth = isLandscape ? 841.89 : 595.28;
        const pageHeight = isLandscape ? 595.28 : 841.89;
        const contentWidth = pageWidth - 80;

        // Función para dibujar encabezado de página
        const drawHeader = () => {
            doc.save();
            // Barra de color superior
            doc.rect(40, 40, contentWidth, 4).fill('#059669');

            // Logo y nombre de la empresa
            doc.fontSize(16).fillColor('#0F172A').font('Helvetica-Bold').text('ALL MARKET ERP', 40, 52);
            doc.fontSize(10).fillColor('#059669').font('Helvetica-Bold').text(title.toUpperCase(), 40, 72);

            // Metadata derecha
            const dateStr = new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
            doc.fontSize(8).fillColor('#64748B').font('Helvetica')
                .text(`Emisión: ${dateStr}`, 40, 54, { align: 'right', width: contentWidth })
                .text(`Total registros: ${data.length}`, 40, 68, { align: 'right', width: contentWidth });

            doc.moveTo(40, 92).lineTo(40 + contentWidth, 92).strokeColor('#E2E8F0').lineWidth(1).stroke();
            doc.restore();
        };

        drawHeader();

        // Calcular anchos de columna
        const colWidth = contentWidth / headers.length;
        let y = 105;

        // Función para dibujar encabezados de tabla
        const drawTableHeaders = (startY: number) => {
            doc.rect(40, startY, contentWidth, 22).fill('#0F172A');
            headers.forEach((h, i) => {
                const x = 40 + i * colWidth;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
                    .text(h.replace(/_/g, ' ').toUpperCase(), x + 4, startY + 6, {
                        width: colWidth - 8,
                        align: 'left',
                        ellipsis: true,
                    });
            });
            return startY + 22;
        };

        y = drawTableHeaders(y);

        // Filas de datos
        data.forEach((row, rowIdx) => {
            // Chequear si necesitamos salto de página
            if (y + 20 > pageHeight - 50) {
                doc.addPage();
                drawHeader();
                y = drawTableHeaders(105);
            }

            const isZebra = rowIdx % 2 === 1;
            if (isZebra) {
                doc.rect(40, y, contentWidth, 18).fill('#F8FAFC');
            }

            headers.forEach((h, i) => {
                const x = 40 + i * colWidth;
                const rawVal = row[h];
                const isNum = typeof rawVal === 'number';
                const formatted = isNum
                    ? rawVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : (rawVal === null || rawVal === undefined ? '-' : String(rawVal));

                doc.fontSize(8).font('Helvetica').fillColor('#1E293B')
                    .text(formatted, x + 4, y + 4, {
                        width: colWidth - 8,
                        align: isNum ? 'right' : 'left',
                        ellipsis: true,
                    });
            });

            // Línea separadora
            doc.moveTo(40, y + 18).lineTo(40 + contentWidth, y + 18).strokeColor('#F1F5F9').lineWidth(0.5).stroke();
            y += 18;
        });

        // ── Pie de página con numeración ─────────────────────────────────────
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
                .text(
                    `Página ${i + 1} de ${pages.count} · Generado automáticamente por el Asistente IA ALL MARKET`,
                    40,
                    pageHeight - 30,
                    { align: 'center', width: contentWidth }
                );
        }

        doc.end();
    });
}
