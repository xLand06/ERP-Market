import { Navigate, useLocation } from 'react-router-dom';
import { isPathAllowed } from '../../lib/planConfig';

interface PlanGuardProps {
    children: React.ReactNode;
}

/**
 * PlanGuard: Silently redirects to /dashboard if the current plan 
 * does not include the requested route.
 */
export function PlanGuard({ children }: PlanGuardProps) {
    const { pathname } = useLocation();

    // Special case for root which redirects to dashboard anyway
    if (pathname === '/') return <>{children}</>;

    if (!isPathAllowed(pathname)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
