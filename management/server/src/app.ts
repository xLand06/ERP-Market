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
import { startPaymentCron } from './services/payment-cron';
import { getVpsStats, pruneDockerSystem } from './services/vps-stats';
import { createAuditEntry } from './modules/audit/audit.service';
import { ensureNetwork } from './services/provisioner';
import billingRoutes from './modules/billing/billing.routes';
import trialsRoutes from './modules/trials/trials.routes';
import publicCatalogRoutes from './modules/public-catalog/public-catalog.routes';
import { sendEmailWithResend } from './services/notifications';

const app = express();

// Middleware global
app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sin origin (Electron, server-to-server, curl)
        if (!origin) return callback(null, true);
        // Permitir allcode.site y subdominios, sslip.io y desarrollo
        if (
            /\.allcode\.site$/.test(origin) || 
            origin === 'https://allcode.site' ||
            /\.sslip\.io$/.test(origin) ||
            origin.includes('89.167.46.144')
        ) {
            return callback(null, true);
        }
        // Permitir origins de desarrollo
        if (env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        callback(null, false);
    },
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
// /api/auth, /api/health, POST /api/trials y GET /api/resolve-business son publicos; /api/billing valida por tenant secret
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/trials', trialsRoutes);
app.use('/api/public-catalog', publicCatalogRoutes);
app.use('/api/tenants', authMiddleware, tenantsRoutes);
app.use('/api/payments', authMiddleware, paymentsRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/health', healthRoutes);

// ── Resolve Business — público, sin auth ─────────────────────────────────────
// La APK usa esto para resolver un código de negocio a la URL del tenant.
app.get('/api/resolve-business', async (req, res) => {
    try {
        const code = (req.query.code as string || '').trim().toLowerCase();
        if (!code) {
            return res.status(400).json({ error: 'Falta el parámetro code' });
        }
        const tenant = await prisma.tenant.findFirst({
            where: {
                OR: [
                    { slug: code },
                    { slug: code.toLowerCase() },
                ],
                status: 'ACTIVE',
            },
            select: { slug: true, url: true, domain: true, product: true },
        });
        if (!tenant || !tenant.url) {
            return res.status(404).json({ error: 'Negocio no encontrado o inactivo' });
        }
        res.json({
            slug: tenant.slug,
            url: tenant.url,
            domain: tenant.domain,
            product: tenant.product || 'market',
        });
    } catch (err: any) {
        console.error('[mgmt-server] Error en resolve-business:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

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

// POST /api/vps/docker-prune — Limpieza segura de imágenes huérfanas y caché builder de Docker
app.post('/api/vps/docker-prune', authMiddleware, async (req, res) => {
    try {
        const result = pruneDockerSystem();

        await createAuditEntry({
            actor: req.user?.username || 'admin',
            action: 'DOCKER_PRUNE',
            details: {
                success: result.success,
                reclaimedSpace: result.reclaimedSpace || '0B',
                output: result.output,
            },
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error durante la limpieza de Docker',
                output: result.output,
                reclaimedSpace: result.reclaimedSpace,
            });
        }

        const stats = getVpsStats();
        res.json({
            success: true,
            message: 'Limpieza de Docker completada',
            output: result.output,
            reclaimedSpace: result.reclaimedSpace,
            stats,
        });
    } catch (error: any) {
        console.error('[mgmt-server] Error ejecutando docker-prune:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al ejecutar la limpieza de Docker',
        });
    }
});

// POST /api/vps/test-email — Envío de correo de prueba para verificar Resend
app.post('/api/vps/test-email', authMiddleware, async (req, res) => {
    try {
        const to = req.body?.to || req.user?.username;
        if (!to || !to.includes('@')) {
            return res.status(400).json({ error: 'Debes proporcionar un email válido en el campo "to"' });
        }

        const result = await sendEmailWithResend({
            to,
            subject: 'Prueba de conexión exitosa — ALL MARKET',
            html: `
                <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #059669; margin-top: 0;">¡Servicio de Correo Conectado con Éxito!</h2>
                    <p style="font-size: 15px; line-height: 1.6;">Este es un correo de prueba enviado desde la API de gestión de <strong>ALL MARKET</strong> a través de <strong>Resend</strong>.</p>
                    <p style="font-size: 14px; color: #475569;">Tu dominio <code>allcode.site</code> está correctamente autenticado con firmas DKIM y SPF, y listo para despachar avisos automáticos a clientes.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">ALLCODE &bull; ALL MARKET Platform</p>
                </div>
            `,
            text: '¡Servicio de Correo Conectado con Éxito! Correo de prueba enviado desde ALL MARKET.',
        });

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({
            success: true,
            message: `Correo de prueba enviado exitosamente a ${to}`,
            id: result.id,
        });
    } catch (error: any) {
        console.error('[mgmt-server] Error enviando correo de prueba:', error);
        res.status(500).json({ error: error.message || 'Error al enviar correo de prueba' });
    }
});

// Servir frontend estático (production build)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// ── Descargas de installers (EXE / AppImage) ────────────────────────────────
// Sirve /repo/deploy/downloads (montado desde el host). Los installers son
// compartidos (UN solo EXE/AppImage para todos los tenants).
const downloadsDir = process.env.DEPLOY_DIR
    ? path.join(process.env.DEPLOY_DIR, 'downloads')
    : '/repo/deploy/downloads';
app.use('/downloads', express.static(downloadsDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.exe')) res.setHeader('Content-Type', 'application/x-msdownload');
        if (filePath.endsWith('.AppImage')) res.setHeader('Content-Type', 'application/octet-stream');
    },
}));

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
    startPaymentCron();
});

export default app;
