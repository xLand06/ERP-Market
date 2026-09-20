import { prisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

export interface SystemSettings {
    iva: number;
    ivaEnabled: boolean;
    ivaPercent: number;
    ivaMode: 'included' | 'added';
    mainCurrency: string;
    activeCurrencies: string[];
    autoOpenTime: string | null;
    autoCloseTime: string | null;
    purgeRetentionDays: number;
    purgeLogRetentionDays: number;
    activeTheme: string;

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

    // Plan comercial (F2 — Límites de plan)
    planTier: string;       // 'basic' | 'pro'
    planConfig: string;     // JSON string: { maxUsers, maxBranches, maxProducts }

    // Catálogo digital (F5)
    catalogSlug: string;    // slug público del catálogo ('' = sin catálogo)
    catalogActive: boolean; // flag maestro que habilita el catálogo público
    socialLinks: string;    // JSON string: { facebook?, instagram?, whatsapp? }

    // Avisos y comunicados del sistema
    systemNotice?: string | null;
    noticeLevel?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
    iva: 16,
    ivaEnabled: true,
    ivaPercent: 16,
    ivaMode: 'added',
    mainCurrency: 'USD',
    activeCurrencies: ['USD', 'COP', 'VES'],
    autoOpenTime: null,
    autoCloseTime: null,
    purgeRetentionDays: 30,
    purgeLogRetentionDays: 90,
    activeTheme: 'emerald',

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

    planTier: 'basic',
    planConfig: JSON.stringify({ maxUsers: 3, maxBranches: 1, maxProducts: 250 }),

    catalogSlug: '',
    catalogActive: false,
    socialLinks: '{}',

    systemNotice: null,
    noticeLevel: 'INFO',
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
            } else if (s.key === 'ivaEnabled' || s.key === 'autoCut' || s.key === 'openCashDrawer' || s.key === 'autoPrintOnCheckout' || s.key === 'catalogActive' || s.key.startsWith('show')) {
                config[s.key] = s.value === 'true';
            } else if (s.key === 'activeCurrencies') {
                // Stored as JSON array; fall back to comma-split for legacy rows
                try {
                    const parsed = JSON.parse(s.value);
                    config[s.key] = Array.isArray(parsed) ? parsed : s.value.split(',').map((c: string) => c.trim()).filter(Boolean);
                } catch {
                    config[s.key] = s.value.split(',').map((c: string) => c.trim()).filter(Boolean);
                }
            } else {
                config[s.key] = s.value === 'null' ? null : s.value;
            }
        }

        // Guard: auto-correct corrupted iva values (e.g. 1600 stored instead of 16)
        if (config.iva > 100) config.iva = config.iva / 100;
        if (config.ivaPercent > 100) config.ivaPercent = config.ivaPercent / 100;

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

        // Guard: never persist a corrupted iva value
        if (typeof updated.iva === 'number' && updated.iva > 100) updated.iva = updated.iva / 100;
        if (typeof updated.ivaPercent === 'number' && updated.ivaPercent > 100) updated.ivaPercent = updated.ivaPercent / 100;
        // Keep ivaPercent in sync with iva
        if (typeof updated.iva === 'number') updated.ivaPercent = updated.iva;

        // Guardar cada clave en la base de datos de manera atómica/upsert
        for (const [key, val] of Object.entries(updated)) {
            let strVal: string;
            if (val === null) {
                strVal = 'null';
            } else if (Array.isArray(val)) {
                strVal = JSON.stringify(val);
            } else {
                strVal = String(val);
            }
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
