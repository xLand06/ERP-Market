/**
 * TEST HELPERS — JWT generation for test tokens
 */

import jwt from 'jsonwebtoken';

// ── JWT Secret for tests (matches env.ts default) ────────────────────────────
const TEST_JWT_SECRET = 'changeme';

/**
 * Create a test JWT token for a user.
 */
export const createTestToken = (userId: string, role: 'OWNER' | 'SELLER', extra: Record<string, any> = {}): string => {
    return jwt.sign(
        {
            id: userId,
            role,
            name: 'Test User',
            email: 'test@test.com',
            branchId: 'branch-test-a',
            canManageInventory: false,
            ...extra,
        },
        TEST_JWT_SECRET,
        { expiresIn: '12h' }
    );
};

/**
 * Get auth headers for an OWNER user.
 */
export const loginAsOwner = (): Record<string, string> => {
    return {
        Authorization: `Bearer ${createTestToken('user-owner-test', 'OWNER')}`,
    };
};

/**
 * Get auth headers for a SELLER user.
 */
export const loginAsSeller = (): Record<string, string> => {
    return {
        Authorization: `Bearer ${createTestToken('user-seller-test', 'SELLER')}`,
    };
};

/**
 * Get auth headers for an inactive user.
 */
export const loginAsInactive = (): Record<string, string> => {
    return {
        Authorization: `Bearer ${createTestToken('user-inactive', 'SELLER')}`,
    };
};
