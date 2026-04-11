import { prisma } from '../src/config/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('🌱 Creando usuario admin...\n');

    const hashedPassword = await bcrypt.hash('admin', 10);

    try {
        const owner = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                cedula: '12345678',
                cedulaType: 'V',
                nombre: 'Administrador',
                email: 'admin@erp-market.com',
                password: hashedPassword,
                role: 'OWNER',
            },
        });
        console.log('✅ Usuario OWNER creado:', owner.username);
        console.log('\n🔑 Credenciales: admin / admin');
    } catch (e: any) {
        console.log('Error:', e.message);
    }

    await prisma.$disconnect();
}

main();