import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    branchId?: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    selectedBranch: string | null;
    setAuth: (token: string, user: User) => void;
    setSelectedBranch: (branchId: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            selectedBranch: null,
            setAuth: (token, user) => {
                // Si el usuario trae su branch asignado, seleccionarlo por defecto
                set({ token, user, selectedBranch: user.role === 'SELLER' && user.branchId ? user.branchId : null });
            },
            setSelectedBranch: (branchId) => set({ selectedBranch: branchId }),
            logout: () => set({ token: null, user: null, selectedBranch: null }),
        }),
        { name: 'erp-market-auth' }
    )
);
