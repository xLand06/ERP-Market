import express from 'express';
import cors from 'cors';
import { errorHandler } from './core/middlewares/errorHandler';

// Module routers
import inventoryRouter from './modules/inventory/inventory.routes';
import salesRouter from './modules/sales/sales.routes';
import financeRouter from './modules/finance/finance.routes';
import usersRouter from './modules/users/users.routes';
import authRouter from './modules/auth/auth.routes';
import productsRouter from './modules/products/products.routes';
import categoriesRouter from './modules/categories/categories.routes';
import suppliersRouter from './modules/suppliers/suppliers.routes';
import cashRegisterRouter from './modules/cashRegister/cashRegister.routes';
import reportsRouter from './modules/reports/reports.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import searchRouter from './modules/search/search.routes';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/inventory', inventoryRouter);
app.use('/api/sales', salesRouter);
app.use('/api/finance', financeRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/cash-register', cashRegisterRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/search', searchRouter);

// Global error handler
app.use(errorHandler);

export default app;
