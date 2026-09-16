import { ThermalPrinterConfig } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

// Helper to find WebUSB device matching configured vendorId and productId (if available) or fallback to first available
async function findWebUsbDevice(printer: ThermalPrinterConfig | null): Promise<any | null> {
    if (!('usb' in navigator)) return null;
    const devices = await (navigator as any).usb.getDevices();
    let device = devices.find((d: any) => {
        if (printer?.usbVendorId != null && printer?.usbProductId != null) {
            return d.vendorId === printer.usbVendorId && d.productId === printer.usbProductId;
        }
        if (printer?.usbVendorId != null) {
            return d.vendorId === printer.usbVendorId;
        }
        return false;
    });
    if (!device && devices.length > 0) {
        device = devices[0];
    }
    return device || null;
}

// Dynamically find interface and OUT endpoint from the device configuration
function findOutEndpoint(device: any): { interfaceNumber: number; endpointNumber: number } | null {
    if (!device.configuration?.interfaces) return null;
    for (const iface of device.configuration.interfaces) {
        const ep = iface.alternate?.endpoints?.find((e: any) => e.direction === 'out')
            || iface.alternates?.flatMap((a: any) => a.endpoints || []).find((e: any) => e.direction === 'out');
        if (ep) {
            return {
                interfaceNumber: iface.interfaceNumber,
                endpointNumber: ep.endpointNumber,
            };
        }
    }
    return null;
}

// Safely transfers ESC/POS data to the WebUSB device, ensuring device.close() is always called in try/finally
async function sendEscPosToWebUsb(device: any, payload: Uint8Array): Promise<void> {
    await device.open();
    try {
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }

        const out = findOutEndpoint(device);
        if (!out) {
            throw new Error('No se encontró un endpoint de salida (OUT) en la interfaz USB de la impresora.');
        }

        await device.claimInterface(out.interfaceNumber);
        await device.transferOut(out.endpointNumber, payload);
    } finally {
        if (device.opened) {
            try {
                await device.close();
            } catch (closeErr) {
                console.warn('Error al cerrar dispositivo USB:', closeErr);
            }
        }
    }
}

// Error handling with clear diagnostics for Access denied / Windows driver conflicts
function handleWebUsbError(err: any): { message: string } {
    const errMsg = err?.message || String(err);
    if (err?.name === 'SecurityError' || errMsg.includes('Access denied') || errMsg.includes('SecurityError')) {
        const diagnosticMsg = "Acceso denegado por Windows: la impresora está bloqueada por el driver de Windows. En Windows se requiere asociar el driver WinUSB (usando Zadig) para permitir WebUSB directo, o usar 'Impresora del Sistema'.";
        console.warn(`[WebUSB Diagnostic]: ${diagnosticMsg}`, err);
        toast.error(diagnosticMsg, { duration: 6000 });
        return { message: diagnosticMsg };
    }
    const generalMsg = `Error al comunicarse con la impresora USB: ${errMsg}`;
    console.error('[WebUSB Error]:', err);
    toast.error(generalMsg);
    return { message: generalMsg };
}

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

/**
 * Direct ESC/POS printing pipeline inspired by Zeu Backoffice 3-layer architecture.
 * - Automatic printing if a hardware/thermal printer is configured.
 * - Non-blocking flow if no printer is configured (does not open blocking window.print() dialogs).
 */
export async function printThermalReceiptReal(
    printer: ThermalPrinterConfig | null,
    data: TicketPrintData
): Promise<{ success: boolean; method: 'webusb' | 'browser' | 'none'; message: string }> {
    const paperWidth = printer?.paperWidth || '80mm';
    const charWidth = paperWidth === '58mm' ? 32 : 48;
    const divider = '-'.repeat(charWidth);

    const padRow = (left: string, right: string) => {
        const avail = charWidth - right.length;
        if (left.length > avail) {
            return left.substring(0, avail - 1) + ' ' + right;
        }
        return left + ' '.repeat(avail - left.length) + right;
    };

    // 1. Impresión Directa Hardware WebUSB (ESC/POS)
    if (printer?.connectionType === 'thermal_usb') {
        if (!('usb' in navigator)) {
            const msg = 'WebUSB no es compatible en este navegador. Usa Google Chrome o Microsoft Edge, o cambia a "Impresora del Sistema".';
            toast.error(msg);
            return { success: false, method: 'none', message: msg };
        }
        try {
            const device = await findWebUsbDevice(printer);
            if (!device) {
                const notFoundMsg = 'No se encontró la impresora USB vinculada. Verifica la conexión en Configuración.';
                toast.error(notFoundMsg);
                return { success: false, method: 'none', message: notFoundMsg };
            }

            const encoder = new TextEncoder();
            const escInit = new Uint8Array([0x1B, 0x40]); // ESC @
            const escCenter = new Uint8Array([0x1B, 0x61, 0x01]); // Align Center
            const escCut = new Uint8Array([0x1D, 0x56, 0x00]); // GS V 0 (Cut)
            const escDrawer = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); // Open Drawer

            let text = '';
            text += `${data.businessName || 'ABASTOS SOFIMAR'}\n`;
            if (data.taxId) text += `RIF: ${data.taxId}\n`;
            if (data.fiscalAddress) text += `${data.fiscalAddress}\n`;
            if (data.fiscalPhone) text += `TEL: ${data.fiscalPhone}\n`;
            text += `${divider}\n`;

            text += padRow(`FACTURA #: ${data.invoiceNumber || 'FACT-000482'}`, data.date || new Date().toLocaleDateString('es-VE')) + '\n';
            if (data.cashierName) text += `CAJERO: ${data.cashierName}\n`;
            if (data.customerName) text += padRow(`CLIENTE: ${data.customerName}`, data.customerTaxId || '') + '\n';
            text += `${divider}\n`;

            text += padRow('CANT / DESCRIPCION', 'TOTAL USD') + '\n';
            text += `${divider}\n`;

            data.items.forEach(item => {
                const unitPriceUSD = item.unitPrice || (item.qty ? item.total / item.qty : item.total);
                text += padRow(`${item.qty}x ${item.name}`, `$${item.total.toFixed(2)}`) + '\n';
                text += `   ${item.qty} x $${unitPriceUSD.toFixed(2)} USD\n`;
            });

            text += `${divider}\n`;

            const gravableUSD = data.totalUSD / 1.16;
            const ivaUSD = data.totalUSD - gravableUSD;

            text += padRow('BASE IMPONIBLE (G 16%):', `$${gravableUSD.toFixed(2)}`) + '\n';
            text += padRow('IVA (16.00%):', `$${ivaUSD.toFixed(2)}`) + '\n';
            text += `${divider}\n`;

            text += padRow('TOTAL USD:', `$${data.totalUSD.toFixed(2)}`) + '\n';
            if (data.totalVES) text += padRow('TOTAL VES:', `Bs. ${data.totalVES.toFixed(2)}`) + '\n';
            if (data.totalCOP) text += padRow('TOTAL COP:', `$${data.totalCOP.toLocaleString('es-CO')}`) + '\n';

            if (data.paymentMethods && data.paymentMethods.length > 0) {
                text += `${divider}\n`;
                text += 'FORMAS DE PAGO:\n';
                data.paymentMethods.forEach(m => {
                    const val = m.currency === 'VES' ? `Bs. ${m.amount.toFixed(2)}` : `$${m.amount.toFixed(2)}`;
                    text += padRow(`- ${m.type.toUpperCase()} (${m.currency}):`, val) + '\n';
                });
                if (data.changeUSD && data.changeUSD > 0) {
                    text += padRow('- CAMBIO USD:', `$${data.changeUSD.toFixed(2)}`) + '\n';
                }
            }

            text += `${divider}\n`;
            text += `${data.footerMessage || '¡Gracias por su compra! Vuelva pronto'}\n\n\n`;

            const bodyBuffer = encoder.encode(text);
            const parts = [escInit, escCenter, bodyBuffer, escCut];
            if (printer.openCashDrawer) parts.push(escDrawer);

            let totalLen = parts.reduce((acc, p) => acc + p.length, 0);
            const payload = new Uint8Array(totalLen);
            let offset = 0;
            for (const part of parts) {
                payload.set(part, offset);
                offset += part.length;
            }

            await sendEscPosToWebUsb(device, payload);

            return {
                success: true,
                method: 'webusb',
                message: `Factura enviada directamente a ${device.productName || printer.name} por USB.`
            };
        } catch (err: any) {
            const { message } = handleWebUsbError(err);
            return {
                success: false,
                method: 'none',
                message,
            };
        }
    }

    // 2. Impresión Explícita de Navegador (Solo si la impresora está configurada con tipo 'browser')
    if (printer?.connectionType === 'browser') {
        window.print();
        return {
            success: true,
            method: 'browser',
            message: `Imprimiendo en navegador para ${printer.name}`
        };
    }

    // 3. Flujo No Bloqueante: Si no hay impresora térmica configurada o vinculada, no bloquear la pantalla con ventanas emergentes
    return {
        success: true,
        method: 'none',
        message: 'Venta completada sin impresora configurada.'
    };
}

import { ReportAuditData } from '@/components/common/ThermalAuditTicket';
export type { ReportAuditData };

/**
 * Direct ESC/POS printing pipeline for Reporte X and Reporte Z audit tickets.
 */
export async function printAuditTicketReal(
    printer: ThermalPrinterConfig | null,
    data: ReportAuditData
): Promise<{ success: boolean; method: 'webusb' | 'browser' | 'none'; message: string }> {
    const isZ = data.type === 'Z';
    const paperWidth = printer?.paperWidth || '80mm';
    const charWidth = paperWidth === '58mm' ? 32 : 48;
    const divider = '-'.repeat(charWidth);

    const padRow = (left: string, right: string) => {
        const avail = charWidth - right.length;
        if (left.length > avail) {
            return left.substring(0, avail - 1) + ' ' + right;
        }
        return left + ' '.repeat(avail - left.length) + right;
    };

    const fmtNum = (val: number) => val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d?: string | Date | null) => d ? new Date(d).toLocaleString('es-VE') : '-';

    // 1. Direct WebUSB ESC/POS Hardware Printing
    if (printer?.connectionType === 'thermal_usb') {
        if (!('usb' in navigator)) {
            const msg = 'WebUSB no es compatible en este navegador. Usa Google Chrome o Microsoft Edge, o cambia a "Impresora del Sistema".';
            toast.error(msg);
            return { success: false, method: 'none', message: msg };
        }
        try {
            const device = await findWebUsbDevice(printer);
            if (!device) {
                const notFoundMsg = 'No se encontró la impresora USB vinculada. Verifica la conexión en Configuración.';
                toast.error(notFoundMsg);
                return { success: false, method: 'none', message: notFoundMsg };
            }

            const encoder = new TextEncoder();
            const escInit = new Uint8Array([0x1B, 0x40]); // ESC @
            const escCenter = new Uint8Array([0x1B, 0x61, 0x01]); // Align Center
            const escLeft = new Uint8Array([0x1B, 0x61, 0x00]); // Align Left
            const escCut = new Uint8Array([0x1D, 0x56, 0x00]); // GS V 0 (Cut)
            const escDrawer = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); // Open Drawer

            let textHeader = '';
            textHeader += `${data.businessName || 'ABASTOS SOFIMAR'}\n`;
            if (data.taxId) textHeader += `RIF: ${data.taxId}\n`;
            textHeader += `${data.branch?.name ? `SEDE: ${data.branch.name}` : 'SEDE PRINCIPAL'}\n`;
            textHeader += `${divider}\n`;
            textHeader += isZ ? '--- REPORTE Z (CIERRE) ---\n' : '--- REPORTE X (PARCIAL) ---\n';
            textHeader += `${divider}\n`;

            let textBody = '';
            textBody += padRow('CAJA ID:', data.registerId.slice(-8).toUpperCase()) + '\n';
            textBody += padRow('CAJERO:', data.user?.nombre || data.user?.username || 'SISTEMA') + '\n';
            textBody += padRow('APERTURA:', fmtDate(data.openedAt)) + '\n';
            if (isZ) textBody += padRow('CIERRE:', fmtDate(data.closedAt || new Date())) + '\n';
            textBody += `${divider}\n`;

            textBody += 'DESGLOSE DE VENTAS:\n';
            textBody += padRow('Nº TRANSACCIONES:', String(data.transactionCount)) + '\n';
            textBody += padRow('TOTAL VENTAS:', `$ ${fmtNum(data.salesTotal)}`) + '\n';
            textBody += `${divider}\n`;

            textBody += 'FORMAS DE PAGO:\n';
            textBody += padRow('- EFECTIVO COP:', `$ ${fmtNum(data.paymentBreakdown.efectivoCOP)}`) + '\n';
            textBody += padRow('- EFECTIVO USD:', `$ ${fmtNum(data.paymentBreakdown.efectivoUSD)}`) + '\n';
            textBody += padRow('- EFECTIVO VES:', `Bs. ${fmtNum(data.paymentBreakdown.efectivoVES)}`) + '\n';
            textBody += padRow('- TRANSFERENCIA:', `$ ${fmtNum(data.paymentBreakdown.transferencia)}`) + '\n';
            textBody += padRow('- TARJETA:', `$ ${fmtNum(data.paymentBreakdown.tarjeta)}`) + '\n';
            if (data.paymentBreakdown.otros > 0) {
                textBody += padRow('- OTROS:', `$ ${fmtNum(data.paymentBreakdown.otros)}`) + '\n';
            }
            textBody += `${divider}\n`;

            textBody += 'RESUMEN FISCAL SENIAT:\n';
            textBody += padRow('BASE IMPONIBLE (16%):', `$ ${fmtNum(data.seniatTax.baseImponible)}`) + '\n';
            textBody += padRow('IVA (16%):', `$ ${fmtNum(data.seniatTax.iva16)}`) + '\n';
            textBody += padRow('EXENTO (0%):', `$ ${fmtNum(data.seniatTax.exento)}`) + '\n';
            textBody += padRow('TOTAL AUDITADO:', `$ ${fmtNum(data.seniatTax.totalVentas)}`) + '\n';
            textBody += `${divider}\n`;

            textBody += 'SALDOS EN CAJA (ESPERADOS):\n';
            textBody += padRow('MONTO APERTURA:', `$ ${fmtNum(data.openingAmount)}`) + '\n';
            textBody += padRow('TOTAL ESPERADO:', `$ ${fmtNum(data.expectedBalances.totalExpectedCOP)}`) + '\n';

            if (isZ) {
                textBody += `${divider}\n`;
                textBody += 'RESULTADO AUDITORIA CIERRE:\n';
                if (data.physicalCounts) {
                    textBody += padRow('FÍSICO COP:', `$ ${fmtNum(data.physicalCounts.countedCOP || 0)}`) + '\n';
                    textBody += padRow('FÍSICO USD:', `$ ${fmtNum(data.physicalCounts.countedUSD || 0)}`) + '\n';
                    textBody += padRow('FÍSICO VES:', `Bs. ${fmtNum(data.physicalCounts.countedVES || 0)}`) + '\n';
                }
                textBody += padRow('TOTAL DECLARADO:', `$ ${fmtNum(data.closingAmount || 0)}`) + '\n';
                textBody += padRow('RESULTADO:', data.varianceType || 'EXACTO') + '\n';
                if (data.difference !== undefined && data.difference !== 0) {
                    textBody += padRow(`DIFERENCIA (${data.varianceType}):`, `$ ${fmtNum(Math.abs(data.difference))}`) + '\n';
                }
                if (data.notes) {
                    textBody += `OBS: ${data.notes}\n`;
                }
            }

            textBody += `${divider}\n`;
            textBody += 'IMPRESO DESDE SISTEMA ERP MARKET\n\n\n';

            const headerBuf = encoder.encode(textHeader);
            const bodyBuf = encoder.encode(textBody);

            const parts = [escInit, escCenter, headerBuf, escLeft, bodyBuf, escCut];
            // For Report Z, kick cash drawer
            if (isZ || printer.openCashDrawer) {
                parts.push(escDrawer);
            }

            let totalLen = parts.reduce((acc, p) => acc + p.length, 0);
            const payload = new Uint8Array(totalLen);
            let offset = 0;
            for (const part of parts) {
                payload.set(part, offset);
                offset += part.length;
            }

            await sendEscPosToWebUsb(device, payload);

            return {
                success: true,
                method: 'webusb',
                message: `Reporte ${data.type} enviado a impresora térmica USB.`
            };
        } catch (err: any) {
            const { message } = handleWebUsbError(err);
            return {
                success: false,
                method: 'none',
                message,
            };
        }
    }

    // 2. Browser Print Fallback
    if (printer?.connectionType === 'browser' || !printer) {
        window.print();
        return {
            success: true,
            method: 'browser',
            message: `Imprimiendo Reporte ${data.type} mediante diálogo de navegador.`
        };
    }

    return {
        success: true,
        method: 'none',
        message: `Reporte ${data.type} procesado.`
    };
}

export async function printReportXTicket(printer: ThermalPrinterConfig | null, data: ReportAuditData) {
    return printAuditTicketReal(printer, { ...data, type: 'X' });
}

export async function printReportZTicket(printer: ThermalPrinterConfig | null, data: ReportAuditData) {
    return printAuditTicketReal(printer, { ...data, type: 'Z' });
}

