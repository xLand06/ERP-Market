const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'erp-market.db');
console.log('Checking database at:', dbPath);

try {
    const db = new sqlite3(dbPath);
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    console.log('Columns in products table:');
    tableInfo.forEach(col => {
        console.log(`- ${col.name} (${col.type})`);
    });
    db.close();
} catch (error) {
    console.error('Error:', error.message);
}
