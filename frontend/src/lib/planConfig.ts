export type PlanType = 'BASICO' | 'FULL';

export interface PlanConfig {
    allowedPaths: string[];
}

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
            '/suppliers',
            '/users',
            '/reports',
            '/purchases',
            '/directory',
            '/audit'
        ]
    }
};

// Configuración actual solicitada por el cliente
export const ACTIVE_PLAN: PlanType = 'BASICO';

export const isPathAllowed = (path: string): boolean => {
    const config = PLANS[ACTIVE_PLAN];
    // Exact match or prefix match for nested routes if needed
    // In this case, we check if the path starts with any allowed path
    return config.allowedPaths.some(p => path.startsWith(p));
};
