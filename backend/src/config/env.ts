import * as dotenv from 'dotenv';
import path from 'path';

// 1. Cargar el .env de desarrollo (en backend/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 2. Cargar el .env de producción empaquetado (en resources/backend/.env)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 3. Cargar un .env externo al lado del EXE para configuraciones dinámicas del cliente
const exeDir = process.env.ELECTRON === 'true' ? path.dirname(process.execPath) : process.cwd();
dotenv.config({ path: path.resolve(exeDir, '.env') });

export const env = {
    PORT: process.env.PORT || '3000',
    DATABASE_URL: process.env.DATABASE_URL || '',
    DIRECT_URL: process.env.DIRECT_URL || '',
    USE_LOCAL_DB: process.env.USE_LOCAL_DB || 'true',
    JWT_SECRET: process.env.JWT_SECRET || 'changeme',
    NODE_ENV: process.env.NODE_ENV || 'development',
};
