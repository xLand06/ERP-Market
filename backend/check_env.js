require('dotenv').config();
const url = process.env.LOCAL_DATABASE_URL || 'file:./erp-market.db';
console.log('LOCAL_DATABASE_URL:', url);
console.log('CWD:', process.cwd());
