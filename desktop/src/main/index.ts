process.env.ELECTRON = 'true';

import { app, BrowserWindow, shell, Menu, Tray, nativeImage, Notification } from 'electron';

// Deshabilitar DNS over HTTPS para evitar errores de SSL handshake en redes con filtros (dns.google, cloudflare-dns)
app.commandLine.appendSwitch('disable-features', 'DnsOverHttps');
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { is } from '@electron-toolkit/utils';
import { startExpressServer, stopExpressServer } from './express-bridge';
import Store from 'electron-store';

// =============================================================================
// ELECTRON STORE — Persistencia ligera para token JWT y configuración
// =============================================================================
const store = new Store<{
    token: string | null;
    branchId: string | null;
    schemaVersion: string | undefined;
    windowState: {
        x: number;
        y: number;
        width: number;
        height: number;
        isMaximized: boolean;
    } | null;
}>({
    defaults: { token: null, branchId: null, schemaVersion: undefined, windowState: null },
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
// WINDOW STATE PERSISTENCE
// =============================================================================
interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    isMaximized: false,
};

function getWindowState(): WindowState {
    const saved = store.get('windowState');
    if (!saved) return DEFAULT_WINDOW_STATE;

    // Si las coordenadas están fuera de pantalla, resetear
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    const isVisible = displays.some((display: { bounds: { x: number; y: number; width: number; height: number } }) => {
        const b = display.bounds;
        return (
            saved.x >= b.x &&
            saved.x < b.x + b.width &&
            saved.y >= b.y &&
            saved.y < b.y + b.height
        );
    });

    if (!isVisible) {
        console.log('[WindowState] Saved coords out of screen, using defaults');
        return DEFAULT_WINDOW_STATE;
    }

    return saved;
}

function saveWindowState(): void {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    store.set('windowState', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: mainWindow.isMaximized(),
    });
}

// =============================================================================
// SYSTEM TRAY
// =============================================================================
let tray: Tray | null = null;

function createTray(): void {
    const iconPath = join(__dirname, is.dev ? '../../resources/icon.png' : '../resources/icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('ALLMARKET -- AbastosSofimar');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Abrir ALLMARKET',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
        },
        {
            label: 'Sincronizar ahora',
            click: () => {
                if (mainWindow) {
                    mainWindow.webContents.send('sync-now');
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Salir',
            click: () => {
                if (mainWindow) {
                    mainWindow.destroy();
                }
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

// =============================================================================
// NATIVE MENU
// =============================================================================
function createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Configuración',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('open-settings');
                        }
                    },
                },
                {
                    label: 'Cerrar sesión',
                    accelerator: 'CmdOrCtrl+Shift+Q',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('logout');
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Salir',
                    accelerator: 'Alt+F4',
                    role: 'quit',
                },
            ],
        },
        {
            label: 'Editar',
            submenu: [
                { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { type: 'separator' },
                { label: 'Seleccionar todo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
            ],
        },
        {
            label: 'Ver',
            submenu: [
                { label: 'Recargar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                {
                    label: 'Pantalla completa',
                    accelerator: 'F11',
                    role: 'togglefullscreen',
                },
                { type: 'separator' },
                {
                    label: 'DevTools',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.toggleDevTools();
                        }
                    },
                },
            ],
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Acerca de ALLMARKET',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('open-about');
                        }
                    },
                },
                {
                    label: 'Versión',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('show-version');
                        }
                    },
                },

            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// =============================================================================
// MAIN WINDOW
// =============================================================================
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    const windowState = getWindowState();

    mainWindow = new BrowserWindow({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        minWidth: 1024,
        minHeight: 600,
        title: 'ALLMARKET -- AbastosSofimar',
        icon: join(__dirname, is.dev ? '../../resources/icon.png' : '../resources/icon.png'),
        show: false,
        autoHideMenuBar: false, // Menú nativo visible en producción
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Restaurar maximized state
    if (windowState.isMaximized) {
        mainWindow.maximize();
    }

    mainWindow.on('ready-to-show', () => {
        mainWindow!.show();
        if (is.dev) mainWindow!.webContents.openDevTools();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Guardar estado al mover/redimensionar (con debounce implícito por cierre)
    mainWindow.on('moved', saveWindowState);
    mainWindow.on('resized', saveWindowState);

    // Al cerrar → minimizar a tray (no salir)
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            // En macOS el comportamiento difiere, la app no se cierra al cerrar ventana
            if (process.platform !== 'darwin') {
                // No fazer nada especial en Windows/Linux — solo hide
                // La app permanece en background
            }
        }
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
    const fullDbPath = join(userDataPath, dbFileName).replace(/\\/g, '/');

    // ── Gestión del schema local ──────────────────────────────────────────────
    // La DB empaquetada solo tiene el schema (tablas vacías).
    // Los datos iniciales se descargan desde Supabase en el primer inicio.
    const SCHEMA_VERSION = '3';
    const storedSchemaVersion = store.get('schemaVersion') as string | undefined;

    const bundledDbPath = is.dev
        ? join(app.getAppPath(), '../backend', dbFileName)
        : join(process.resourcesPath, 'seed', dbFileName);

    const needsSchemaRestore = (): boolean => {
        if (!existsSync(fullDbPath)) return true;

        const dbSize = require('fs').statSync(fullDbPath).size;
        if (dbSize < 8192) return true;
        // Si no hay schemaVersion guardado (primera vez/actualización)
        // O es una versión distinta → restaurar schema fresco
        if (!storedSchemaVersion || storedSchemaVersion !== SCHEMA_VERSION) return true;

        return false;
    };

    if (needsSchemaRestore()) {
        if (existsSync(bundledDbPath)) {
            const fs = require('fs');
            if (existsSync(fullDbPath)) fs.unlinkSync(fullDbPath);
            fs.copyFileSync(bundledDbPath, fullDbPath);
            store.set('schemaVersion', SCHEMA_VERSION);
            console.log(`[Electron] Schema copiado a ${fullDbPath}`);
        } else {
            console.warn(`[Electron] Schema DB no encontrada en ${bundledDbPath}`);
        }
    } else {
        console.log(`[Electron] DB local encontrada en ${fullDbPath}`);
    }

    process.env.LOCAL_DATABASE_URL = `file:${fullDbPath}`;

    console.log(`[Electron] SQLite DB: ${fullDbPath}`);
    console.log(`[Electron] Iniciando backend Express en puerto 3001...`);

    // Levantar el backend Express embebido (puerto 3001)
    // Toda la lógica de negocio, base de datos y sincronización vive ahí.
    await startExpressServer();

    createWindow();
    createMenu();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Flag para distinguir close intencional de hide
app.on('before-quit', async () => {
    (app as any).isQuitting = true;
    saveWindowState();
    await stopExpressServer();
});
