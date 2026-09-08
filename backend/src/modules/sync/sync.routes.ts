import { Router, Response } from 'express';
import { runSyncCycle, getLastSuccessfulSync } from './sync-worker';
import { prisma, getLocalPrisma, getCloudPrisma } from '../../config/prisma';
import { checkCloudConnection } from './connectivity.service';
import { getSyncStatus } from './status.service';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { DEPLOY_MODE } from '../../config/env';

const router = Router();

// En DEPLOY_MODE=server el backend ES la nube: no hay SQLite local ni sync.
// Estos endpoints solo aplican a dispositivos (Electron/móvil), pero el web UI
// los consulta en login, así que responden con estado benigno en vez de 404.
const SERVER_MODE_INITIAL_STATUS = {
    success: true,
    data: {
        needsInitialSync: false,
        hasCloudData: true,
        isOnline: true,
        lastSyncAt: null,
        isSyncing: false,
        stage: 'ready',
    },
};

// ─── Rutas PÚBLICAS (sin autenticación) ──────────────────────────────────────
// /initial-status debe ser pública porque se llama ANTES de que existan
// usuarios en la DB local (primer inicio sin seed).

// Endpoint para detectar primer inicio y estado del sync inicial
router.get('/initial-status', async (_req, res) => {
    try {
        if (DEPLOY_MODE === 'server') { res.json(SERVER_MODE_INITIAL_STATUS); return; }
        const localPrisma = getLocalPrisma();
        const lastSync = getLastSuccessfulSync();
        const isOnline = await checkCloudConnection();

        // Detectar si ya se hizo sync desde la nube:
        // La DB inicia VACÍA (solo schema, sin seed). Si hay algún dato,
        // es porque ya se descargó de la nube en un sync anterior.
        // Los thresholds son una red de seguridad por si lastSync se pierde.
        const [branchCount, userCount, groupCount, productCount] = await Promise.all([
            localPrisma.branch.count(),
            localPrisma.user.count(),
            localPrisma.product.count(),
            localPrisma.group.count(),
        ]);

        const SEED_THRESHOLDS = {
            branches: 2,  // Sede A + Sede B
            users: 2,     // admin + vendedor
            groups: 3,    // Bebidas, Alimentos, Limpieza
            products: 7,  // 7 productos demo
        };

        const hasCloudData = (
            branchCount > SEED_THRESHOLDS.branches ||
            userCount > SEED_THRESHOLDS.users ||
            groupCount > SEED_THRESHOLDS.groups ||
            productCount > SEED_THRESHOLDS.products
        );

        // Primer inicio: seed data + nunca sync → needsSync
        const needsInitialSync = !hasCloudData && lastSync === null;

        res.json({
            success: true,
            data: {
                needsInitialSync,
                hasCloudData,
                isOnline,
                lastSyncAt: lastSync?.toISOString() ?? null,
                isSyncing: false,
                stage: needsInitialSync
                    ? (isOnline ? 'connecting' : 'offline')
                    : 'ready',
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint público para disparar sync manual (desde login, sin token)
// runSyncCycle tiene su propio mutex (isSyncing), múltiples llamadas son seguras
router.post('/trigger', async (_req, res) => {
    try {
        if (DEPLOY_MODE === 'server') { res.json({ success: true, message: 'Sync not applicable in server mode' }); return; }
        runSyncCycle();
        res.json({ success: true, message: 'Sync cycle triggered' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Rutas PROTEGIDAS (requieren autenticación) ──────────────────────────────
router.use(authMiddleware);

// Endpoint status de sync
router.get('/status', async (_req, res) => {
    try {
        if (DEPLOY_MODE === 'server') {
            res.json({
                success: true,
                data: {
                    lastSyncAt: null,
                    database: { products: 0, groups: 0, subGroups: 0, users: 0, branches: 0 },
                    sync: {
                        transactions: { pending: 0, synced: 0, failed: 0 },
                        cashRegisters: { pending: 0, synced: 0 },
                        totalPending: 0,
                    },
                    config: { deployMode: 'server', syncIntervalMs: 0 },
                    isOnline: true,
                },
            });
            return;
        }
        const isOnline = await checkCloudConnection();
        const status = await getSyncStatus();
        res.json({ 
            success: true, 
            data: {
                ...status,
                isOnline,
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint de diagnóstico de conexión
router.get('/debug-connection', async (_req, res) => {
    try {
        const debugInfo: any = {
            env: {
                DATABASE_URL: !!process.env.DATABASE_URL,
                DIRECT_URL: !!process.env.DIRECT_URL,
                USE_LOCAL_DB: process.env.USE_LOCAL_DB,
                DATABASE_URL_value: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : null,
            },
            cloudPrisma: null,
            localPrisma: null,
            connectionTests: {}
        };

        // Test cloud prisma
        try {
            const cloud = getCloudPrisma();
            debugInfo.cloudPrisma = cloud ? 'initialized' : 'null';
            if (cloud) {
                await cloud.$queryRaw`SELECT 1`;
                debugInfo.connectionTests.cloud = 'SUCCESS';
            }
        } catch (err: any) {
            debugInfo.connectionTests.cloud = 'FAILED: ' + err.message;
        }

        // Test local prisma
        try {
            const local = getLocalPrisma();
            debugInfo.localPrisma = local ? 'initialized' : 'null';
            if (local) {
                await local.$queryRaw`SELECT 1`;
                debugInfo.connectionTests.local = 'SUCCESS';
            }
        } catch (err: any) {
            debugInfo.connectionTests.local = 'FAILED: ' + err.message;
        }

        // Get pending counts from local
        try {
            const localPrisma = getLocalPrisma();
            const [pendingTransactions, pendingRegisters] = await Promise.all([
                localPrisma.transaction.count({ where: { syncStatus: 'PENDING' } }),
                localPrisma.cashRegister.count({ where: { syncStatus: 'PENDING' } })
            ]);
            debugInfo.pendingLocal = {
                transactions: pendingTransactions,
                cashRegisters: pendingRegisters
            };
        } catch (err: any) {
            debugInfo.pendingLocal = 'ERROR: ' + err.message;
        }

        // Test Supabase connection again for final status
        const isOnline = await checkCloudConnection();
        debugInfo.isOnline = isOnline;

        res.json({ success: true, data: debugInfo });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Danger Zone: Full Database Purge (Solo OWNER)
router.post('/purge', roleGuard('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        console.warn('--- INIT SYSTEM PURGE ---');
        
        // Clear main tables in transaction if possible, or sequential
        await prisma.$transaction([
            prisma.branchInventory.deleteMany({}),
            prisma.transactionItem.deleteMany({}),
            prisma.transaction.deleteMany({}),
            prisma.auditLog.deleteMany({}),
            prisma.product.deleteMany({}),
            prisma.subGroup.deleteMany({}),
            prisma.group.deleteMany({}),
        ]);

        await logAudit({
            action: 'SYSTEM_PURGE',
            module: 'sync',
            details: { message: 'Full database purge executed' },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        console.log('--- PURGE COMPLETED ---');
        res.json({ success: true, message: 'All data cleared from cloud database' });
    } catch (error: any) {
        console.error('Purge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
