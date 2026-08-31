import { prisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

export interface SystemSettings {
    iva: number;
    ivaEnabled: boolean;
    ivaPercent: number;
    ivaMode: 'included' | 'added';
    mainCurrency: string;
    autoOpenTime: string | null;
    autoCloseTime: string | null;
    purgeRetentionDays: number;
    purgeLogRetentionDays: number;

    // Negocio & Datos Fiscales
    businessName: string;
    taxId: string;
    fiscalAddress: string;
    fiscalPhone: string;

    // Impresora Térmica & Impresión
    printerType: 'browser' | 'thermal_usb' | 'thermal_network' | 'thermal_serial';
    paperWidth: '80mm' | '58mm';
    autoCut: boolean;
    openCashDrawer: boolean;
    printCopies: number;
    autoPrintOnCheckout: boolean;

    // Visibilidad & Plantilla de Factura
    showBusinessHeader: boolean;
    showTaxId: boolean;
    showFiscalAddress: boolean;
    showCustomer: boolean;
    showMultiCurrencySummary: boolean;
    showPaymentMethods: boolean;
    showIvaBreakdown: boolean;
    footerMessage: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
    iva: 16,
    ivaEnabled: true,
    ivaPercent: 16,
    ivaMode: 'added',
    mainCurrency: 'USD',
    autoOpenTime: null,
    autoCloseTime: null,
    purgeRetentionDays: 30,
    purgeLogRetentionDays: 90,

    businessName: 'ABASTOS SOFIMAR',
    taxId: 'J-12345678-9',
    fiscalAddress: 'Calle Principal, Local #1',
    fiscalPhone: '0414-1234567',

    printerType: 'browser',
    paperWidth: '80mm',
    autoCut: true,
    openCashDrawer: true,
    printCopies: 1,
    autoPrintOnCheckout: false,

    showBusinessHeader: true,
    showTaxId: true,
    showFiscalAddress: true,
    showCustomer: true,
    showMultiCurrencySummary: true,
    showPaymentMethods: true,
    showIvaBreakdown: true,
    footerMessage: '¡Gracias por su compra! Vuelva pronto',
};

export async function getSettings(): Promise<SystemSettings> {
    try {
        const dbSettings = await prisma.systemSetting.findMany();
        if (dbSettings.length === 0) {
            return DEFAULT_SETTINGS;
        }

        const config: any = { ...DEFAULT_SETTINGS };
        for (const s of dbSettings) {
            if (s.key === 'iva' || s.key === 'ivaPercent' || s.key === 'purgeRetentionDays' || s.key === 'purgeLogRetentionDays' || s.key === 'printCopies') {
                config[s.key] = Number(s.value);
            } else if (s.key === 'ivaEnabled' || s.key === 'autoCut' || s.key === 'openCashDrawer' || s.key === 'autoPrintOnCheckout' || s.key.startsWith('show')) {
                config[s.key] = s.value === 'true';
            } else {
                config[s.key] = s.value === 'null' ? null : s.value;
            }
        }
        return config as SystemSettings;
    } catch (error: any) {
        logger.error('[Settings] Error leyendo configuración desde BD:', { error: error.message || error });
        return DEFAULT_SETTINGS;
    }
}

export async function saveSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
        const current = await getSettings();
        const updated = { ...current, ...settings };

        // Guardar cada clave en la base de datos de manera atómica/upsert
        for (const [key, val] of Object.entries(updated)) {
            const strVal = val === null ? 'null' : String(val);
            await prisma.systemSetting.upsert({
                where: { key },
                update: { value: strVal },
                create: { key, value: strVal },
            });
        }

        logger.info('[Settings] Configuración guardada en BD', { settings: updated });
        return updated;
    } catch (error: any) {
        logger.error('[Settings] Error guardando configuración en BD:', { error: error.message || error });
        throw error;
    }
}
