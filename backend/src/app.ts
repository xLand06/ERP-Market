import express from 'express';
import cors from 'cors';
import { errorHandler } from './core/middlewares/errorHandler';

// ─── MÓDULOS ACTIVOS (Plan Base) ───────────────────────────────────────────
import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import branchesRouter from './modules/branches/branches.routes';
import inventoryRouter from './modules/inventory/inventory.routes';
import posRouter from './modules/pos/pos.routes';
import cashFlowRouter from './modules/cashFlow/cashFlow.routes';
import auditRouter from './modules/audit/audit.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';

const app = express();

// ─── MIDDLEWARES GLOBALES ───────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'ERP-MARKET API' });
});

// ─── API ROUTES ────────────────────────────────────────────────────────────
app.use('/api/auth',       authRouter);
app.use('/api/users',      usersRouter);
app.use('/api/branches',   branchesRouter);
app.use('/api/inventory',  inventoryRouter);
app.use('/api/pos',        posRouter);
app.use('/api/cash-flow',  cashFlowRouter);
app.use('/api/audit',      auditRouter);
app.use('/api/dashboard',  dashboardRouter);

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ─── ERROR HANDLER GLOBAL ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;
