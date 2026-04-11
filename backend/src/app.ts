import express from 'express';
import cors from 'cors';
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

const app = express();

// ─── BACKGROUND SYNC (Electron Only) ─────────────────────────────────────────
if (process.env.ELECTRON === 'true') {
    startSyncWorker(300000); // 5 minutes
}

// ─── MIDDLEWARES GLOBALES ───────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
app.use(express.json());
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
app.use('/api/categories', categoriesRouter);
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

// ─── 404 HANDLER ───────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── ERROR HANDLER GLOBAL ───────────────────────────────────────────────────
app.use(errorHandler);

export default app;