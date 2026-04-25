import { resolve, join } from 'path';
import { is } from '@electron-toolkit/utils';
import type { Application } from 'express';

// =============================================================================
// EXPRESS BRIDGE
// Importa el app de Express del backend y lo levanta en 127.0.0.1:3001.
// Solo se llama desde Electron Main Process (después de setear ELECTRON=true).
// =============================================================================

const ELECTRON_PORT = 3001;

let serverStarted = false;

export async function startExpressServer(): Promise<void> {
    if (serverStarted) return;

    let expressApp: Application;
    
    if (is.dev) {
        // Importación dinámica del app de Express mediante ts-node en DESARROLLO.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('ts-node').register({ 
            transpileOnly: true,
            project: resolve(__dirname, '../../../backend/tsconfig.json')
        });
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const backendPath = resolve(__dirname, '../../../backend/src/app.ts');
        expressApp = require(backendPath).default;
    } else {
        // En PRODUCCIÓN, cargar el JS ya compilado en la carpeta resources/backend
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const backendPath = join(process.resourcesPath, 'backend', 'app.js');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        expressApp = require(backendPath).default;
    }

    return new Promise((resolve, reject) => {
        const server = expressApp.listen(ELECTRON_PORT, '127.0.0.1', () => {
            serverStarted = true;
            console.log(`[ERP-Market] Express local API → http://127.0.0.1:${ELECTRON_PORT}/api`);
            resolve();
        });

        server.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                // Puerto ya en uso — probablemente ya está corriendo (hot-reload)
                console.warn(`[ERP-Market] Puerto ${ELECTRON_PORT} en uso, reutilizando...`);
                serverStarted = true;
                resolve();
            } else {
                reject(err);
            }
        });
    });
}
