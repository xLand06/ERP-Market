import { prisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

export interface SystemSettings {
    iva: number;
    autoOpenTime: string | null;
    autoCloseTime: string | null;
    purgeRetentionDays: number;
    purgeLogRetentionDays: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
    iva: 0,
    autoOpenTime: null,
    autoCloseTime: null,
    purgeRetentionDays: 30,
    purgeLogRetentionDays: 90
};

export async function getSettings(): Promise<SystemSettings> {
    try {
        const dbSettings = await prisma.systemSetting.findMany();
        if (dbSettings.length === 0) {
            return DEFAULT_SETTINGS;
        }

        const config: any = { ...DEFAULT_SETTINGS };
        for (const s of dbSettings) {
            if (s.key === 'iva') {
                config.iva = Number(s.value);
            } else if (s.key === 'purgeRetentionDays') {
                config.purgeRetentionDays = Number(s.value);
            } else if (s.key === 'purgeLogRetentionDays') {
                config.purgeLogRetentionDays = Number(s.value);
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
