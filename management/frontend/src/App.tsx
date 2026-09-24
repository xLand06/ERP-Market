import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Payments from './pages/Payments';
import Registrations from './pages/Registrations';
import StoreCatalogPage from './pages/StoreCatalogPage';

import { UNAUTHORIZED_EVENT } from './api';

interface AuthState {
    token: string;
    user: { username: string; role: string };
}

// Detect if we're on the public catalog domain
const isCatalogDomain = () => {
    const host = window.location.hostname;
    return host === 'allmarket.allcode.site' || host.startsWith('allmarket.');
};

// Public catalog routes (no auth needed)
function CatalogRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/:slug" element={<StoreCatalogPage />} />
                <Route path="/" element={
                    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                        <div className="text-center max-w-sm">
                            <h1 className="text-2xl font-black text-slate-900 mb-2">ALL MARKET</h1>
                            <p className="text-sm text-slate-500">Directorio de tiendas. Agrega el nombre de tu tienda a la URL.</p>
                        </div>
                    </div>
                } />
            </Routes>
        </BrowserRouter>
    );
}

// Admin panel routes (auth required)
function AdminRouter({ onLogout }: { onLogout: () => void }) {
    return (
        <BrowserRouter>
            <Layout onLogout={onLogout}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tenants" element={<Tenants />} />
                    <Route path="/tenants/:slug" element={<TenantDetail />} />
                    <Route path="/registrations" element={<Registrations />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default function App() {
    const [auth, setAuth] = useState<AuthState | null>(null);
    const [catalogMode] = useState(isCatalogDomain());

    const handleLogout = useCallback(() => {
        localStorage.removeItem('mgmt_token');
        localStorage.removeItem('mgmt_user');
        setAuth(null);
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => handleLogout();
        window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    }, [handleLogout]);

    useEffect(() => {
        if (catalogMode) return; // Skip auth for catalog domain
        const token = localStorage.getItem('mgmt_token');
        const userStr = localStorage.getItem('mgmt_user');
        if (token && userStr) {
            try {
                setAuth({ token, user: JSON.parse(userStr) });
            } catch {
                localStorage.removeItem('mgmt_token');
                localStorage.removeItem('mgmt_user');
            }
        }
    }, [catalogMode]);

    const handleLogin = useCallback((token: string, user: { username: string; role: string }) => {
        localStorage.setItem('mgmt_token', token);
        localStorage.setItem('mgmt_user', JSON.stringify(user));
        setAuth({ token, user });
    }, []);

    // Catalog domain — public routes, no auth
    if (catalogMode) {
        return <CatalogRouter />;
    }

    // Admin domain — requires auth
    if (!auth) {
        return <Login onLogin={handleLogin} />;
    }

    return <AdminRouter onLogout={handleLogout} />;
}
