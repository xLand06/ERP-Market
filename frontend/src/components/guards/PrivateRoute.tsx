import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

export function PrivateRoute({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token);
    if (!token) return <Navigate to="/login" replace />;
    return <>{children}</>;
}
