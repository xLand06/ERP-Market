const path = require('path');

// ─── Ruta de la DB en el package ────────────────────────────────────────────
const dbPath = path.resolve(__dirname, 'standalone/ALLMARKET/backend/erp-market.db');
console.log('Creando schema en:', dbPath);

const Database = require('better-sqlite3');
const db = new Database(dbPath);

// Crear todas las tablas del schema local
db.exec(`
  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT DEFAULT '',
    address TEXT,
    phone TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sub_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    groupId TEXT NOT NULL REFERENCES groups(id),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    barcode TEXT,
    price REAL NOT NULL,
    cost REAL,
    baseUnit TEXT NOT NULL DEFAULT 'unidad',
    imageUrl TEXT,
    isActive INTEGER DEFAULT 1,
    subGroupId TEXT REFERENCES sub_groups(id),
    expectedSpoilagePercent REAL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_presentations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    multiplier REAL NOT NULL,
    price REAL NOT NULL,
    barcode TEXT,
    productId TEXT NOT NULL REFERENCES products(id),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_barcodes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    label TEXT,
    productId TEXT NOT NULL REFERENCES products(id),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    cedula TEXT NOT NULL,
    cedulaType TEXT DEFAULT 'V',
    nombre TEXT NOT NULL,
    apellido TEXT,
    email TEXT,
    password TEXT NOT NULL,
    telefono TEXT,
    role TEXT NOT NULL DEFAULT 'SELLER',
    isActive INTEGER DEFAULT 1,
    branchId TEXT REFERENCES branches(id),
    canManageInventory INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    rate REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS branch_inventory (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL REFERENCES products(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    stock REAL DEFAULT 0,
    minStock REAL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(productId, branchId)
  );

  CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'OPEN',
    openingAmount REAL NOT NULL,
    closingAmount REAL,
    expectedAmount REAL,
    difference REAL,
    notes TEXT,
    openedAt DATETIME NOT NULL,
    closedAt DATETIME,
    userId TEXT NOT NULL REFERENCES users(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    syncStatus TEXT DEFAULT 'PENDING',
    syncedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    total REAL NOT NULL,
    notes TEXT,
    ipAddress TEXT,
    currency TEXT DEFAULT 'COP',
    exchangeRate REAL,
    invoiceNumber TEXT,
    paymentMethods TEXT,
    userId TEXT NOT NULL REFERENCES users(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    cashRegisterId TEXT REFERENCES cash_registers(id),
    syncStatus TEXT DEFAULT 'PENDING',
    syncedAt DATETIME,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id TEXT PRIMARY KEY,
    transactionId TEXT NOT NULL REFERENCES transactions(id),
    productId TEXT NOT NULL REFERENCES products(id),
    presentationId TEXT REFERENCES product_presentations(id),
    quantity REAL NOT NULL,
    multiplierUsed REAL DEFAULT 1,
    unitPrice REAL NOT NULL,
    subtotal REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT REFERENCES users(id),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mermas (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL REFERENCES products(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    createdById TEXT NOT NULL REFERENCES users(id),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    syncStatus TEXT DEFAULT 'PENDING',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_counts (
    id TEXT PRIMARY KEY,
    branchId TEXT NOT NULL REFERENCES branches(id),
    createdById TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    syncStatus TEXT DEFAULT 'PENDING',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_count_items (
    id TEXT PRIMARY KEY,
    stockCountId TEXT NOT NULL REFERENCES stock_counts(id),
    productId TEXT NOT NULL REFERENCES products(id),
    expectedStock REAL NOT NULL,
    countedStock REAL NOT NULL,
    difference REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_batches (
    id TEXT PRIMARY KEY,
    batchCode TEXT NOT NULL,
    productId TEXT NOT NULL REFERENCES products(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    quantity REAL NOT NULL,
    costPrice REAL,
    expiryDate DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    supplierId TEXT REFERENCES suppliers(id),
    branchId TEXT NOT NULL REFERENCES branches(id),
    createdById TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    total REAL,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    purchaseOrderId TEXT NOT NULL REFERENCES purchase_orders(id),
    productId TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unitCost REAL NOT NULL,
    subtotal REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size REAL,
    type TEXT NOT NULL DEFAULT 'manual',
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('✅ Schema creado. Tablas:', tables.length);
tables.forEach(t => console.log('   -', t.name));
db.close();
