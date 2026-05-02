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

    // Título del dashboard
    dashboardSheet.mergeCells('A1:H1');
    const titleCell = dashboardSheet.getCell('A1');
    titleCell.value = 'DASHBOARD DE INVENTARIO';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
        top: { style: 'thin', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FF4F46E5' } },
        bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
        right: { style: 'thin', color: { argb: 'FF4F46E5' } }
    };
    dashboardSheet.getRow(1).height = 35;

    // Fecha de generación
    dashboardSheet.mergeCells('A2:H2');
    const dateCell = dashboardSheet.getCell('A2');
    dateCell.value = `Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    dateCell.alignment = { horizontal: 'center' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    // Sede info
    if (branchName) {
        dashboardSheet.mergeCells('A3:H3');
        const branchCell = dashboardSheet.getCell('A3');
        branchCell.value = `Sede: ${branchName}`;
        branchCell.font = { bold: true, size: 12, color: { argb: 'FF334155' } };
        branchCell.alignment = { horizontal: 'center' };
        branchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        dashboardSheet.getRow(3).height = 20;
    }

    // Calcular estadísticas
    const totalProducts = data.length;
    const totalStock = data.reduce((sum, item) => sum + Number(item.stock), 0);
    const totalValue = data.reduce((sum, item) => sum + (Number(item.stock) * Number(item.product.cost || 0)), 0);
    const totalSaleValue = data.reduce((sum, item) => sum + (Number(item.stock) * Number(item.product.price || 0)), 0);

    const criticalItems = data.filter(item => getStockLevel(Number(item.stock), Number(item.minStock)) === 'critical');
    const warningItems = data.filter(item => getStockLevel(Number(item.stock), Number(item.minStock)) === 'warning');
    const normalItems = data.filter(item => getStockLevel(Number(item.stock), Number(item.minStock)) === 'normal');

    const totalCategories = new Set(data.map(item => item.product.subGroup?.group?.name || 'Sin categoría')).size;
    const totalBranches = new Set(data.map(item => item.branchId)).size;

    // Métricas principales
    const metricsStartRow = branchName ? 5 : 4;
    const metrics = [
        { label: 'Total Productos', value: totalProducts, color: PRIMARY_COLOR },
        { label: 'Stock Total', value: totalStock, color: '2563EB' },
        { label: 'Valor Inventario (Costo)', value: `$${totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, color: SUCCESS_COLOR },
        { label: 'Valor Inventario (Venta)', value: `$${totalSaleValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, color: '7C3AED' },
        { label: 'Alertas Críticas', value: criticalItems.length, color: DANGER_COLOR },
        { label: 'Alertas Medias', value: warningItems.length, color: WARNING_COLOR },
        { label: 'Categorías', value: totalCategories, color: '0891B2' },
        { label: 'Sedes', value: totalBranches, color: 'B45309' },
    ];

    // Headers métricas
    const headerRow = dashboardSheet.getRow(metricsStartRow);
    headerRow.values = ['Métrica', 'Valor', '', 'Métrica', 'Valor', '', 'Métrica', 'Valor'];
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Datos métricas (3 columnas de 2 métricas cada una)
    for (let i = 0; i < 8; i++) {
        const row = dashboardSheet.getRow(metricsStartRow + 1 + Math.floor(i / 3));
        const col = (i % 3) * 3 + 1;
        row.getCell(col).value = metrics[i].label;
        row.getCell(col).font = { bold: true, size: 10, color: { argb: 'FF334155' } };
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        row.getCell(col).border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        const valueCell = row.getCell(col + 1);
        valueCell.value = metrics[i].value;
        valueCell.font = { bold: true, size: 12, color: { argb: `FF${metrics[i].color}` } };
        valueCell.alignment = { horizontal: 'right' };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        valueCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        // Merge label + value with empty cell
        dashboardSheet.mergeCells(row.number, col, row.number, col + 1);
        if (col + 2 <= 8) {
            dashboardSheet.mergeCells(row.number, col + 2, row.number, col + 2);
        }
    }

    // Anchos de columna para dashboard
    dashboardSheet.columns = [
        { key: 'a', width: 20 },
        { key: 'b', width: 20 },
        { key: 'c', width: 2 },
        { key: 'd', width: 20 },
        { key: 'e', width: 20 },
        { key: 'f', width: 2 },
        { key: 'g', width: 20 },
        { key: 'h', width: 20 },
    ];

    // Gráfico de estado (tabla resumen)
    const chartRow = metricsStartRow + 4;
    dashboardSheet.mergeCells(`A${chartRow}:H${chartRow}`);
    const chartTitle = dashboardSheet.getCell(`A${chartRow}`);
    chartTitle.value = 'RESUMEN POR ESTADO DE STOCK';
    chartTitle.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    chartTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    chartTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    chartTitle.border = { top: { style: 'medium', color: { argb: 'FF94A3B8' } }, left: { style: 'medium', color: { argb: 'FF94A3B8' } }, bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }, right: { style: 'medium', color: { argb: 'FF94A3B8' } } };
    dashboardSheet.getRow(chartRow).height = 25;

    // Tabla de estados
    const statusHeaders = ['Estado', 'Cantidad', '% del Total', 'Valor Costo', 'Valor Venta'];
    const statusRow = dashboardSheet.getRow(chartRow + 1);
    statusHeaders.forEach((h, i) => {
        const cell = statusRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const statusData = [
        { estado: 'Normal', cantidad: normalItems.length, color: SUCCESS_COLOR },
        { estado: 'Alerta', cantidad: warningItems.length, color: WARNING_COLOR },
        { estado: 'Crítico', cantidad: criticalItems.length, color: DANGER_COLOR },
    ];

    statusData.forEach((item, idx) => {
        const row = dashboardSheet.getRow(chartRow + 2 + idx);
        row.getCell(1).value = item.estado;
        row.getCell(1).font = { bold: true, color: { argb: `FF${item.color}` } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

        row.getCell(2).value = item.cantidad;
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(2).numFmt = '#,##0';

        row.getCell(3).value = totalProducts > 0 ? (item.cantidad / totalProducts) : 0;
        row.getCell(3).numFmt = '0.00%';

        const costo = item.estado === 'Normal'
            ? normalItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.cost || 0), 0)
            : item.estado === 'Alerta'
                ? warningItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.cost || 0), 0)
                : criticalItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.cost || 0), 0);
        row.getCell(4).value = costo;
        row.getCell(4).numFmt = '$#,##0.00';

        const venta = item.estado === 'Normal'
            ? normalItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.price || 0), 0)
            : item.estado === 'Alerta'
                ? warningItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.price || 0), 0)
                : criticalItems.reduce((s, i) => s + Number(i.stock) * Number(i.product.price || 0), 0);
        row.getCell(5).value = venta;
        row.getCell(5).numFmt = '$#,##0.00';

        // Apply borders
        [1, 2, 3, 4, 5].forEach(col => {
            const cell = row.getCell(col);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });

        row.height = 18;
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
        const stock = Number(item.stock);
        const minStock = Number(item.minStock);
        const cost = Number(item.product.cost || 0);
        const price = Number(item.product.price || 0);
        const level = getStockLevel(stock, minStock);
        const isEven = idx % 2 === 0;

        const rowData = [
            item.product.barcode || 'N/A',
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

    // Auto-fit columns
    inventorySheet.columns.forEach((column, index) => {
        if (!column || !column.eachCell) return;
        let maxLength = invHeaders[index]?.length || 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if (cell.value) {
                const length = String(cell.value).length;
                if (length > maxLength) maxLength = length;
            }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 30);
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
        const stock = Number(item.stock);
        const minStock = Number(item.minStock);
        const cost = Number(item.product.cost || 0);
        const price = Number(item.product.price || 0);
        const level = getStockLevel(stock, minStock);
        const diff = stock - minStock;
        const isEven = idx % 2 === 0;

        const rowData = [
            item.product.barcode || 'N/A',
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

    // Auto-fit columns for alerts
    alertsSheet.columns.forEach((column, index) => {
        if (!column || !column.eachCell) return;
        let maxLength = alertHeaders[index]?.length || 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if (cell.value) {
                const length = String(cell.value).length;
                if (length > maxLength) maxLength = length;
            }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 30);
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
