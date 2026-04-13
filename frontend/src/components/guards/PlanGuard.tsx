import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isPathAllowed } from '../../lib/planConfig';

interface PlanGuardProps {
    children: React.ReactNode;
}

export function PlanGuard({ children }: PlanGuardProps) {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);

    if (location.pathname === '/') return <>{children}</>;

    if (!isPathAllowed(location.pathname, user?.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}