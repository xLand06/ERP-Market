// ============================================================
// ⚠️ ORDEN CRÍTICO:
// process.env.ELECTRON = 'true' DEBE estar seteado ANTES de que
// cualquier módulo del backend sea requerido/importado.
// El Proxy en config/prisma.ts evalúa ELECTRON en la primera
// llamada real, pero lo garantizamos seteándolo aquí primero.
// ============================================================
process.env.ELECTRON = 'true';

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { startExpressServer } from './express-bridge';
import Store from 'electron-store';

// ── Electron Store ──────────────────────────────────────────
// Persiste JWT y preferencias entre reinicios
const store = new Store<{ token: string | null; branchId: string | null }>({
    defaults: { token: null, branchId: null },
});

// Exponemos el store globalmente para que IPC handlers lo usen
(global as Record<string, unknown>).erpStore = store;

// ── Ventana principal ───────────────────────────────────────
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

    // Mostrar solo cuando el contenido esté listo (evita flash blanco)
    mainWindow.on('ready-to-show', () => {
        mainWindow!.show();
        if (is.dev) mainWindow!.webContents.openDevTools();
    });

    // Abrir links externos en el navegador del sistema
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // ── Cargar el renderer ──────────────────────────────────
    // DEV:  electron-vite sirve el renderer en un puerto propio
    // PROD: carga el build estático desde out/renderer/index.html
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

// ── App Lifecycle ───────────────────────────────────────────
app.whenReady().then(async () => {
    // Setear la ruta de la BD SQLite ANTES de que cualquier
    // request llegue al Express local
    const dbPath = `file:${join(app.getPath('userData'), 'erp-market.db')}`;
    process.env.LOCAL_DATABASE_URL = dbPath;

    console.log(`[Electron] SQLite DB: ${dbPath}`);

    // Levantar Express en :3001 (importa backend/src/app.ts)
    await startExpressServer();

    // Crear la ventana
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
