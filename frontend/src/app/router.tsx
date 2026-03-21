import { createBrowserRouter, redirect } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { PrivateRoute } from '../components/guards/PrivateRoute';

// Lazy-loaded feature pages
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const InventoryPage = lazy(() => import('../features/inventory/pages/InventoryPage'));
const BatchesPage = lazy(() => import('../features/inventory/pages/BatchesPage'));
const POSPage = lazy(() => import('../features/pos/pages/POSPage'));
const SalesHistoryPage = lazy(() => import('../features/sales/pages/SalesHistoryPage'));
const FinancePage = lazy(() => import('../features/finance/pages/FinancePage'));
const CashRegisterPage = lazy(() => import('../features/finance/pages/CashRegisterPage'));
const ProductsPage = lazy(() => import('../features/products/pages/ProductsPage'));
const CategoriesPage = lazy(() => import('../features/products/pages/CategoriesPage'));
const SuppliersPage = lazy(() => import('../features/suppliers/pages/SuppliersPage'));
const UsersPage = lazy(() => import('../features/users/pages/UsersPage'));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage'));
const NotFoundPage = lazy(() => import('../features/notFound/pages/NotFoundPage'));

const wrap = (Component: React.ComponentType) => (
    <Suspense fallback={<div>Cargando...</div>}>
        <Component />
    </Suspense>
);

export const router = createBrowserRouter([
    { path: '/login', element: wrap(LoginPage) },
    {
        path: '/',
        element: <PrivateRoute><AppLayout /></PrivateRoute>,
        children: [
            { index: true, loader: () => redirect('/dashboard') },
            { path: 'dashboard', element: wrap(DashboardPage) },
            { path: 'inventory', element: wrap(InventoryPage) },
            { path: 'inventory/batches', element: wrap(BatchesPage) },
            { path: 'pos', element: wrap(POSPage) },
            { path: 'sales', element: wrap(SalesHistoryPage) },
            { path: 'finance', element: wrap(FinancePage) },
            { path: 'finance/cash-register', element: wrap(CashRegisterPage) },
            { path: 'products', element: wrap(ProductsPage) },
            { path: 'products/categories', element: wrap(CategoriesPage) },
            { path: 'suppliers', element: wrap(SuppliersPage) },
            { path: 'users', element: wrap(UsersPage) },
            { path: 'reports', element: wrap(ReportsPage) },
        ],
    },
    { path: '*', element: wrap(NotFoundPage) },
]);
