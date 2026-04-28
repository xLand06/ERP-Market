process.env.ELECTRON = 'true';

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { is } from '@electron-toolkit/utils';
import { startExpressServer } from './express-bridge';
import Store from 'electron-store';

// =============================================================================
// ELECTRON STORE — Persistencia ligera para token JWT y configuración
// =============================================================================
const store = new Store<{ token: string | null; branchId: string | null }>({
    defaults: { token: null, branchId: null },
});

(global as Record<string, unknown>).erpStore = store;

import { ipcMain } from 'electron';

// ── Store IPCs ────────────────────────────────────────────────────────────────
ipcMain.handle('store-get', (_event, key: string) => store.get(key));
ipcMain.handle('store-set', (_event, key: string, value: any) => store.set(key, value));
ipcMain.handle('store-delete', (_event, key: string) => store.delete(key));
ipcMain.handle('get-app-path', () => app.getAppPath());
ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

// =============================================================================
// MAIN WINDOW
// =============================================================================
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        title: 'ERP-Market — Abastos Sofimar',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow!.show();
        if (is.dev) mainWindow!.webContents.openDevTools();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================
app.whenReady().then(async () => {
    const userDataPath = app.getPath('userData');

    if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
    }

    // Configurar la URL de la base de datos local (SQLite vía Prisma en el backend)
    const dbFileName = 'erp-market.db';
    const fullDbPath = join(userDataPath, dbFileName);
    process.env.LOCAL_DATABASE_URL = `file:${fullDbPath}`;

    console.log(`[Electron] SQLite DB: ${fullDbPath}`);
    console.log(`[Electron] Iniciando backend Express en puerto 3001...`);

    // Levantar el backend Express embebido (puerto 3001)
    // Toda la lógica de negocio, base de datos y sincronización vive ahí.
    await startExpressServer();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});