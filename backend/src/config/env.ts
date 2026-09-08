import * as dotenv from 'dotenv';
import path from 'path';

// 1. Cargar el .env de desarrollo (en backend/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 2. Cargar el .env de producción empaquetado (en resources/backend/.env)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 3. Cargar un .env externo al lado del EXE para configuraciones dinámicas del cliente
const exeDir = process.env.ELECTRON === 'true' ? path.dirname(process.execPath) : process.cwd();
dotenv.config({ path: path.resolve(exeDir, '.env') });

const rawJwtSecret = process.env.JWT_SECRET || 'changeme';

// En producción, JWT_SECRET es OBLIGATORIO — no aceptar el default
if (rawJwtSecret === 'changeme' && process.env.NODE_ENV === 'production') {
    throw new Error(
        '[FATAL] JWT_SECRET no configurado. ' +
        'Establecé JWT_SECRET en el .env o variables de entorno. ' +
        'NO USES "changeme" en producción.'
    );
}

export type DeployMode = 'server' | 'desktop' | 'mobile';

// Resolución de DEPLOY_MODE:
//   1. Valor explícito de DEPLOY_MODE gana (server | desktop | mobile)
//   2. ELECTRON=true sin valor explícito → desktop (retrocompatibilidad desktop)
//   3. Sin valor y sin Electron → server (el VPS es el caso común)
const rawDeployMode = process.env.DEPLOY_MODE?.toLowerCase();
const isElectronEnv = process.env.ELECTRON === 'true';
export const DEPLOY_MODE: DeployMode =
    rawDeployMode === 'server' || rawDeployMode === 'desktop' || rawDeployMode === 'mobile'
        ? rawDeployMode
        : isElectronEnv
            ? 'desktop'
            : 'server';

export const env = {
    DEPLOY_MODE,
    PORT: process.env.PORT || '3000',
    DATABASE_URL: process.env.DATABASE_URL || '',
    DIRECT_URL: process.env.DIRECT_URL || '',
    USE_LOCAL_DB: process.env.USE_LOCAL_DB || 'true',
    JWT_SECRET: rawJwtSecret,
    NODE_ENV: process.env.NODE_ENV || 'development',
};
