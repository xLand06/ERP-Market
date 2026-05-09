/**
 * Migration: adds paymentMethods column to transactions table
 * Run with: node add_payment_methods.mjs
 */
import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:./erp-market.db' });

async function migrate() {
    console.log('🔍 Checking transactions table schema...');

    const cols = await client.execute(`PRAGMA table_info(transactions)`);
    const colNames = cols.rows.map((r) => r.name);
    console.log('Current columns:', colNames.join(', '));

    if (!colNames.includes('paymentMethods')) {
        console.log('➕ Adding missing column: paymentMethods');
        await client.execute(`ALTER TABLE transactions ADD COLUMN "paymentMethods" TEXT`);
        console.log('✅ Column paymentMethods added!');
    } else {
        console.log('✅ paymentMethods already exists.');
    }

    if (!colNames.includes('currency')) {
        console.log('➕ Adding missing column: currency');
        await client.execute(`ALTER TABLE transactions ADD COLUMN "currency" TEXT`);
        console.log('✅ Column currency added!');
    }

    if (!colNames.includes('exchangeRate')) {
        console.log('➕ Adding missing column: exchangeRate');
        await client.execute(`ALTER TABLE transactions ADD COLUMN "exchangeRate" REAL`);
        console.log('✅ Column exchangeRate added!');
    }

    if (!colNames.includes('invoiceNumber')) {
        console.log('➕ Adding missing column: invoiceNumber');
        await client.execute(`ALTER TABLE transactions ADD COLUMN "invoiceNumber" TEXT`);
        console.log('✅ Column invoiceNumber added!');
    }

    const verify = await client.execute(`PRAGMA table_info(transactions)`);
    console.log('\nFinal transactions columns:');
    verify.rows.forEach((r) => console.log(`  - ${r.name} (${r.type})`));

    await client.close();
    console.log('\n🎉 Migration complete!');
}

migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
