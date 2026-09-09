/**
 * Seed script — creates the initial admin operator user.
 *
 * Usage:
 *   npx ts-node src/seed.ts
 *   # or inside Docker:
 *   docker exec mgmt-api npx ts-node src/seed.ts
 *
 * The admin credentials are hardcoded in auth.service.ts:
 *   username: admin
 *   password: admin123
 *
 * This script verifies the auth flow works end-to-end.
 */

import { login } from './modules/auth/auth.service';

async function seed() {
    console.log('[seed] Verificando usuario admin...');

    try {
        const result = await login('admin', 'admin123');
        console.log('[seed] Login exitoso:');
        console.log(`  username: ${result.user.username}`);
        console.log(`  role: ${result.user.role}`);
        console.log(`  token: ${result.token.substring(0, 20)}...`);
        console.log('[seed] Admin operator listo.');
    } catch (error) {
        console.error('[seed] Error:', error);
        process.exit(1);
    }
}

seed();
