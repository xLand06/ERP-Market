import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Payments from './pages/Payments';
import Registrations from './pages/Registrations';

import { UNAUTHORIZED_EVENT } from './api';

interface AuthState {
    token: string;
    user: { username: string; role: string };
}

export default function App() {
    const [auth, setAuth] = useState<AuthState | null>(null);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('mgmt_token');
        localStorage.removeItem('mgmt_user');
        setAuth(null);
    }, []);

    // Listen for 401 unauthorized events across the application
    useEffect(() => {
        const handleUnauthorized = () => {
            handleLogout();
        };
        window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    }, [handleLogout]);

    // Restore session from localStorage
    useEffect(() => {
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
    }, []);

    const handleLogin = useCallback((token: string, user: { username: string; role: string }) => {
        localStorage.setItem('mgmt_token', token);
        localStorage.setItem('mgmt_user', JSON.stringify(user));
        setAuth({ token, user });
    }, []);

    // No autenticado — mostrar login
    if (!auth) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <BrowserRouter>
            <Layout onLogout={handleLogout}>
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
