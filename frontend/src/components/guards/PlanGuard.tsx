import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';
import { isPathAllowed } from '../../lib/planConfig';
import toast from 'react-hot-toast';

interface PlanGuardProps {
    children: React.ReactNode;
}

export function PlanGuard({ children }: PlanGuardProps) {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);
    const { planTier, fetchSettings } = useConfigStore();

    // Cargar settings si planTier es 'basic' (default) — puede ser real o aún no cargado
    useEffect(() => {
        if (planTier === 'basic') {
            fetchSettings();
        }
    }, []);

    if (location.pathname === '/') return <>{children}</>;

    if (!isPathAllowed(location.pathname, user?.role)) {
        toast.error('Este módulo no está disponible en tu plan actual. Actualiza tu plan para desbloquearlo.', {
            id: 'plan-guard-blocked',
            duration: 4000,
        });
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}