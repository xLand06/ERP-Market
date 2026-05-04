import fs from 'fs';
import path from 'path';
import { logger } from '../../core/utils/logger';

const CONFIG_DIR = path.resolve(process.cwd(), 'config');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'system-settings.json');

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

export function getSettings(): SystemSettings {
    if (!fs.existsSync(SETTINGS_FILE)) {
        return DEFAULT_SETTINGS;
    }
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (error: any) {
        logger.error('[Settings] Error leyendo configuración:', { error: error.message || error });
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Partial<SystemSettings>): SystemSettings {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = getSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    logger.info('[Settings] Configuración guardada', { settings: updated });
    return updated;
}
