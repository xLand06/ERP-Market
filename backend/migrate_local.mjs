/**
 * Migration script — adds missing columns to the local SQLite DB
 * Run with: node migrate_local.mjs
 */
import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:./erp-market.db' });

async function migrate() {
    console.log('🔍 Checking products table schema...');

    const cols = await client.execute(`PRAGMA table_info(products)`);
    const colNames = cols.rows.map((r) => r.name);
    console.log('Current columns:', colNames.join(', '));

    if (!colNames.includes('baseUnit')) {
        console.log('➕ Adding missing column: baseUnit');
        await client.execute(`ALTER TABLE products ADD COLUMN "baseUnit" TEXT NOT NULL DEFAULT 'UNIDAD'`);
        console.log('✅ Column baseUnit added successfully!');
    } else {
        console.log('✅ Column baseUnit already exists, no migration needed.');
    }

    // Verify it's there now
    const verify = await client.execute(`PRAGMA table_info(products)`);
    console.log('\nFinal table columns:');
    verify.rows.forEach((r) => console.log(`  - ${r.name} (${r.type})`));

    await client.close();
    console.log('\n🎉 Migration complete!');
}

migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
