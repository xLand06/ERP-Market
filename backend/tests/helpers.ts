// =============================================================================
// TEST HELPERS — Auth tokens, request builders
// =============================================================================

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export function createTestToken(userId: string, role: string, branchId?: string) {
    return jwt.sign(
        { id: userId, role, branchId: branchId || null },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

export function authHeaders(userId: string, role: string, branchId?: string) {
    const token = createTestToken(userId, role, branchId);
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export function ownerHeaders(userId: string, branchId?: string) {
    return authHeaders(userId, 'OWNER', branchId);
}

export function sellerHeaders(userId: string, branchId?: string) {
    return authHeaders(userId, 'SELLER', branchId);
}
