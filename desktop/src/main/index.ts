process.env.ELECTRON = 'true';

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { startExpressServer } from './express-bridge';
import Store from 'electron-store';
import Database from 'better-sqlite3';

const store = new Store<{ token: string | null; branchId: string | null }>({
    defaults: { token: null, branchId: null },
});

(global as Record<string, unknown>).erpStore = store;

import { ipcMain } from 'electron';

ipcMain.handle('store-get', (_event, key: string) => store.get(key));
ipcMain.handle('store-set', (_event, key: string, value: any) => store.set(key, value));
ipcMain.handle('store-delete', (_event, key: string) => store.delete(key));
ipcMain.handle('get-app-path', () => app.getAppPath());
ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

let db: Database.Database;

function initDatabase(userDataPath: string) {
    const dbPath = join(userDataPath, 'erp-market.db');
    db = new Database(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            barcode TEXT,
            price REAL,
            cost REAL,
            category TEXT,
            categoryId TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT,
            updatedAt TEXT
        );
        
        CREATE TABLE IF NOT EXISTS branch_inventory (
            id TEXT PRIMARY KEY,
            productId TEXT,
            branchId TEXT,
            stock INTEGER DEFAULT 0,
            minStock INTEGER DEFAULT 0,
            updatedAt TEXT,
            UNIQUE(productId, branchId)
        );
        
        CREATE TABLE IF NOT EXISTS pending_changes (
            id TEXT PRIMARY KEY,
            type TEXT,
            data TEXT,
            createdAt TEXT,
            branchId TEXT,
            synced INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_inventory_branch ON branch_inventory(branchId);
        CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_changes(synced);
    `);
    
    return db;
}

function getAllData() {
    return {
        products: db.prepare('SELECT * FROM products WHERE isActive = 1').all(),
        inventory: db.prepare('SELECT * FROM branch_inventory').all(),
        syncMeta: db.prepare('SELECT * FROM sync_meta').all(),
    };
}

function getProducts(branchId: string) {
    return db.prepare(`
        SELECT p.*, bi.stock, bi.minStock, bi.updatedAt as stockUpdatedAt
        FROM products p
        LEFT JOIN branch_inventory bi ON p.id = bi.productId AND bi.branchId = ?
        WHERE p.isActive = 1
        ORDER BY p.name ASC
    `).all(branchId);
}

function saveProducts(branchId: string, products: any[]) {
    const productStmt = db.prepare(`
        INSERT OR REPLACE INTO products (id, name, barcode, price, cost, category, categoryId, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    
    const trans = db.transaction((prods: any[]) => {
        for (const p of prods) {
            productStmt.run(p.id, p.name, p.barcode, p.price, p.cost, p.category, p.categoryId);
        }
    });
    
    trans(products);
}

function getStock(branchId: string) {
    return db.prepare(`
        SELECT bi.*, p.name as productName, p.barcode
        FROM branch_inventory bi
        JOIN products p ON bi.productId = p.id
        WHERE bi.branchId = ?
        ORDER BY p.name ASC
    `).all(branchId);
}

function updateStock(productId: string, branchId: string, quantity: number) {
    const current = db.prepare(`
        SELECT stock FROM branch_inventory 
        WHERE productId = ? AND branchId = ?
    `).get(productId, branchId) as { stock: number } | undefined;
    
    const newStock = current ? current.stock + quantity : quantity;
    
    db.prepare(`
        INSERT OR REPLACE INTO branch_inventory (id, productId, branchId, stock, minStock, updatedAt)
        VALUES (?, ?, ?, ?, 0, datetime('now'))
    `).run(`${branchId}_${productId}`, productId, branchId, newStock);
}

function saveStock(branchId: string, inventory: any[]) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO branch_inventory (id, productId, branchId, stock, minStock, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    
    const trans = db.transaction((inv: any[]) => {
        for (const i of inv) {
            stmt.run(i.id || `${branchId}_${i.productId}`, i.productId, branchId, i.stock, i.minStock || 0);
        }
    });
    
    trans(inventory);
}

function getPendingChanges() {
    return db.prepare('SELECT * FROM pending_changes WHERE synced = 0 ORDER BY createdAt ASC').all();
}

function addPendingChange(change: { id: string; type: string; data: any; createdAt: string; branchId: string }) {
    db.prepare(`
        INSERT OR REPLACE INTO pending_changes (id, type, data, createdAt, branchId, synced)
        VALUES (?, ?, ?, ?, ?, 0)
    `).run(change.id, change.type, JSON.stringify(change.data), change.createdAt, change.branchId);
}

function markSynced(ids: string[]) {
    const stmt = db.prepare('UPDATE pending_changes SET synced = 1 WHERE id = ?');
    const trans = db.transaction((idList: string[]) => {
        for (const id of idList) stmt.run(id);
    });
    trans(ids);
}

function clearSyncedChanges() {
    db.prepare('DELETE FROM pending_changes WHERE synced = 1').run();
}

function getLastSync() {
    const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get('lastSync') as { value: string } | undefined;
    return row?.value;
}

function setLastSync(time: string) {
    db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run('lastSync', time);
}

ipcMain.handle('db-getAllData', () => getAllData());
ipcMain.handle('db-getProducts', (_event, branchId: string) => getProducts(branchId));
ipcMain.handle('db-saveProducts', (_event, branchId: string, products: any[]) => saveProducts(branchId, products));
ipcMain.handle('db-getStock', (_event, branchId: string) => getStock(branchId));
ipcMain.handle('db-updateStock', (_event, productId: string, branchId: string, quantity: number) => updateStock(productId, branchId, quantity));
ipcMain.handle('db-saveStock', (_event, branchId: string, inventory: any[]) => saveStock(branchId, inventory));
ipcMain.handle('db-getPendingChanges', () => getPendingChanges());
ipcMain.handle('db-addPendingChange', (_event, change: any) => addPendingChange(change));
ipcMain.handle('db-markSynced', (_event, ids: string[]) => markSynced(ids));
ipcMain.handle('db-clearSyncedChanges', () => clearSyncedChanges());
ipcMain.handle('db-getLastSync', () => getLastSync());
ipcMain.handle('db-setLastSync', (_event, time: string) => setLastSync(time));

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
    const userDataPath = app.getPath('userData');
    const dbPath = `file:${join(userDataPath, 'erp-market.db')}`;
    process.env.LOCAL_DATABASE_URL = dbPath;

    console.log(`[Electron] SQLite DB: ${dbPath}`);

    initDatabase(userDataPath);

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
