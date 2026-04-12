import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function main() {
    console.log('🌱 Conectando a Supabase...\n');
    
    try {
        await client.connect();
        console.log('✅ Conectado!');
        
        const hash = await bcrypt.hash('admin', 10);
        
        const existing = await client.query('SELECT username FROM users WHERE username = $1', ['admin']);
        
        if (existing.rows.length > 0) {
            console.log('⚠️ Admin ya existe, actualizando...');
            await client.query(
                'UPDATE users SET password = $1, nombre = $2, role = $3 WHERE username = $4',
                [hash, 'Administrador', 'OWNER', 'admin']
            );
            console.log('✅ Contraseña actualizada');
        } else {
            console.log('➕ Creando usuario admin...');
            
            // Incluir todos los campos requeridos
            await client.query(
                `INSERT INTO users (id, username, cedula, "cedulaType", nombre, email, password, role, "isActive", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
                ['admin', '12345678', 'V', 'Administrador', 'admin@erp-market.com', hash, 'OWNER', true]
            );
            console.log('✅ Usuario admin creado');
        }
        
        console.log('\n🔑 Credenciales: admin / admin');
        
    } catch (e: any) {
        console.log('❌ Error:', e.message);
    } finally {
        await client.end();
    }
}

main();