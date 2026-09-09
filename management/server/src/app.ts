import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { prisma } from './config/prisma';
import authRoutes from './modules/auth/auth.routes';
import tenantsRoutes from './modules/tenants/tenants.routes';

const app = express();

// Middleware global
app.use(cors({
    origin: env.NODE_ENV === 'production'
        ? ['https://admin.erpmarket.com']
        : ['http://localhost:5173', 'http://localhost:3000'],
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

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantsRoutes);
// app.use('/api/payments', paymentsRoutes);   // Batch 2
// app.use('/api/audit', auditRoutes);         // Batch 2

// Middleware de errores
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[mgmt-server] Error no manejado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar server
app.listen(env.PORT, () => {
    console.log(`[mgmt-server] Escuchando en puerto ${env.PORT}`);
    console.log(`[mgmt-server] Entorno: ${env.NODE_ENV}`);
});

export default app;
