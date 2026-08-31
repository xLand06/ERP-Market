import { ThermalPrinterConfig } from '@/hooks/useConfigStore';

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
 * Supports WebUSB direct binary transfers (48 chars for 80mm, 32 chars for 58mm).
 * Seamlessly falls back to browser window.print() if WebUSB is unavailable.
 */
export async function printThermalReceiptReal(
    printer: ThermalPrinterConfig | null,
    data: TicketPrintData
): Promise<{ success: boolean; method: 'webusb' | 'browser'; message: string }> {
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

    if (printer?.connectionType === 'thermal_usb' && 'usb' in navigator) {
        try {
            const devices = await (navigator as any).usb.getDevices();
            let device = devices.find((d: any) => printer.usbVendorId && d.vendorId === printer.usbVendorId);
            if (!device && devices.length > 0) {
                device = devices[0];
            }

            if (device) {
                await device.open();
                if (device.configuration === null) {
                    await device.selectConfiguration(1);
                }
                await device.claimInterface(0);

                const encoder = new TextEncoder();
                const escInit = new Uint8Array([0x1B, 0x40]); // ESC @
                const escCenter = new Uint8Array([0x1B, 0x61, 0x01]); // Align Center
                const escLeft = new Uint8Array([0x1B, 0x61, 0x00]); // Align Left
                const escCut = new Uint8Array([0x1D, 0x56, 0x00]); // GS V 0 (Cut)
                const escDrawer = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); // Open Drawer

                let text = '';
                // 1. ENCABEZADO
                text += `${data.businessName || 'ABASTOS SOFIMAR'}\n`;
                if (data.taxId) text += `RIF: ${data.taxId}\n`;
                if (data.fiscalAddress) text += `${data.fiscalAddress}\n`;
                if (data.fiscalPhone) text += `TEL: ${data.fiscalPhone}\n`;
                text += `${divider}\n`;

                // 2. VENTA & CLIENTE
                text += padRow(`FACTURA #: ${data.invoiceNumber || 'FACT-000482'}`, data.date || new Date().toLocaleDateString('es-VE')) + '\n';
                if (data.cashierName) text += `CAJERO: ${data.cashierName}\n`;
                if (data.customerName) text += padRow(`CLIENTE: ${data.customerName}`, data.customerTaxId || '') + '\n';
                text += `${divider}\n`;

                // 3. PRODUCTOS EN TICKET
                text += padRow('CANT / DESCRIPCION', 'TOTAL USD') + '\n';
                text += `${divider}\n`;

                data.items.forEach(item => {
                    const unitPriceUSD = item.unitPrice || (item.qty ? item.total / item.qty : item.total);
                    text += padRow(`${item.qty}x ${item.name}`, `$${item.total.toFixed(2)}`) + '\n';
                    text += `   ${item.qty} x $${unitPriceUSD.toFixed(2)} USD\n`;
                });

                text += `${divider}\n`;

                // 4. TOTALES
                text += padRow('TOTAL USD:', `$${data.totalUSD.toFixed(2)}`) + '\n';
                if (data.totalVES) text += padRow('TOTAL VES:', `Bs. ${data.totalVES.toFixed(2)}`) + '\n';
                if (data.totalCOP) text += padRow('TOTAL COP:', `$${data.totalCOP.toLocaleString('es-CO')}`) + '\n';

                // 5. FORMAS DE PAGO
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

                // 6. PIE DE PÁGINA
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

                const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(
                    (e: any) => e.direction === 'out'
                );

                if (endpoint) {
                    await device.transferOut(endpoint.endpointNumber, payload);
                    return {
                        success: true,
                        method: 'webusb',
                        message: `Factura enviada directamente a ${device.productName || printer.name} por USB.`
                    };
                }
            }
        } catch (err: any) {
            console.warn('WebUSB fallback to browser print:', err?.message);
        }
    }

    // Default Fallback: Browser print dialog
    window.print();
    return {
        success: true,
        method: 'browser',
        message: `Imprimiendo en ${printer?.name || 'Impresora Térmica Presupuestada'}`
    };
}
