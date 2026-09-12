/**
 * offline-queue.ts — Cola de ventas offline con IndexedDB
 *
 * Cuando el backend no está disponible, las ventas se guardan localmente
 * y se sincronizan cuando la conexión vuelve.
 *
 * IndexedDB es persistente, sobrevive recargas y cierres de pestaña.
 */

const DB_NAME = 'allmarket-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-sales';

export interface PendingSale {
    id: string;                    // UUID local
    payload: any;                  // El payload completo de la venta
    createdAt: string;             // ISO timestamp
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    attempts: number;              // Intentos de sync
    lastError?: string;            // Último error de sync
}

/**
 * Abre (o crea) la base de datos IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Agrega una venta a la cola offline
 */
export async function enqueueSale(payload: any): Promise<string> {
    const id = crypto.randomUUID();
    const sale: PendingSale = {
        id,
        payload,
        createdAt: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
    };

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(sale);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Obtiene todas las ventas pendientes
 */
export async function getPendingSales(): Promise<PendingSale[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('status');
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Marca una venta como sincronizando
 */
export async function markSyncing(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const sale = getReq.result;
            if (sale) {
                sale.status = 'syncing';
                sale.attempts++;
                store.put(sale);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Marca una venta como sincronizada (éxito)
 */
export async function markSynced(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const sale = getReq.result;
            if (sale) {
                sale.status = 'synced';
                store.put(sale);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Marca una venta como fallida
 */
export async function markFailed(id: string, error: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const sale = getReq.result;
            if (sale) {
                sale.status = 'failed';
                sale.lastError = error;
                store.put(sale);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Elimina ventas sincronizadas de la cola (limpieza)
 */
export async function cleanupSynced(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('status');
        const request = index.openCursor('synced');
        let count = 0;
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                cursor.delete();
                count++;
                cursor.continue();
            }
        };
        tx.oncomplete = () => resolve(count);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Cuenta ventas pendientes (para el badge del sync widget)
 */
export async function countPending(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('status');
        const request = index.count('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Drena la cola: envía todas las ventas pendientes al backend
 * Retorna { sent, failed }
 */
export async function drainQueue(
    sendFn: (payload: any) => Promise<void>
): Promise<{ sent: number; failed: number }> {
    const pending = await getPendingSales();
    let sent = 0;
    let failed = 0;

    for (const sale of pending) {
        try {
            await markSyncing(sale.id);
            await sendFn(sale.payload);
            await markSynced(sale.id);
            sent++;
        } catch (error: any) {
            await markFailed(sale.id, error.message || 'Sync failed');
            failed++;
        }
    }

    // Limpiar ventas sincronizadas
    await cleanupSynced();

    return { sent, failed };
}
