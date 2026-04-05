import { resolve } from 'path';
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

    // Importación dinámica del app de Express mediante ts-node.
    // Esto permite que el Main Process en Node interprete la carpeta backend/ 
    // al vuelo en tiempo real sin requerir compilación estricta.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('ts-node').register({ 
        transpileOnly: true,
        project: resolve(__dirname, '../../../backend/tsconfig.json')
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const backendPath = resolve(__dirname, '../../../backend/src/app.ts');
    const { default: app } = require(backendPath);

    return new Promise((resolve, reject) => {
        const server = app.listen(ELECTRON_PORT, '127.0.0.1', () => {
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
