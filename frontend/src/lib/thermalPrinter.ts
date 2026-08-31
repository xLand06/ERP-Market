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
 * Direct ESC/POS printing over WebUSB when a USB printer is paired.
 * Falls back to browser window.print() if WebUSB is not paired or unavailable.
 */
export async function printThermalReceiptReal(
    printer: ThermalPrinterConfig | null,
    data: TicketPrintData
): Promise<{ success: boolean; method: 'webusb' | 'browser'; message: string }> {
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
                const escInit = new Uint8Array([0x1B, 0x40]); // ESC @ (Initialize)
                const escCenter = new Uint8Array([0x1B, 0x61, 0x01]); // Align Center
                const escLeft = new Uint8Array([0x1B, 0x61, 0x00]); // Align Left
                const escBoldOn = new Uint8Array([0x1B, 0x45, 0x01]); // Bold On
                const escBoldOff = new Uint8Array([0x1B, 0x45, 0x00]); // Bold Off
                const escCut = new Uint8Array([0x1D, 0x56, 0x00]); // Full Cut
                const escDrawer = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]); // Open Drawer

                let ticketText = '';
                ticketText += `${data.businessName || 'ABASTOS SOFIMAR'}\n`;
                if (data.taxId) ticketText += `RIF: ${data.taxId}\n`;
                if (data.fiscalAddress) ticketText += `${data.fiscalAddress}\n`;
                if (data.fiscalPhone) ticketText += `TEL: ${data.fiscalPhone}\n`;
                ticketText += `--------------------------------\n`;
                ticketText += `FACTURA #: ${data.invoiceNumber || 'FACT-000482'}\n`;
                ticketText += `FECHA: ${data.date || new Date().toLocaleDateString('es-VE')}\n`;
                if (data.customerName) ticketText += `CLIENTE: ${data.customerName}\n`;
                if (data.customerTaxId) ticketText += `CI/RIF: ${data.customerTaxId}\n`;
                ticketText += `--------------------------------\n`;
                ticketText += `CANT/DESC             TOTAL USD\n`;
                ticketText += `--------------------------------\n`;

                data.items.forEach(item => {
                    const lineName = item.name.padEnd(20, ' ').substring(0, 20);
                    const lineTotal = `$${item.total.toFixed(2)}`.padStart(10, ' ');
                    ticketText += `${item.qty}x ${lineName} ${lineTotal}\n`;
                });

                ticketText += `--------------------------------\n`;
                ticketText += `TOTAL USD: $${data.totalUSD.toFixed(2)}\n`;
                if (data.totalVES) ticketText += `TOTAL VES: Bs. ${data.totalVES.toFixed(2)}\n`;
                if (data.totalCOP) ticketText += `TOTAL COP: $${data.totalCOP.toLocaleString('es-CO')}\n`;
                ticketText += `--------------------------------\n`;
                ticketText += `${data.footerMessage || '¡Gracias por su compra!'}\n\n\n`;

                const headerBuffer = encoder.encode(ticketText);

                // Build complete byte payload
                const parts = [escInit, escCenter, headerBuffer, escCut];
                if (printer.openCashDrawer) {
                    parts.push(escDrawer);
                }

                let totalLength = parts.reduce((acc, p) => acc + p.length, 0);
                const fullPayload = new Uint8Array(totalLength);
                let offset = 0;
                for (const part of parts) {
                    fullPayload.set(part, offset);
                    offset += part.length;
                }

                const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(
                    (e: any) => e.direction === 'out'
                );

                if (endpoint) {
                    await device.transferOut(endpoint.endpointNumber, fullPayload);
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

    // Default Fallback: Trigger browser window.print()
    window.print();
    return {
        success: true,
        method: 'browser',
        message: `Imprimiendo en ${printer?.name || 'Impresora Térmica Presupuestada'}`
    };
}
