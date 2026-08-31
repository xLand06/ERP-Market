import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        testTimeout: 30000,
        hookTimeout: 30000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '.prisma/client-local': path.resolve(__dirname, 'node_modules/.prisma/client-local'),
        },
    },
});
