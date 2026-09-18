export type PlanType = 'BASICO' | 'PRO' | 'PREMIUM';
export type RoleType = 'OWNER' | 'SELLER';

export interface PlanConfig {
    allowedPaths: string[];
}

export interface RoleConfig {
    allowedPaths: string[];
}

const getActivePlanFromEnv = (): PlanType => {
    const envPlan = (import.meta.env.VITE_PLAN_MODE || '').toUpperCase();
    if (envPlan === 'PREMIUM') return 'PREMIUM';
    if (envPlan === 'PRO' || envPlan === 'FULL') return 'PRO';
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
            '/cash-registers',
            '/cash-register',
            '/audit',
            '/users',
            '/settings',
            '/merma'
        ]
    },
    PRO: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/inventory/stocktaking',
            '/products',
            '/sales',
            '/finance/cash-register',
            '/cash-registers',
            '/cash-register',
            '/audit',
            '/users',
            '/settings',
            '/merma',
            '/customers',
            '/suppliers',
            '/purchases',
            '/reports'
        ]
    },
    PREMIUM: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/inventory/stocktaking',
            '/products',
            '/products/categories',
            '/sales',
            '/finance',
            '/finance/cash-register',
            '/cash-registers',
            '/cash-register',
            '/audit',
            '/users',
            '/settings',
            '/merma',
            '/customers',
            '/suppliers',
            '/purchases',
            '/reports',
            '/quotes',
            '/banks',
            '/catalogo',
            '/catalog'
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
            '/inventory/stocktaking',
            '/products',
            '/products/categories',
            '/sales',
            '/finance',
            '/finance/cash-register',
            '/cash-registers',
            '/cash-register',
            '/audit',
            '/users',
            '/settings',
            '/merma',
            '/customers',
            '/suppliers',
            '/purchases',
            '/reports',
            '/quotes',
            '/banks',
            '/catalogo',
            '/catalog'
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
            '/cash-registers',
            '/cash-register',
            '/merma',
            '/settings'
        ]
    }
};

export const isPathAllowed = (path: string, userRole?: RoleType, planType: PlanType = ACTIVE_PLAN): boolean => {
    if (!userRole) return false;
    
    const roleConfig = ROLE_CONFIG[userRole];
    if (!roleConfig) return false;
    
    const isRoleAllowed = roleConfig.allowedPaths.some(p => path.startsWith(p));
    if (!isRoleAllowed) return false;

    // Verificar además contra el plan activo
    const planConfig = PLANS[planType];
    if (!planConfig) return true;

    return planConfig.allowedPaths.some(p => path.startsWith(p));
};