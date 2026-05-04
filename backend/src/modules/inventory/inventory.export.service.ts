// =============================================================================
// INVENTORY MODULE — EXPORT SERVICE
// Generación de reportes Excel con alta fidelidad visual
// =============================================================================

import ExcelJS from 'exceljs';
import { prisma } from '../../config/prisma';
import { branchFilter } from '../../core/middlewares/branchFilter.middleware';

interface ExportOptions {
    branchId?: string;
    branchName?: string;
}

/**
 * Obtiene todos los datos necesarios para la exportación
 */
async function getExportData(branchId?: string) {
    const where: any = {};
    if (branchId && branchId !== 'all') {
        where.branchId = branchId;
    }

    const inventory = await prisma.branchInventory.findMany({
        where,
        include: {
            product: {
                include: {
                    subGroup: { include: { group: { select: { name: true } } } },
                    presentations: true,
                    barcodes: { take: 1 }, // Obtener al menos un código de barras
                },
            },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { product: { name: 'asc' } },
    });

    return inventory;
}

/**
 * Calcula el nivel de stock
 */
function getStockLevel(stock: number, min: number): 'normal' | 'warning' | 'critical' {
    if (min === 0) return 'normal';
    if (stock <= min * 0.15) return 'critical';
    if (stock <= min * 0.6) return 'warning';
    return 'normal';
}

/**
 * Genera el reporte completo de inventario en Excel
 */
export async function generateInventoryExcel(options: ExportOptions = {}): Promise<ExcelJS.Buffer> {
    const { branchId, branchName } = options;
    const data = await getExportData(branchId);

    const workbook = new ExcelJS.Workbook();

    // Propiedades del documento
    workbook.creator = 'ERP Market';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Colores corporativos
    const PRIMARY_COLOR = '4F46E5'; // Indigo-600
    const SUCCESS_COLOR = '059669'; // Emerald-600
    const WARNING_COLOR = 'D97706'; // Amber-600
    const DANGER_COLOR = 'DC2626';  // Red-600
    const LIGHT_GRAY = 'F8FAFC';    // Slate-50
    const MEDIUM_GRAY = 'E2E8F0';  // Slate-200

// ─── HOJA 1: DASHBOARD ────────────────────────────────────────────
    const dashboardSheet = workbook.addWorksheet('Dashboard', {
        pageSetup: { paperSize: 9, orientation: 'landscape', margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } }
    });

    // Establecer anchos de columnas para el dashboard
    dashboardSheet.columns = [
        { key: 'a', width: 5 },
        { key: 'b', width: 25 },
        { key: 'c', width: 18 },
        { key: 'd', width: 5 },
        { key: 'e', width: 25 },
        { key: 'f', width: 18 },
        { key: 'g', width: 5 },
        { key: 'h', width: 25 },
        { key: 'i', width: 18 },
    ];

    // Título del dashboard
    dashboardSheet.mergeCells('B1:I1');
    const titleCell = dashboardSheet.getCell('B1');
    titleCell.value = 'DASHBOARD DE INVENTARIO';
    titleCell.font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dashboardSheet.getRow(1).height = 35;

    // Fecha de generación
    dashboardSheet.mergeCells('B2:I2');
    const dateCell = dashboardSheet.getCell('B2');
    dateCell.value = `Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    dateCell.alignment = { horizontal: 'center' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    dashboardSheet.getRow(2).height = 18;

    // Sede info
    const dataStartRow = branchName ? 3 : 2;
    if (branchName) {
        dashboardSheet.mergeCells('B3:I3');
        const branchCell = dashboardSheet.getCell('B3');
        branchCell.value = `Sede: ${branchName}`;
        branchCell.font = { bold: true, size: 12, color: { argb: 'FF334155' } };
        branchCell.alignment = { horizontal: 'center' };
        branchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        dashboardSheet.getRow(3).height = 20;
    }

    // Calcular estadísticas
    const totalProducts = data.length;
    const totalStock = data.reduce((sum, item) => sum + (item.stock ? Number(item.stock) : 0), 0);
    const totalValue = data.reduce((sum, item) => sum + ((item.stock ? Number(item.stock) : 0) * (item.product.cost ? Number(item.product.cost) : 0)), 0);
    const totalSaleValue = data.reduce((sum, item) => sum + ((item.stock ? Number(item.stock) : 0) * (item.product.price ? Number(item.product.price) : 0)), 0);

    const criticalItems = data.filter(item => getStockLevel(item.stock ? Number(item.stock) : 0, item.minStock ? Number(item.minStock) : 0) === 'critical');
    const warningItems = data.filter(item => getStockLevel(item.stock ? Number(item.stock) : 0, item.minStock ? Number(item.minStock) : 0) === 'warning');
    const normalItems = data.filter(item => getStockLevel(item.stock ? Number(item.stock) : 0, item.minStock ? Number(item.minStock) : 0) === 'normal');

    const totalCategories = new Set(data.map(item => item.product.subGroup?.group?.name || 'Sin categoría')).size;

    // ─── SECCIÓN: MÉTRICAS PRINCIPALES ──────────────────────────────────
    const metricsHeaderRow = dataStartRow + 1;
    dashboardSheet.mergeCells(`B${metricsHeaderRow}:I${metricsHeaderRow}`);
    const metricsHeader = dashboardSheet.getCell(`B${metricsHeaderRow}`);
    metricsHeader.value = 'MÉTRICAS PRINCIPALES';
    metricsHeader.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    metricsHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    dashboardSheet.getRow(metricsHeaderRow).height = 25;

    // Primera fila de métricas (4 métricas)
    const m1Row = metricsHeaderRow + 1;
    const metricConfigs = [
        { label: 'Total Productos', value: totalProducts, fmt: '#,##0' },
        { label: 'Stock Total', value: totalStock, fmt: '#,##0.00' },
        { label: 'Valor Inventario (Costo)', value: totalValue, fmt: '$#,##0.00' },
        { label: 'Valor Inventario (Venta)', value: totalSaleValue, fmt: '$#,##0.00' },
        { label: 'Alertas Críticas', value: criticalItems.length, fmt: '#,##0' },
        { label: 'Alertas Medias', value: warningItems.length, fmt: '#,##0' },
        { label: 'Categorías', value: totalCategories, fmt: '#,##0' },
        { label: 'Productos OK', value: normalItems.length, fmt: '#,##0' },
    ];

    // Primera fila (columnas B-C, E-F, H-I)
    const firstRowMetrics = [0, 1, 2, 3];
    firstRowMetrics.forEach((idx) => {
        const config = metricConfigs[idx];
        const col = idx < 2 ? 'B' : idx < 4 ? 'E' : 'H';
        const labelCell = dashboardSheet.getCell(`${col}${m1Row}`);
        labelCell.value = config.label;
        labelCell.font = { bold: true, size: 11, color: { argb: 'FF334155' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        labelCell.alignment = { horizontal: 'left' };
        labelCell.border = { right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
        const valCell = dashboardSheet.getCell(`${valCol}${m1Row}`);
        valCell.value = config.value;
        valCell.font = { bold: true, size: 14, color: { argb: idx < 2 ? 'FF4F46E5' : idx < 4 ? 'FF059669' : 'FF7C3AED' } };
        valCell.numFmt = config.fmt;
        valCell.alignment = { horizontal: 'right' };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    });

    // Segunda fila de métricas
    const m2Row = m1Row + 1;
    const secondRowMetrics = [4, 5, 6, 7];
    secondRowMetrics.forEach((idx) => {
        const config = metricConfigs[idx];
        const col = idx < 6 ? 'B' : idx < 8 ? 'E' : 'H';
        const labelCell = dashboardSheet.getCell(`${col}${m2Row}`);
        labelCell.value = config.label;
        labelCell.font = { bold: true, size: 11, color: { argb: 'FF334155' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        labelCell.alignment = { horizontal: 'left' };
        labelCell.border = { right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
        const valCell = dashboardSheet.getCell(`${valCol}${m2Row}`);
        valCell.value = config.value;
        valCell.font = { bold: true, size: 14, color: { argb: idx === 4 ? 'FFDC2626' : idx === 5 ? 'FFD97706' : 'FF0891B2' } };
        valCell.numFmt = config.fmt;
        valCell.alignment = { horizontal: 'right' };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    });

    dashboardSheet.getRow(m1Row).height = 22;
    dashboardSheet.getRow(m2Row).height = 22;

    // ─── SECCIÓN: RESUMEN POR ESTADO ──────────────────────────────────
    const statusHeaderRow = m2Row + 2;
    dashboardSheet.mergeCells(`B${statusHeaderRow}:I${statusHeaderRow}`);
    const statusHeader = dashboardSheet.getCell(`B${statusHeaderRow}`);
    statusHeader.value = 'RESUMEN POR ESTADO DE STOCK';
    statusHeader.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    statusHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    statusHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    dashboardSheet.getRow(statusHeaderRow).height = 25;

    // Tabla de estados
    const statusRow = statusHeaderRow + 1;
    const statusHeaders = ['Estado', 'Cantidad', '% del Total', 'Valor Costo', 'Valor Venta'];

    // Headers de estado
    const h1 = dashboardSheet.getCell('B' + String(statusRow));
    h1.value = statusHeaders[0];
    h1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    h1.alignment = { horizontal: 'center' };

    const h2 = dashboardSheet.getCell('C' + String(statusRow));
    h2.value = statusHeaders[1];
    h2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    h2.alignment = { horizontal: 'center' };

    const h3 = dashboardSheet.getCell('D' + String(statusRow));
    h3.value = statusHeaders[2];
    h3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    h3.alignment = { horizontal: 'center' };

    const h4 = dashboardSheet.getCell('E' + String(statusRow));
    h4.value = statusHeaders[3];
    h4.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    h4.alignment = { horizontal: 'center' };

    const h5 = dashboardSheet.getCell('F' + String(statusRow));
    h5.value = statusHeaders[4];
    h5.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    h5.alignment = { horizontal: 'center' };

    dashboardSheet.getRow(statusRow).height = 20;

    const statusData = [
        { estado: 'Normal', items: normalItems, color: SUCCESS_COLOR },
        { estado: 'Alerta', items: warningItems, color: WARNING_COLOR },
        { estado: 'Crítico', items: criticalItems, color: DANGER_COLOR },
    ];

    statusData.forEach((item, idx) => {
        const rowNum = statusRow + 1 + idx;
        const cantidad = item.items.length;
        const pct = totalProducts > 0 ? cantidad / totalProducts : 0;
        const costo = item.items.reduce((s, i) => s + ((i.stock ? Number(i.stock) : 0) * (i.product.cost ? Number(i.product.cost) : 0)), 0);
        const venta = item.items.reduce((s, i) => s + ((i.stock ? Number(i.stock) : 0) * (i.product.price ? Number(i.product.price) : 0)), 0);

        // Fila: Estado
        const c1 = dashboardSheet.getCell('B' + String(rowNum));
        c1.value = item.estado;
        c1.font = { bold: true, color: { argb: 'FF' + item.color } };
        c1.alignment = { horizontal: 'left' };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        // Fila: Cantidad
        const c2 = dashboardSheet.getCell('C' + String(rowNum));
        c2.value = cantidad;
        c2.numFmt = '#,##0';
        c2.font = { color: { argb: 'FF' + item.color } };
        c2.alignment = { horizontal: 'right' };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        // Fila: %
        const c3 = dashboardSheet.getCell('D' + String(rowNum));
        c3.value = pct;
        c3.numFmt = '0.00%';
        c3.font = { color: { argb: 'FF' + item.color } };
        c3.alignment = { horizontal: 'right' };
        c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        // Fila: Valor Costo
        const c4 = dashboardSheet.getCell('E' + String(rowNum));
        c4.value = costo;
        c4.numFmt = '$#,##0.00';
        c4.font = { color: { argb: 'FF' + item.color } };
        c4.alignment = { horizontal: 'right' };
        c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        // Fila: Valor Venta
        const c5 = dashboardSheet.getCell('F' + String(rowNum));
        c5.value = venta;
        c5.numFmt = '$#,##0.00';
        c5.font = { color: { argb: 'FF' + item.color } };
        c5.alignment = { horizontal: 'right' };
        c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        dashboardSheet.getRow(rowNum).height = 18;
    });

    // ─── HOJA 2: INVENTARIO COMPLETO ──────────────────────────────────
    const inventorySheet = workbook.addWorksheet('Inventario Completo', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    // Encabezados
    const invHeaders = [
        'Código', 'Producto', 'Categoría', 'Grupo', 'P. Costo', 'P. Venta',
        'Stock', 'Stock Mín.', 'Unidad', 'Estado', 'Sede', 'Valor Costo', 'Valor Venta'
    ];

    const invHeaderRow = inventorySheet.getRow(1);
    invHeaders.forEach((h, i) => {
        const cell = invHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF4F46E5' } },
            left: { style: 'thin', color: { argb: 'FF6366F1' } },
            bottom: { style: 'medium', color: { argb: 'FF4F46E5' } },
            right: { style: 'thin', color: { argb: 'FF6366F1' } }
        };
    });
    invHeaderRow.height = 22;

    // Datos
    data.forEach((item, idx) => {
        const row = inventorySheet.getRow(idx + 2);
        const stock = item.stock ? Number(item.stock) : 0;
        const minStock = item.minStock ? Number(item.minStock) : 0;
        const cost = item.product.cost ? Number(item.product.cost) : 0;
        const price = item.product.price ? Number(item.product.price) : 0;
        const level = getStockLevel(stock, minStock);
        const isEven = idx % 2 === 0;

        // Obtener código de barras (nuevo sistema: barcodes relation, fallback: campo viejo)
        const barcode = item.product.barcodes?.[0]?.code || item.product.barcode || 'Sin código';

        const rowData = [
            barcode,
            item.product.name,
            item.product.subGroup?.group?.name || 'Sin categoría',
            item.product.subGroup?.name || 'Sin grupo',
            cost,
            price,
            stock,
            minStock,
            item.product.baseUnit || 'UNIDAD',
            level === 'critical' ? 'Crítico' : level === 'warning' ? 'Alerta' : 'Normal',
            item.branch.name,
            stock * cost,
            stock * price,
        ];

        rowData.forEach((val, i) => {
            const cell = row.getCell(i + 1);
            cell.value = val;

            // Formatos específicos
            if (i === 4 || i === 5) { // Costo y Venta
                cell.numFmt = '$#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else if (i === 6 || i === 7) { // Stock y Mín
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else if (i === 11 || i === 12) { // Valor Costo y Venta
                cell.numFmt = '$#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else {
                cell.alignment = { horizontal: i <= 1 ? 'left' : 'center' };
            }

            // Colores de estado
            if (i === 9) { // Estado
                if (level === 'critical') {
                    cell.font = { bold: true, color: { argb: 'FFDC2626' } };
                } else if (level === 'warning') {
                    cell.font = { bold: true, color: { argb: 'FFD97706' } };
                } else {
                    cell.font = { color: { argb: 'FF059669' } };
                }
            }

            // Zebra striping
            const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

            // Bordes
            cell.border = {
                top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                right: { style: 'hair', color: { argb: 'FFE2E8F0' } }
            };
        });

        row.height = 16;
    });

    // Auto-fit columns with appropriate minimum widths
    const minWidths = [12, 35, 18, 18, 14, 14, 12, 12, 10, 12, 18, 16, 16]; // anchos mínimos por columna
    inventorySheet.columns.forEach((column, index) => {
        if (!column || !column.eachCell) return;
        const headerLength = invHeaders[index]?.length || 10;
        let maxLength = headerLength;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if (cell.value) {
                // Para monedas, sumar el ancho del símbolo y separadores
                const cellValue = typeof cell.value === 'number' ? `$${cell.value.toLocaleString('en-US')}` : String(cell.value);
                const length = cellValue.length;
                if (length > maxLength) maxLength = length;
            }
        });
        const calculatedWidth = maxLength + 2;
        const minWidth = minWidths[index] || 10;
        column.width = Math.min(Math.max(calculatedWidth, minWidth), 50);
    });

    // ─── HOJA 3: ALERTAS DE STOCK ────────────────────────────────────
    const alertsSheet = workbook.addWorksheet('Alertas Stock', {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    const alertData = data.filter(item => {
        const level = getStockLevel(Number(item.stock), Number(item.minStock));
        return level === 'critical' || level === 'warning';
    });

    // Encabezados alertas
    const alertHeaders = [
        'Código', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mín.', 'Estado',
        'P. Costo', 'P. Venta', 'Diferencia', 'Sede', 'Valor en Riesgo'
    ];

    const alertHeaderRow = alertsSheet.getRow(1);
    alertHeaders.forEach((h, i) => {
        const cell = alertHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
    });
    alertHeaderRow.height = 22;

    // Datos de alertas
    alertData.forEach((item, idx) => {
        const row = alertsSheet.getRow(idx + 2);
        const stock = item.stock ? Number(item.stock) : 0;
        const minStock = item.minStock ? Number(item.minStock) : 0;
        const cost = item.product.cost ? Number(item.product.cost) : 0;
        const price = item.product.price ? Number(item.product.price) : 0;
        const level = getStockLevel(stock, minStock);
        const diff = stock - minStock;
        const isEven = idx % 2 === 0;

        // Obtener código de barras
        const barcode = item.product.barcodes?.[0]?.code || item.product.barcode || 'Sin código';

        const rowData = [
            barcode,
            item.product.name,
            item.product.subGroup?.group?.name || 'Sin categoría',
            stock,
            minStock,
            level === 'critical' ? 'Crítico' : 'Alerta',
            cost,
            price,
            diff,
            item.branch.name,
            diff * cost,
        ];

        rowData.forEach((val, i) => {
            const cell = row.getCell(i + 1);
            cell.value = val;

            if (i === 3 || i === 4 || i === 8) {
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else if (i === 6 || i === 7 || i === 10) {
                cell.numFmt = '$#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else {
                cell.alignment = { horizontal: i <= 1 ? 'left' : 'center' };
            }

            if (i === 5) { // Estado
                cell.font = { bold: true, color: { argb: level === 'critical' ? 'FFDC2626' : 'FFD97706' } };
            }

            // Zebra striping
            const bgColor = isEven ? 'FFFFFFFF' : 'FFFEF2F2';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

            cell.border = {
                top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                right: { style: 'hair', color: { argb: 'FFE2E8F0' } }
            };
        });

        row.height = 16;
    });

    // Auto-fit columns for alerts with appropriate minimum widths
    const alertMinWidths = [12, 35, 18, 12, 12, 12, 14, 14, 12, 18, 16]; // anchos mínimos por columna
    alertsSheet.columns.forEach((column, index) => {
        if (!column || !column.eachCell) return;
        const headerLength = alertHeaders[index]?.length || 10;
        let maxLength = headerLength;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if (cell.value) {
                const cellValue = typeof cell.value === 'number' ? `$${cell.value.toLocaleString('en-US')}` : String(cell.value);
                const length = cellValue.length;
                if (length > maxLength) maxLength = length;
            }
        });
        const calculatedWidth = maxLength + 2;
        const minWidth = alertMinWidths[index] || 10;
        column.width = Math.min(Math.max(calculatedWidth, minWidth), 50);
    });

    // Agregar resumen al final de alertas
    if (alertData.length > 0) {
        const summaryRow = alertsSheet.getRow(alertData.length + 3);
        summaryRow.getCell(1).value = 'TOTAL ALERTAS:';
        summaryRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } };
        summaryRow.getCell(2).value = alertData.length;
        summaryRow.getCell(2).font = { bold: true, size: 12 };
    }

    return workbook.xlsx.writeBuffer();
}
