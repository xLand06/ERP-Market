import('dotenv').then(dotenv => dotenv.config({ path: './.env' }));

import { PrismaClient, PrismaPg } from '@prisma/client/extension';
import bcrypt from 'bcryptjs';

const prisma = new (PrismaClient as any)({
    adapter: new (PrismaPg as any)({
        connectionString: process.env.DATABASE_URL
    })
});

async function create() {
    const hash = await bcrypt.hash('admin', 10);
    try {
        const user = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                cedula: '12345678',
                cedulaType: 'V',
                nombre: 'Administrador',
                email: 'admin@erp-market.com',
                password: hash,
                role: 'OWNER'
            }
        });
        console.log('✅ Admin created:', user.username);
    } catch(e: any) {
        console.log('Error:', e.message);
    }
    await prisma.$disconnect();
}

create();