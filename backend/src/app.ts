import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './core/middlewares/errorHandler';
import logger from './core/utils/logger';

// ─── MÓDULOS ACTIVOS (Plan Base) ───────────────────────────────────────────
import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import branchesRouter from './modules/branches/branches.routes';
import categoriesRouter from './modules/categories/categories.routes';
import productsRouter from './modules/products/products.routes';
import inventoryRouter from './modules/inventory/inventory.routes';
import posRouter from './modules/pos/pos.routes';
import cashFlowRouter from './modules/cashFlow/cashFlow.routes';
import salesRouter from './modules/sales/sales.routes';
import suppliersRouter from './modules/suppliers/suppliers.routes';
import purchasesRouter from './modules/purchases/purchases.routes';
import financeRouter from './modules/finance/finance.routes';
import reportsRouter from './modules/reports/reports.routes';
import searchRouter from './modules/search/search.routes';
import auditRouter from './modules/audit/audit.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import syncRouter from './modules/sync/sync.routes';
import { startSyncWorker } from './modules/sync/sync-worker';
import backupRouter from './modules/backup/backup.routes';

const app = express();

// ─── BACKGROUND SYNC (Sistema Híbrido) ─────────────────────────────────────────
// Sync worker para sistema híbrido SQLite + Supabase
// Intervalo: 15 minutos (900000ms)
startSyncWorker(900000);

// ─── MIDDLEWARES GLOBALES ───────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Permitir peticiones sin origen (como apps móviles o curl)
        if (!origin) return callback(null, true);

        const allowedUrls = process.env.FRONTEND_URL 
            ? process.env.FRONTEND_URL.split(',') 
            : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173'];

        // Regex para permitir localhost en cualquier puerto de Vite (5170-5189)
        const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1):51[7-8][0-9]$/.test(origin);

        // Regex para red local (IPs privadas)
        const isLocalNetwork = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):51[7-8][0-9]$/.test(origin);

        if (allowedUrls.includes(origin) || allowedUrls.includes('*') || isLocalDevelopment || isLocalNetwork) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error(`CORS not allowed for origin: ${origin}`));
        }
    },
    credentials: true,
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── REQUEST LOGGING ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http({ method: req.method, url: req.url, ip: req.ip }, {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
        });
    });
    
    next();
});

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'ERP-MARKET API' });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────
app.use('/api/auth',       authRouter);
app.use('/api/users',      usersRouter);
app.use('/api/branches',   branchesRouter);
app.use('/api/groups', categoriesRouter);
app.use('/api/products',   productsRouter);
app.use('/api/inventory',  inventoryRouter);
app.use('/api/pos',        posRouter);
app.use('/api/cash-flow',  cashFlowRouter);
app.use('/api/sales',      salesRouter);
app.use('/api/suppliers',  suppliersRouter);
app.use('/api/purchases',  purchasesRouter);
app.use('/api/finance',    financeRouter);
app.use('/api/reports',    reportsRouter);
app.use('/api/search',     searchRouter);
app.use('/api/audit',      auditRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/sync',       syncRouter);
app.use('/api/backup',     backupRouter);

// ─── 404 HANDLER ───────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── ERROR HANDLER GLOBAL ───────────────────────────────────────────────────
app.use(errorHandler);

export default app;