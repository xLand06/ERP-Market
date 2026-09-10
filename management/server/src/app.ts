import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { authMiddleware } from './middlewares/auth';
import authRoutes from './modules/auth/auth.routes';
import tenantsRoutes from './modules/tenants/tenants.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import auditRoutes from './modules/audit/audit.routes';
import healthRoutes from './modules/health/health.routes';
import { startHealthCron, startAuditRetention } from './services/health-cron';
import { getVpsStats } from './services/vps-stats';
import { ensureNetwork } from './services/provisioner';

const app = express();

// Middleware global
app.use(cors({
    origin: env.NODE_ENV === 'production'
        ? ['https://admin.erpmarket.com', 'https://mgmt.erpmarket.com']
        : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());

// Health check público (sin auth)
app.get('/api/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
        });
    }
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/health', healthRoutes);

// GET /api/vps/stats — estadísticas del servidor VPS
app.get('/api/vps/stats', authMiddleware, (_req, res) => {
    try {
        const stats = getVpsStats();
        res.json(stats);
    } catch (error) {
        console.error('[mgmt-server] Error obteniendo stats VPS:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas del servidor' });
    }
});

// Servir frontend estático (production build)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback — rutas no-API sirven index.html
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// Middleware de errores
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[mgmt-server] Error no manejado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar server
app.listen(env.PORT, async () => {
    console.log(`[mgmt-server] Escuchando en puerto ${env.PORT}`);
    console.log(`[mgmt-server] Entorno: ${env.NODE_ENV}`);

    // Asegurar red de Docker para tenants
    try {
        await ensureNetwork();
    } catch (err) {
        console.error('[mgmt-server] Error asegurando red erp_proxy:', err);
    }

    // Iniciar crons solo en producción o desarrollo (no en tests)
    startHealthCron();
    startAuditRetention();
});

export default app;
