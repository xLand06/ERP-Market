import { resolve, join } from 'path';
import { is } from '@electron-toolkit/utils';
import type { Application } from 'express';
import type { Server } from 'http';

// =============================================================================
// EXPRESS BRIDGE
// Importa el app de Express del backend y lo levanta en 127.0.0.1:3001.
// Expone stopExpressServer() para graceful shutdown desde Electron.
// Solo se llama desde Electron Main Process (después de setear ELECTRON=true).
// =============================================================================

const ELECTRON_PORT = 3001;

let serverStarted = false;
let httpServer: Server | null = null;

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

    return new Promise((resolvePromise, reject) => {
        httpServer = expressApp.listen(ELECTRON_PORT, '127.0.0.1', () => {
            serverStarted = true;
            console.log(`[ERP-Market] Express local API → http://127.0.0.1:${ELECTRON_PORT}/api`);
            resolvePromise();
        });

        httpServer.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                // Puerto ya en uso — probablemente ya está corriendo (hot-reload)
                console.warn(`[ERP-Market] Puerto ${ELECTRON_PORT} en uso, reutilizando...`);
                serverStarted = true;
                resolvePromise();
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Detiene el servidor Express de forma graceful.
 * Se llama desde Electron antes de salir (app.on('before-quit')).
 */
export async function stopExpressServer(): Promise<void> {
    if (!httpServer) return;
    return new Promise((resolvePromise) => {
        httpServer!.close(() => {
            serverStarted = false;
            httpServer = null;
            console.log('[ERP-Market] Express server closed');
            resolvePromise();
        });
    });
}
