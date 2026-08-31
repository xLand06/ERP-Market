import { Capacitor } from '@capacitor/core';

export class NativeSQLiteService {
    private static isAndroid = Capacitor.getPlatform() === 'android';

    public static isNativeAndroid(): boolean {
        return this.isAndroid;
    }

    public static async initializeNativeDatabase(): Promise<boolean> {
        if (!this.isAndroid) {
            console.log('[NativeSQLite] Running in Web/Desktop mode - using HTTP API Backend');
            return false;
        }

        try {
            console.log('[NativeSQLite] Initializing native Android SQLite database...');
            // When running natively on Android, initialize CapacitorSQLite plugin
            return true;
        } catch (error) {
            console.error('[NativeSQLite] Failed to initialize native database:', error);
            return false;
        }
    }
}
