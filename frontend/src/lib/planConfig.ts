import { useConfigStore } from '@/hooks/useConfigStore';

export type PlanType = 'BASICO' | 'PRO' | 'PREMIUM';
export type RoleType = 'OWNER' | 'SELLER';

export interface PlanConfig {
    allowedPaths: string[];
}

export interface RoleConfig {
    allowedPaths: string[];
}

export interface PlanLimits {
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
}

export const DEFAULT_PLAN_LIMITS: Record<PlanType, PlanLimits> = {
    BASICO: { maxUsers: 2, maxBranches: 1, maxProducts: 500 },
    PRO: { maxUsers: 6, maxBranches: 2, maxProducts: 99999 },
    PREMIUM: { maxUsers: 999, maxBranches: 5, maxProducts: 99999 },
};

const getActivePlanFromEnv = (): PlanType => {
    const envPlan = (import.meta.env.VITE_PLAN_MODE || '').toUpperCase();
    if (envPlan === 'PREMIUM') return 'PREMIUM';
    if (envPlan === 'PRO' || envPlan === 'FULL') return 'PRO';
    return 'BASICO';
};

export const ACTIVE_PLAN = getActivePlanFromEnv();

export const normalizePlanType = (raw?: string | null): PlanType => {
    const p = (raw || '').toUpperCase().trim();
    if (p === 'PREMIUM') return 'PREMIUM';
    if (p === 'PRO' || p === 'FULL') return 'PRO';
    return 'BASICO';
};

export const getEffectivePlan = (): PlanType => {
    try {
        const storeTier = useConfigStore.getState().planTier;
        if (storeTier) return normalizePlanType(storeTier);
    } catch {
        // Fallback si zustand aún no montó
    }
    return ACTIVE_PLAN;
};

export const getPlanLimits = (planType?: PlanType): PlanLimits => {
    const plan = planType ?? getEffectivePlan();
    try {
        const configStr = useConfigStore.getState().planConfig;
        if (configStr) {
            const parsed = JSON.parse(configStr);
            return {
                maxUsers: parsed.maxUsers ?? DEFAULT_PLAN_LIMITS[plan].maxUsers,
                maxBranches: parsed.maxBranches ?? DEFAULT_PLAN_LIMITS[plan].maxBranches,
                maxProducts: parsed.maxProducts ?? DEFAULT_PLAN_LIMITS[plan].maxProducts,
            };
        }
    } catch {}
    return DEFAULT_PLAN_LIMITS[plan];
};

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

export const isPathAllowed = (path: string, userRole?: RoleType, planType?: PlanType): boolean => {
    if (!userRole) return false;
    
    const roleConfig = ROLE_CONFIG[userRole];
    if (!roleConfig) return false;
    
    const isRoleAllowed = roleConfig.allowedPaths.some(p => path.startsWith(p));
    if (!isRoleAllowed) return false;

    // Verificar además contra el plan activo dinámico
    const effectivePlan = planType ?? getEffectivePlan();
    const planConfig = PLANS[effectivePlan];
    if (!planConfig) return true;

    return planConfig.allowedPaths.some(p => path.startsWith(p));
};