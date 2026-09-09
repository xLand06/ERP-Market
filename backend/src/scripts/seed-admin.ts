// =============================================================================
// SEED ADMIN — Crea el usuario admin inicial para un tenant nuevo.
//
// Uso (dentro del contenedor api-<slug>):
//   ADMIN_EMAIL=correo@ejemplo.com ADMIN_PASSWORD=abc123 npx ts-node src/scripts/seed-admin.ts
//
// Es IDEMPOTENTE: si el admin ya existe, no duplica.
// Crea: 1 sucursal por defecto + 1 usuario OWNER.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DIRECT_URL })),
});

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
        process.exit(1);
    }

    console.log(`[seed-admin] Creando admin para tenant...`);

    // 1. Sucursal por defecto (idempotente)
    const branch = await prisma.branch.upsert({
        where: { id: 'branch-default' },
        update: {},
        create: {
            id: 'branch-default',
            name: 'Sucursal Principal',
            code: 'SEDE-001',
            address: 'Dirección principal',
            phone: '',
        },
    });
    console.log(`[seed-admin] Sucursal: ${branch.name} (${branch.id})`);

    // 2. Usuario admin (idempotente por email)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`[seed-admin] Admin ya existe: ${existing.username} (${email}) — skip`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const admin = await prisma.user.create({
        data: {
            username,
            email,
            password: hashedPassword,
            nombre: 'Administrador',
            cedula: '00000000',
            cedulaType: 'V',
            role: 'OWNER',
            branchId: branch.id,
            isActive: true,
        },
    });

    console.log(`[seed-admin] Admin creado:`);
    console.log(`  Username : ${admin.username}`);
    console.log(`  Email    : ${admin.email}`);
    console.log(`  Role     : ${admin.role}`);
    console.log(`  Branch   : ${branch.name}`);
}

main()
    .catch((e) => {
        console.error('[seed-admin] Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
