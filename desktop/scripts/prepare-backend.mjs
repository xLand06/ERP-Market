import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '..');
const backendPath = path.join(rootPath, 'backend');
const tempBackendPath = path.join(rootPath, 'temp-backend');

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

console.log('✅ temp-backend actualizado y listo para empaquetar.');
