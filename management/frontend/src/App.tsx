import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Payments from './pages/Payments';

interface AuthState {
    token: string;
    user: { username: string; role: string };
}

export default function App() {
    const [auth, setAuth] = useState<AuthState | null>(null);

    // Restaurar sesión desde localStorage
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
        localStorage.setItem('mgmt_user', JSON.stringify(user));
        setAuth({ token, user });
    }, []);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('mgmt_token');
        localStorage.removeItem('mgmt_user');
        setAuth(null);
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
                    <Route path="/payments" element={<Payments />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}
