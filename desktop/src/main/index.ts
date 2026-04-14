process.env.ELECTRON = 'true';

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { is } from '@electron-toolkit/utils';
import { startExpressServer } from './express-bridge';
import Store from 'electron-store';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

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

let db: SqlJsDatabase;
let dbPath: string;

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
}

function queryAll(sql: string, params: any[] = []): any[] {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
        stmt.bind(params);
    }
    const results: any[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
    }
    stmt.free();
    return results;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
        stmt.bind(params);
    }
    let row: any = undefined;
    if (stmt.step()) {
        row = stmt.getAsObject();
    }
    stmt.free();
    return row;
}

function runSql(sql: string, params: any[] = []) {
    db.run(sql, params);
}

async function initDatabase(userDataPath: string) {
    dbPath = join(userDataPath, 'erp-market.db');
    
    const SQL = await initSqlJs();
    
    if (existsSync(dbPath)) {
        const fileBuffer = readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    
    db.run(`
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
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS branch_inventory (
            id TEXT PRIMARY KEY,
            productId TEXT,
            branchId TEXT,
            stock INTEGER DEFAULT 0,
            minStock INTEGER DEFAULT 0,
            updatedAt TEXT,
            UNIQUE(productId, branchId)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS pending_changes (
            id TEXT PRIMARY KEY,
            type TEXT,
            data TEXT,
            createdAt TEXT,
            branchId TEXT,
            synced INTEGER DEFAULT 0
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_branch ON branch_inventory(branchId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_changes(synced)`);
    
    saveDatabase();
    
    return db;
}

function getAllData() {
    return {
        products: queryAll('SELECT * FROM products WHERE isActive = 1'),
        inventory: queryAll('SELECT * FROM branch_inventory'),
        syncMeta: queryAll('SELECT * FROM sync_meta'),
    };
}

function purgeDatabase() {
    runSql('DELETE FROM branch_inventory');
    runSql('DELETE FROM products');
    runSql('DELETE FROM pending_changes');
    runSql('DELETE FROM sync_meta');
    saveDatabase();
}

function getProducts(branchId: string) {
    return queryAll(`
        SELECT p.*, bi.stock, bi.minStock, bi.updatedAt as stockUpdatedAt
        FROM products p
        LEFT JOIN branch_inventory bi ON p.id = bi.productId AND bi.branchId = ?
        WHERE p.isActive = 1
        ORDER BY p.name ASC
    `, [branchId]);
}

function saveProducts(branchId: string, products: any[]) {
    for (const p of products) {
        runSql(`
            INSERT OR REPLACE INTO products (id, name, barcode, price, cost, category, categoryId, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `, [p.id, p.name, p.barcode, p.price, p.cost, p.category, p.categoryId]);
    }
    saveDatabase();
}

function getStock(branchId: string) {
    return queryAll(`
        SELECT bi.*, p.name as productName, p.barcode
        FROM branch_inventory bi
        JOIN products p ON bi.productId = p.id
        WHERE bi.branchId = ?
        ORDER BY p.name ASC
    `, [branchId]);
}

function updateStock(product: any, branchId: string, quantity: number, minStock: number = 0) {
    // 1. Asegurar que el producto existe localmente
    runSql(`
        INSERT OR REPLACE INTO products (id, name, barcode, price, cost, category, categoryId, isActive, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `, [product.id, product.name, product.barcode || '', product.price, product.cost || 0, product.category || 'Varios', product.categoryId || null]);

    // 2. Calcular nuevo stock
    const current = queryOne(`
        SELECT stock FROM branch_inventory 
        WHERE productId = ? AND branchId = ?
    `, [product.id, branchId]);
    
    // Si queremos que sea absoluto (como en el modal), usamos quantity directamente.
    // Si queremos que sea incremento, sumamos. 
    // Usaremos absoluto para "Entrada Manual" si así lo pide el flujo del modal.
    const newStock = quantity; 
    
    runSql(`
        INSERT OR REPLACE INTO branch_inventory (id, productId, branchId, stock, minStock, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [`${branchId}_${product.id}`, product.id, branchId, newStock, minStock]);
    
    saveDatabase();
}

function saveStock(branchId: string, inventory: any[]) {
    for (const i of inventory) {
        runSql(`
            INSERT OR REPLACE INTO branch_inventory (id, productId, branchId, stock, minStock, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [i.id || `${branchId}_${i.productId}`, i.productId, branchId, i.stock, i.minStock || 0]);
    }
    saveDatabase();
}

function getPendingChanges() {
    return queryAll('SELECT * FROM pending_changes WHERE synced = 0 ORDER BY createdAt ASC');
}

function addPendingChange(change: { id: string; type: string; data: any; createdAt: string; branchId: string }) {
    runSql(`
        INSERT OR REPLACE INTO pending_changes (id, type, data, createdAt, branchId, synced)
        VALUES (?, ?, ?, ?, ?, 0)
    `, [change.id, change.type, JSON.stringify(change.data), change.createdAt, change.branchId]);
    saveDatabase();
}

function markSynced(ids: string[]) {
    for (const id of ids) {
        runSql('UPDATE pending_changes SET synced = 1 WHERE id = ?', [id]);
    }
    saveDatabase();
}

function clearSyncedChanges() {
    runSql('DELETE FROM pending_changes WHERE synced = 1');
    saveDatabase();
}

function getLastSync() {
    const row = queryOne('SELECT value FROM sync_meta WHERE key = ?', ['lastSync']);
    return row?.value;
}

function setLastSync(time: string) {
    runSql('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', ['lastSync', time]);
    saveDatabase();
}

ipcMain.handle('db-getAllData', () => getAllData());
ipcMain.handle('db-getProducts', (_event, branchId: string) => getProducts(branchId));
ipcMain.handle('db-saveProducts', (_event, branchId: string, products: any[]) => saveProducts(branchId, products));
ipcMain.handle('db-getStock', (_event, branchId: string) => getStock(branchId));
ipcMain.handle('db-updateStock', (_event, product: any, branchId: string, quantity: number, minStock: number) => updateStock(product, branchId, quantity, minStock));
ipcMain.handle('db-saveStock', (_event, branchId: string, inventory: any[]) => saveStock(branchId, inventory));
ipcMain.handle('db-purge', () => purgeDatabase());
ipcMain.handle('db-getPendingChanges', () => getPendingChanges());
ipcMain.handle('db-addPendingChange', (_event, change: any) => addPendingChange(change));
ipcMain.handle('db-markSynced', (_event, ids: string[]) => markSynced(ids));
ipcMain.handle('db-clearSyncedChanges', () => clearSyncedChanges());
ipcMain.handle('db-getLastSync', () => getLastSync());
ipcMain.handle('db-setLastSync', (_event, time: string) => setLastSync(time));

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

app.whenReady().then(async () => {
    const userDataPath = app.getPath('userData');
    
    if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
    }
    
    const dbFileName = 'erp-market.db';
    const fullDbPath = join(userDataPath, dbFileName);
    process.env.LOCAL_DATABASE_URL = `file:${fullDbPath}`;

    console.log(`[Electron] SQLite DB: ${fullDbPath}`);

    await initDatabase(userDataPath);

    await startExpressServer();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});