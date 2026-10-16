import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// The global test setup (src/__tests__/setup.ts) mocks the auth store for
// component tests. This suite asserts the REAL store behavior, so it imports
// the actual module through importActual instead of the global mock.
type AuthStoreModule = typeof import('./authStore');
let useAuthStore: AuthStoreModule['useAuthStore'];

beforeAll(async () => {
    const actual = await vi.importActual<AuthStoreModule>('./authStore');
    useAuthStore = actual.useAuthStore;
});

const owner = {
    id: 'user-owner-1',
    username: 'owner1',
    nombre: 'Dueño',
    role: 'OWNER' as const,
};

const sellerWithBranch = {
    id: 'user-seller-1',
    username: 'seller1',
    nombre: 'Vendedor',
    role: 'SELLER' as const,
    branchId: 'branch-1',
};

describe('authStore.setAuth — branch selection persistence', () => {
    beforeEach(() => {
        useAuthStore.getState().logout();
    });

    it('OWNER: preserves the selected branch when the same user re-authenticates (regression)', () => {
        useAuthStore.getState().setAuth('token-1', owner);
        useAuthStore.getState().setSelectedBranch('branch-centro');

        // Re-login / token refresh / support-token access with the same identity
        useAuthStore.getState().setAuth('token-2', owner);

        expect(useAuthStore.getState().selectedBranch).toBe('branch-centro');
    });

    it('OWNER: resets to "all" (null) for a fresh login with no previous selection', () => {
        useAuthStore.getState().setAuth('token-1', owner);
        expect(useAuthStore.getState().selectedBranch).toBeNull();
    });

    it('OWNER: resets when a different user logs in on the same device', () => {
        useAuthStore.getState().setAuth('token-1', owner);
        useAuthStore.getState().setSelectedBranch('branch-centro');

        useAuthStore.getState().setAuth('token-2', {
            id: 'user-owner-2',
            username: 'owner2',
            nombre: 'Otro Dueño',
            role: 'OWNER' as const,
        });

        expect(useAuthStore.getState().selectedBranch).toBeNull();
    });

    it('SELLER/MANAGER: branchId always wins and is never preserved from a previous value', () => {
        useAuthStore.getState().setAuth('token-1', sellerWithBranch);
        expect(useAuthStore.getState().selectedBranch).toBe('branch-1');

        // Re-auth with a different assigned branch → the server-side assignment wins
        useAuthStore.getState().setAuth('token-2', { ...sellerWithBranch, branchId: 'branch-2' });
        expect(useAuthStore.getState().selectedBranch).toBe('branch-2');
    });

    it('logout clears the selection so the next login starts fresh', () => {
        useAuthStore.getState().setAuth('token-1', owner);
        useAuthStore.getState().setSelectedBranch('branch-centro');

        useAuthStore.getState().logout();

        expect(useAuthStore.getState().selectedBranch).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
    });
});
