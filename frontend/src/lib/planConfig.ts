export type PlanType = 'BASICO' | 'FULL';
export type RoleType = 'OWNER' | 'SELLER';

export interface PlanConfig {
    allowedPaths: string[];
}

export interface RoleConfig {
    allowedPaths: string[];
}

const getActivePlanFromEnv = (): PlanType => {
    const envPlan = import.meta.env.VITE_PLAN_MODE;
    if (envPlan === 'FULL') return 'FULL';
    return 'BASICO';
};

export const ACTIVE_PLAN = getActivePlanFromEnv();

export const PLANS: Record<PlanType, PlanConfig> = {
    BASICO: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/products',
            '/sales',
            '/finance/cash-register',
            '/audit',
            '/users',
            '/settings'
        ]
    },
    FULL: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/finance',
            '/finance/cash-register',
            '/products',
            '/products/categories',
            '/users',
            '/settings',
            '/suppliers',
            '/reports',
            '/purchases',
            '/directory',
            '/audit',
            '/sales'
        ]
    }
};

export const ROLE_CONFIG: Record<RoleType, RoleConfig> = {
    OWNER: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/products',
            '/products/categories',
            '/sales',
            '/finance',
            '/finance/cash-register',
            '/audit',
            '/users',
            '/settings'
        ]
    },
    SELLER: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/products',
            '/sales',
            '/finance/cash-register',
            '/directory'
        ]
    }
};

export const isPathAllowed = (path: string, userRole?: RoleType): boolean => {
    if (!userRole) return false;
    
    const roleConfig = ROLE_CONFIG[userRole];
    if (!roleConfig) return false;
    
    return roleConfig.allowedPaths.some(p => path.startsWith(p));
};