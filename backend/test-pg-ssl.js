const { Pool } = require('pg');

async function test() {
    console.log('Testing pool connection...');
    const pool = new Pool({
        user: 'postgres',
        password: 'password',
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        max: 5,
    });

    try {
        await pool.connect();
        console.log('Success');
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
