import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// El script está en desktop/scripts/ — el backend está en la raíz del workspace
const workspaceRoot = path.resolve(__dirname, '..', '..');
const backendPath = path.join(workspaceRoot, 'backend');
const tempBackendPath = path.join(workspaceRoot, 'temp-backend');

console.log('🔄 Sincronizando temp-backend para empaquetado seguro...');

// 1. Crear temp-backend si no existe
if (!fs.existsSync(tempBackendPath)) {
    fs.mkdirSync(tempBackendPath, { recursive: true });
}

// 2. Copiar package.json y limpiar scripts peligrosos
const pkgJson = JSON.parse(fs.readFileSync(path.join(backendPath, 'package.json'), 'utf-8'));
if (pkgJson.scripts && pkgJson.scripts.postinstall) {
    delete pkgJson.scripts.postinstall; // Evitar que db:setup corra automáticamente
}
fs.writeFileSync(path.join(tempBackendPath, 'package.json'), JSON.stringify(pkgJson, null, 4));

// 3. Copiar carpeta prisma
const prismaSrc = path.join(backendPath, 'prisma');
const prismaDest = path.join(tempBackendPath, 'prisma');
if (fs.existsSync(prismaDest)) {
    fs.rmSync(prismaDest, { recursive: true, force: true });
}
fs.cpSync(prismaSrc, prismaDest, { recursive: true });

// 4. Ejecutar npm install en temp-backend
console.log('📦 Instalando dependencias en temp-backend (sin symlinks)...');
execSync('npm install', { cwd: tempBackendPath, stdio: 'inherit' });

// 5. Generar clientes de Prisma
console.log('⚙️ Generando clientes de Prisma...');
execSync('npx prisma generate', { cwd: tempBackendPath, stdio: 'inherit' });
execSync('npx prisma generate --schema=prisma/schema.local.prisma', { cwd: tempBackendPath, stdio: 'inherit' });

// 6. Prune dev dependencies para aligerar el instalador
console.log('🧹 Limpiando dependencias de desarrollo para reducir el tamaño del EXE...');
execSync('npm prune --omit=dev', { cwd: tempBackendPath, stdio: 'inherit' });

// 7. Eliminar motores de Prisma innecesarios para achicar el peso (schema-engine pesa ~40MB y solo sirve en dev)
console.log('🗑️ Eliminando motores de desarrollo de Prisma innecesarios (schema-engine)...');
const enginesDir = path.join(tempBackendPath, 'node_modules', '@prisma', 'engines');
if (fs.existsSync(enginesDir)) {
    try {
        const files = fs.readdirSync(enginesDir);
        for (const file of files) {
            if (file.startsWith('schema-engine')) {
                const filePath = path.join(enginesDir, file);
                console.log(`  - Borrando: ${file}`);
                fs.rmSync(filePath, { force: true });
            }
        }
    } catch (err) {
        console.warn('⚠️ No se pudieron limpiar algunos motores de Prisma (no crítico):', err.message);
    }
}

console.log('✅ temp-backend actualizado y listo para empaquetar.');
