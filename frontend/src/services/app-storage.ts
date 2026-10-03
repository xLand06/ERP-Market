// =============================================================================
// APP STORAGE — Persistencia para serverUrl usando SQLite en Capacitor
// En web/Electron usa localStorage como fallback.
// =============================================================================

import { Capacitor } from '@capacitor/core';
import { setServerUrlCache, normalizeServerUrl } from '../lib/server-url';

const DB_NAME = 'app_config';
const TABLE = 'kv_store';
const isNative = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';

let dbReady = false;
let dbConn: any = null;

async function getDb(): Promise<any> {
    if (dbConn) return dbConn;
    if (dbReady && dbConn) return dbConn;

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

        dbConn = conn;
        dbReady = true;
        return conn;
    } catch (err) {
        console.error('[AppStorage] SQLite init failed, falling back to localStorage:', err);
        return null;
    }
}

function updateCache(key: string, value: string | null) {
    if (key === 'serverUrl') {
        setServerUrlCache(value);
    }
}

export const AppStorage = {
    /** Inicializar: cargar serverUrl del storage al cache síncrono */
    async initServerUrl(): Promise<string | null> {
        const value = normalizeServerUrl(await this.getItem('serverUrl'));
        updateCache('serverUrl', value);
        return value;
    },

    async getItem(key: string): Promise<string | null> {
        // Always try localStorage first (mirror) — survives SQLite quirks
        const mirror = localStorage.getItem(key);
        const conn = await getDb();
        if (!conn) {
            return mirror;
        }
        try {
            const res = await conn.query(`SELECT value FROM ${TABLE} WHERE key = ?`, [key]);
            const dbValue = res.values?.[0]?.value ?? null;
            if (dbValue) {
                if (mirror !== dbValue) localStorage.setItem(key, dbValue);
                return dbValue;
            }
            return mirror;
        } catch (err) {
            console.error('[AppStorage] getItem failed:', err);
            return mirror;
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        const stored = key === 'serverUrl' ? (normalizeServerUrl(value) || value) : value;
        // Mirror first so the value survives even if SQLite fails
        try { localStorage.setItem(key, stored); } catch { /* quota */ }
        updateCache(key, stored);
        const conn = await getDb();
        if (!conn) return;
        try {
            await conn.run(
                `INSERT OR REPLACE INTO ${TABLE} (key, value) VALUES (?, ?)`,
                [key, stored]
            );
        } catch (err) {
            console.error('[AppStorage] setItem SQLite failed (localStorage kept):', err);
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
