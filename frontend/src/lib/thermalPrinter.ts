// =============================================================================
// THERMAL PRINTER — ESC/POS via Web Serial API (como ZeuFood Backoffice)
//
// 3 capas:
//   1. Motor de recibos (modelo de líneas)
//   2. Codificador ESC/POS + code page (sin acentos UTF-8)
//   3. Transporte Web Serial (navigator.serial)
// =============================================================================

import { ThermalPrinterConfig } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

// ── Code Page: Unicode → ASCII para impresoras térmicas ──────────────────────
// Las impresoras NO entienden UTF-8. Los acentos se tratan como ASCII plano.
const CP_BASE: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u', 'ç': 'c',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U', 'Ç': 'C',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U', 'â': 'a', 'ê': 'e', 'î': 'i',
    'ô': 'o', 'û': 'u', 'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
    'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O',
    '¿': '?', '¡': '!', 'º': '.', 'ª': '.', '°': '.', '€': 'EUR', '·': '-', '•': '-',
};

function cpBytes(str: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) { out.push(code); continue; }
        const ch = str.charAt(i);
        const base = CP_BASE[ch];
        if (base) {
            for (let j = 0; j < base.length; j++) out.push(base.charCodeAt(j));
            continue;
        }
        out.push(0x3F); // '?'
    }
    return out;
}

// ── Configuración de impresora ──────────────────────────────────────────────
function getPrinterProfile(printer: ThermalPrinterConfig | null) {
    const width = printer?.paperWidth || '80mm';
    const chars = width === '58mm' ? 32 : 48;
    const baudRate = (printer as any)?.baudRate || 9600;
    const codePage = 2; // PC850 (acentos latinos)
    const cut = printer?.autoCut !== false;
    return { width, chars, baudRate, codePage, cut };
}

// ── Capa 1: Utilidades de formato de líneas ─────────────────────────────────
function padRight(s: string, chars: number) {
    s = String(s);
    return s.length >= chars ? s.slice(0, chars) : s + ' '.repeat(chars - s.length);
}

function padLeft(s: string, chars: number) {
    s = String(s);
    return s.length >= chars ? s.slice(0, chars) : ' '.repeat(chars - s.length) + s;
}

function center(s: string, chars: number) {
    s = String(s);
    const pad = Math.max(0, chars - s.length);
    return ' '.repeat(Math.floor(pad / 2)) + s.slice(0, chars - pad) + ' '.repeat(pad - Math.floor(pad / 2));
}

function truncate(s: string, chars: number) {
    s = String(s);
    return s.length > chars ? s.slice(0, chars) : s;
}

function wrapText(s: string, chars: number, indent = 0): string[] {
    s = String(s || '');
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    const max = chars - indent;
    words.forEach(w => {
        const candidate = cur ? cur + ' ' + w : w;
        if (candidate.length > max && cur) {
            lines.push(cur);
            cur = w;
        } else {
            cur = candidate;
        }
    });
    if (cur) lines.push(cur);
    if (lines.length === 0) lines.push('');
    return lines.map(l => ' '.repeat(indent) + l);
}

function totalLine(label: string, amount: string, chars: number) {
    return truncate(label, chars) + ' '.repeat(Math.max(1, chars - label.length - amount.length)) + amount;
}

// ── Capa 2: Codificador ESC/POS ─────────────────────────────────────────────
function encodeReceipt(lines: Array<{ t: string; a?: number; b?: boolean }>, profile: ReturnType<typeof getPrinterProfile>): Uint8Array {
    const bytes: number[] = [0x1B, 0x40]; // ESC @ init
    bytes.push(0x1B, 0x74, profile.codePage); // ESC t n (code page)

    for (const ln of lines) {
        bytes.push(0x1B, 0x61, ln.a || 0); // ESC a n (alineación)
        if (ln.b) bytes.push(0x1B, 0x45, 1); // ESC E 1 (negrita on)
        cpBytes(ln.t).forEach(b => bytes.push(b));
        bytes.push(0x0A); // \n
        if (ln.b) bytes.push(0x1B, 0x45, 0); // ESC E 0 (negrita off)
    }

    bytes.push(0x1B, 0x64, 4); // ESC d 4 (feed)
    if (profile.cut) {
        bytes.push(0x1D, 0x56, 0x00); // GS V 0 (corte completo)
    } else {
        bytes.push(0x1D, 0x56, 0x41); // GS V A (corte parcial)
    }

    return new Uint8Array(bytes);
}

// ── Capa 3: Transporte Web Serial ───────────────────────────────────────────
// Escribe por chunks con pausa: impresoras baratas tienen buffer chico
async function writeChunks(writer: WritableStreamDefaultWriter<Uint8Array>, data: Uint8Array, chunkSize = 64) {
    for (let i = 0; i < data.length; i += chunkSize) {
        await writer.write(data.slice(i, i + chunkSize));
        await new Promise(r => setTimeout(r, 60)); // Pausa entre chunks
    }
}

async function openSerialPort(baudRate: number): Promise<SerialPort> {
    if (!('serial' in navigator)) {
        throw new Error('Web Serial no está soportado en este navegador. Usa Chrome o Edge con HTTPS.');
    }

    const port = await (navigator as any).serial.requestPort();

    // Reintentar apertura (algunos drivers necesitan un momento)
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await port.open({ baudRate });
            return port;
        } catch (e) {
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 500));
            } else {
                throw e;
            }
        }
    }

    throw new Error('No se pudo abrir el puerto serial después de 3 intentos.');
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface TicketPrintData {
    invoiceNumber: string;
    date?: string;
    cashierName?: string;
    customerName?: string;
    customerTaxId?: string;
    customerPhone?: string;
    businessName?: string;
    taxId?: string;
    fiscalAddress?: string;
    fiscalPhone?: string;
    items: Array<{
        name: string;
        qty: number;
        unitPrice?: number;
        total: number;
    }>;
    totalUSD: number;
    totalVES?: number;
    totalCOP?: number;
    paymentMethods?: Array<{
        type: string;
        amount: number;
        currency: string;
    }>;
    changeUSD?: number;
    footerMessage?: string;
}

// ── Utilidad: convertir TicketPrintData a líneas de recibo ──────────────────
function ticketToLines(data: TicketPrintData, profile: ReturnType<typeof getPrinterProfile>): Array<{ t: string; a?: number; b?: boolean }> {
    const L: Array<{ t: string; a?: number; b?: boolean }> = [];
    const LINE = '-'.repeat(profile.chars);

    // 1. ENCABEZADO
    if (data.businessName) wrapText(data.businessName, profile.chars).forEach(l => L.push({ t: l, a: 1, b: true }));
    if (data.taxId) L.push({ t: `RIF: ${data.taxId}`, a: 1 });
    if (data.fiscalAddress) wrapText(data.fiscalAddress, profile.chars).forEach(l => L.push({ t: l, a: 1 }));
    if (data.fiscalPhone) L.push({ t: `Tel: ${data.fiscalPhone}`, a: 1 });
    L.push({ t: LINE });

    // 2. METADATOS
    L.push({ t: totalLine('FACTURA', data.invoiceNumber || 'FACT-000000', profile.chars) });
    L.push({ t: `FECHA: ${data.date || new Date().toLocaleDateString('es-VE')}` });
    if (data.cashierName) L.push({ t: `CAJERO: ${data.cashierName}` });
    L.push({ t: LINE });

    // 3. CLIENTE
    if (data.customerName) {
        L.push({ t: `Cliente: ${data.customerName}` });
        if (data.customerTaxId) L.push({ t: `C.I./RIF: ${data.customerTaxId}` });
        if (data.customerPhone) L.push({ t: `Tel: ${data.customerPhone}` });
        L.push({ t: LINE });
    }

    // 4. TABLA DE PRODUCTOS
    L.push({ t: padRight('Concepto', profile.chars - 13) + padLeft('Cant', 5) + padLeft('Importe', 8), b: true });

    for (const item of data.items) {
        const unitPrice = item.unitPrice || (item.qty ? item.total / item.qty : item.total);
        const priceStr = `$${item.total.toFixed(2)}`;
        const head = `${item.qty}x ${item.name}`;
        const avail = profile.chars - priceStr.length;

        if (head.length > avail) {
            const wrapped = wrapText(head, profile.chars);
            wrapped[0] = wrapped[0].slice(0, avail) + ' '.repeat(Math.max(1, profile.chars - wrapped[0].length - priceStr.length)) + priceStr;
            wrapped.forEach(l => L.push({ t: l }));
        } else {
            L.push({ t: head + ' '.repeat(profile.chars - head.length - priceStr.length) + priceStr });
        }
    }

    L.push({ t: LINE });

    // 5. TOTALES
    const gravable = data.totalUSD / 1.16;
    const iva = data.totalUSD - gravable;
    L.push({ t: totalLine('BASE IMPONIBLE (G 16%):', `$${gravable.toFixed(2)}`, profile.chars) });
    L.push({ t: totalLine('IVA (16.00%):', `$${iva.toFixed(2)}`, profile.chars) });
    L.push({ t: LINE });
    L.push({ t: totalLine('TOTAL USD:', `$${data.totalUSD.toFixed(2)}`, profile.chars), b: true });
    if (data.totalVES) L.push({ t: totalLine('TOTAL VES:', `Bs. ${data.totalVES.toFixed(2)}`, profile.chars) });
    if (data.totalCOP) L.push({ t: totalLine('TOTAL COP:', `$${data.totalCOP.toLocaleString('es-CO')}`, profile.chars) });

    // 6. PAGO
    if (data.paymentMethods?.length) {
        L.push({ t: LINE });
        L.push({ t: 'FORMAS DE PAGO:' });
        for (const m of data.paymentMethods) {
            const val = m.currency === 'VES' ? `Bs. ${m.amount.toFixed(2)}` : `$${m.amount.toFixed(2)}`;
            L.push({ t: totalLine(`- ${m.type.toUpperCase()} (${m.currency}):`, val, profile.chars) });
        }
        if (data.changeUSD && data.changeUSD > 0) {
            L.push({ t: totalLine('- CAMBIO USD:', `$${data.changeUSD.toFixed(2)}`, profile.chars) });
        }
    }

    L.push({ t: LINE });
    L.push({ t: data.footerMessage || '¡Gracias por su compra! Vuelva pronto', a: 1, b: true });

    return L;
}

// ── Funciones públicas ──────────────────────────────────────────────────────

export async function printThermalReceiptReal(
    printer: ThermalPrinterConfig | null,
    data: TicketPrintData
): Promise<{ success: boolean; method: 'serial' | 'browser' | 'none'; message: string }> {
    const profile = getPrinterProfile(printer);

    // 1. Impresión por Web Serial (ESC/POS)
    if (printer?.connectionType === 'thermal_usb') {
        try {
            const port = await openSerialPort(profile.baudRate);
            try {
                const writer = port.writable.getWriter();
                const lines = ticketToLines(data, profile);
                const payload = encodeReceipt(lines, profile);
                await writeChunks(writer, payload, 64);
                writer.releaseLock();
                return {
                    success: true,
                    method: 'serial',
                    message: `Factura enviada a ${printer.name} por puerto serial.`
                };
            } finally {
                await port.close().catch(() => {});
            }
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            if (errMsg.includes('cancelled') || errMsg.includes('NotFoundError')) {
                return { success: false, method: 'none', message: 'Selección de puerto cancelada.' };
            }
            toast.error(`Error de impresión: ${errMsg}`);
            return { success: false, method: 'none', message: errMsg };
        }
    }

    // 2. Impresión por navegador
    if (printer?.connectionType === 'browser') {
        window.print();
        return { success: true, method: 'browser', message: `Imprimiendo en navegador para ${printer.name}` };
    }

    // 3. Sin impresora
    return { success: true, method: 'none', message: 'Venta completada sin impresora configurada.' };
}

// ── Reportes X/Z ────────────────────────────────────────────────────────────
import { ReportAuditData } from '@/components/common/ThermalAuditTicket';
export type { ReportAuditData };

function auditToLines(data: ReportAuditData, profile: ReturnType<typeof getPrinterProfile>): Array<{ t: string; a?: number; b?: boolean }> {
    const L: Array<{ t: string; a?: number; b?: boolean }> = [];
    const LINE = '-'.repeat(profile.chars);
    const isZ = data.type === 'Z';
    const fmtNum = (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d?: string | Date | null) => d ? new Date(d).toLocaleString('es-VE') : '-';

    // Header
    if (data.businessName) wrapText(data.businessName, profile.chars).forEach(l => L.push({ t: l, a: 1, b: true }));
    if (data.taxId) L.push({ t: `RIF: ${data.taxId}`, a: 1 });
    L.push({ t: `${data.branch?.name ? `SEDE: ${data.branch.name}` : 'SEDE PRINCIPAL'}`, a: 1 });
    L.push({ t: LINE });
    L.push({ t: isZ ? '--- REPORTE Z (CIERRE) ---' : '--- REPORTE X (PARCIAL) ---', a: 1, b: true });
    L.push({ t: LINE });

    // Caja
    L.push({ t: totalLine('CAJA ID:', data.registerId.slice(-8).toUpperCase(), profile.chars) });
    L.push({ t: totalLine('CAJERO:', data.user?.nombre || data.user?.username || 'SISTEMA', profile.chars) });
    L.push({ t: totalLine('APERTURA:', fmtDate(data.openedAt), profile.chars) });
    if (isZ) L.push({ t: totalLine('CIERRE:', fmtDate(data.closedAt || new Date()), profile.chars) });
    L.push({ t: LINE });

    // Ventas
    L.push({ t: 'DESGLOSE DE VENTAS:', b: true });
    L.push({ t: totalLine('Nº TRANSACCIONES:', String(data.transactionCount), profile.chars) });
    L.push({ t: totalLine('TOTAL VENTAS:', `$ ${fmtNum(data.salesTotal)}`, profile.chars) });
    L.push({ t: LINE });

    // Pagos
    L.push({ t: 'FORMAS DE PAGO:', b: true });
    L.push({ t: totalLine('- EFECTIVO COP:', `$ ${fmtNum(data.paymentBreakdown.efectivoCOP)}`, profile.chars) });
    L.push({ t: totalLine('- EFECTIVO USD:', `$ ${fmtNum(data.paymentBreakdown.efectivoUSD)}`, profile.chars) });
    L.push({ t: totalLine('- EFECTIVO VES:', `Bs. ${fmtNum(data.paymentBreakdown.efectivoVES)}`, profile.chars) });
    L.push({ t: totalLine('- TRANSFERENCIA:', `$ ${fmtNum(data.paymentBreakdown.transferencia)}`, profile.chars) });
    L.push({ t: totalLine('- TARJETA:', `$ ${fmtNum(data.paymentBreakdown.tarjeta)}`, profile.chars) });
    if (data.paymentBreakdown.otros > 0) L.push({ t: totalLine('- OTROS:', `$ ${fmtNum(data.paymentBreakdown.otros)}`, profile.chars) });
    L.push({ t: LINE });

    // SENIAT
    L.push({ t: 'RESUMEN FISCAL SENIAT:', b: true });
    L.push({ t: totalLine('BASE IMPONIBLE (16%):', `$ ${fmtNum(data.seniatTax.baseImponible)}`, profile.chars) });
    L.push({ t: totalLine('IVA (16%):', `$ ${fmtNum(data.seniatTax.iva16)}`, profile.chars) });
    L.push({ t: totalLine('EXENTO (0%):', `$ ${fmtNum(data.seniatTax.exento)}`, profile.chars) });
    L.push({ t: totalLine('TOTAL AUDITADO:', `$ ${fmtNum(data.seniatTax.totalVentas)}`, profile.chars) });
    L.push({ t: LINE });

    // Saldos
    L.push({ t: 'SALDOS EN CAJA:', b: true });
    L.push({ t: totalLine('MONTO APERTURA:', `$ ${fmtNum(data.openingAmount)}`, profile.chars) });
    L.push({ t: totalLine('TOTAL ESPERADO:', `$ ${fmtNum(data.expectedBalances.totalExpectedCOP)}`, profile.chars) });

    if (isZ) {
        L.push({ t: LINE });
        L.push({ t: 'RESULTADO AUDITORIA:', b: true });
        if (data.physicalCounts) {
            L.push({ t: totalLine('FÍSICO COP:', `$ ${fmtNum(data.physicalCounts.countedCOP || 0)}`, profile.chars) });
            L.push({ t: totalLine('FÍSICO USD:', `$ ${fmtNum(data.physicalCounts.countedUSD || 0)}`, profile.chars) });
            L.push({ t: totalLine('FÍSICO VES:', `Bs. ${fmtNum(data.physicalCounts.countedVES || 0)}`, profile.chars) });
        }
        L.push({ t: totalLine('TOTAL DECLARADO:', `$ ${fmtNum(data.closingAmount || 0)}`, profile.chars) });
        L.push({ t: totalLine('RESULTADO:', data.varianceType || 'EXACTO', profile.chars) });
        if (data.difference !== undefined && data.difference !== 0) {
            L.push({ t: totalLine(`DIFERENCIA (${data.varianceType}):`, `$ ${fmtNum(Math.abs(data.difference))}`, profile.chars) });
        }
        if (data.notes) L.push({ t: `OBS: ${data.notes}` });
    }

    L.push({ t: LINE });
    L.push({ t: 'IMPRESO DESDE SISTEMA ALL MARKET', a: 1 });

    return L;
}

export async function printAuditTicketReal(
    printer: ThermalPrinterConfig | null,
    data: ReportAuditData
): Promise<{ success: boolean; method: 'serial' | 'browser' | 'none'; message: string }> {
    const profile = getPrinterProfile(printer);

    if (printer?.connectionType === 'thermal_usb') {
        try {
            const port = await openSerialPort(profile.baudRate);
            try {
                const writer = port.writable.getWriter();
                const lines = auditToLines(data, profile);
                const payload = encodeReceipt(lines, profile);
                await writeChunks(writer, payload, 64);
                writer.releaseLock();
                return {
                    success: true,
                    method: 'serial',
                    message: `Reporte ${data.type} enviado a ${printer.name}.`
                };
            } finally {
                await port.close().catch(() => {});
            }
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            if (errMsg.includes('cancelled') || errMsg.includes('NotFoundError')) {
                return { success: false, method: 'none', message: 'Selección cancelada.' };
            }
            toast.error(`Error de impresión: ${errMsg}`);
            return { success: false, method: 'none', message: errMsg };
        }
    }

    if (printer?.connectionType === 'browser' || !printer) {
        window.print();
        return { success: true, method: 'browser', message: `Imprimiendo Reporte ${data.type} en navegador.` };
    }

    return { success: true, method: 'none', message: `Reporte ${data.type} procesado.` };
}

export async function printReportXTicket(printer: ThermalPrinterConfig | null, data: ReportAuditData) {
    return printAuditTicketReal(printer, { ...data, type: 'X' });
}

export async function printReportZTicket(printer: ThermalPrinterConfig | null, data: ReportAuditData) {
    return printAuditTicketReal(printer, { ...data, type: 'Z' });
}
