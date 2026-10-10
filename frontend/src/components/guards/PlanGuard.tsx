import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';
import { checkPathAccess } from '../../lib/planConfig';
import toast from 'react-hot-toast';

interface PlanGuardProps {
    children: React.ReactNode;
}

export function PlanGuard({ children }: PlanGuardProps) {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);
    const token = useAuthStore((s) => s.token);
    const { settingsLoaded, isSettingsLoading, fetchSettings } = useConfigStore();

    // Disparar carga de configuración si aún no se ha cargado
    useEffect(() => {
        if (!settingsLoaded && !isSettingsLoading) {
            void fetchSettings();
        }
    }, [settingsLoaded, isSettingsLoading, fetchSettings]);

    if (location.pathname === '/' || location.pathname === '/dashboard') {
        return <>{children}</>;
    }

    // Si aún no tenemos usuario (pero hay token) o la configuración está cargando por primera vez,
    // esperamos un instante para evitar falsos positivos de bloqueo
    if (token && (!user || (!settingsLoaded && isSettingsLoading))) {
        return <>{children}</>;
    }

    const access = checkPathAccess(location.pathname, user?.role);

    if (!access.allowed) {
        if (access.reason === 'ROLE_FORBIDDEN') {
            toast.error('No tienes permisos asignados para acceder a este módulo.', {
                id: 'role-guard-blocked',
                duration: 4000,
            });
        } else {
            toast.error('Este módulo no está disponible en tu plan actual. Actualiza tu plan para desbloquearlo.', {
                id: 'plan-guard-blocked',
                duration: 4000,
            });
        }
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}