import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
    PORT: process.env.PORT || '3000',
    DATABASE_URL: process.env.DATABASE_URL || '',
    DIRECT_URL: process.env.DIRECT_URL || '',
    USE_LOCAL_DB: process.env.USE_LOCAL_DB || 'true',
    JWT_SECRET: process.env.JWT_SECRET || 'changeme',
    NODE_ENV: process.env.NODE_ENV || 'development',
};
