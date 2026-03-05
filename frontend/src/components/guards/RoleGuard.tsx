import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/authStore';

type Role = 'ADMIN' | 'CAJERO' | 'ALMACENISTA';

interface Props {
    children: React.ReactNode;
    allowedRoles: Role[];
}

export function RoleGuard({ children, allowedRoles }: Props) {
    const user = useAuthStore((s) => s.user);
    if (!user || !allowedRoles.includes(user.role as Role)) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
}
