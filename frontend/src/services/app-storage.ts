// =============================================================================
// APP STORAGE — Persistencia para serverUrl usando SQLite en Capacitor
// En web/Electron usa localStorage como fallback.
// =============================================================================

import { Capacitor } from '@capacitor/core';

const DB_NAME = 'app_config';
const TABLE = 'kv_store';
const isNative = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';

let dbReady = false;

async function getDb(): Promise<any> {
    if (dbReady) return true;

    if (!isNative) return null;

    try {
        const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
        const sqlite = new SQLiteConnection(CapacitorSQLite);

        const ret = await sqlite.isConnection(DB_NAME, false);
        if (!ret.result) {
            await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
        }
        const conn = await sqlite.retrieveConnection(DB_NAME, false);
        await conn.open();

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);

        dbReady = true;
        return conn;
    } catch (err) {
        console.error('[AppStorage] SQLite init failed, falling back to localStorage:', err);
        return null;
    }
}

// ── Cache para acceso síncrono (api.ts interceptor) ──────────────────────
let _serverUrlCache: string | null = null;

function updateCache(key: string, value: string | null) {
    if (key === 'serverUrl') {
        _serverUrlCache = value;
        // Sync con el interceptor de api.ts
        try {
            const { setCachedServerUrl } = require('../lib/api');
            setCachedServerUrl(value);
        } catch {}
    }
}

export const AppStorage = {
    /** Inicializar: cargar serverUrl del storage al cache síncrono */
    async initServerUrl(): Promise<string | null> {
        const value = await this.getItem('serverUrl');
        updateCache('serverUrl', value);
        return value;
    },

    async getItem(key: string): Promise<string | null> {
        const conn = await getDb();
        if (!conn) {
            return localStorage.getItem(key);
        }
        try {
            const res = await conn.query(`SELECT value FROM ${TABLE} WHERE key = ?`, [key]);
            return res.values?.[0]?.value ?? null;
        } catch {
            return null;
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        const conn = await getDb();
        if (!conn) {
            localStorage.setItem(key, value);
            updateCache(key, value);
            return;
        }
        try {
            await conn.run(
                `INSERT OR REPLACE INTO ${TABLE} (key, value) VALUES (?, ?)`,
                [key, value]
            );
            updateCache(key, value);
        } catch (err) {
            console.error('[AppStorage] setItem failed:', err);
        }
    },

    async removeItem(key: string): Promise<void> {
        const conn = await getDb();
        if (!conn) {
            localStorage.removeItem(key);
            updateCache(key, null);
            return;
        }
        try {
            await conn.run(`DELETE FROM ${TABLE} WHERE key = ?`, [key]);
            updateCache(key, null);
        } catch {}
    },
};
