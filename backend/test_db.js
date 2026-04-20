const Database = require('better-sqlite3');
const db = new Database('./erp-market.db');
console.log(db.pragma('table_info(products)'));
