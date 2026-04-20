/**
 * Find all SQLite DB files and check their products table schema
 */
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createClient } from '@libsql/client';

function findDb(dir, results = []) {
    try {
        for (const f of readdirSync(dir)) {
            if (f === 'node_modules' || f === '.git') continue;
            const full = join(dir, f);
            try {
                const s = statSync(full);
                if (s.isDirectory()) findDb(full, results);
                else if (f.endsWith('.db')) results.push(full);
            } catch {}
        }
    } catch {}
    return results;
}

const root = resolve('../..');
const dbs = findDb(root);
console.log('Found DB files:', dbs);

for (const dbPath of dbs) {
    try {
        const client = createClient({ url: `file:${dbPath}` });
        const cols = await client.execute(`PRAGMA table_info(products)`);
        const names = cols.rows.map(r => r.name);
        const hasBaseUnit = names.includes('baseUnit');
        console.log(`\n📂 ${dbPath}`);
        console.log(`   Columns: ${names.join(', ')}`);
        console.log(`   Has baseUnit: ${hasBaseUnit ? '✅' : '❌'}`);
        await client.close();
    } catch (err) {
        console.log(`   ⚠️ Could not read: ${err.message}`);
    }
}
