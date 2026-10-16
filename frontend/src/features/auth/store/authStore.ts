import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    username: string;
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    role: 'OWNER' | 'MANAGER' | 'SELLER';
    canManageInventory?: boolean;
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
                set((prev) => {
                    const isBranched =
                        (user.role === 'SELLER' || user.role === 'MANAGER') && Boolean(user.branchId);
                    // OWNERs pick any branch freely: keep their persisted selection when the
                    // same user re-authenticates, so a re-login (or support-token access) does
                    // not silently fall back to "Todas las sucursales". Only reset when the
                    // user identity actually changes or on logout.
                    const preserved =
                        !isBranched && prev.user?.id === user.id ? prev.selectedBranch : null;
                    return {
                        token,
                        user,
                        selectedBranch: isBranched ? (user.branchId as string) : preserved,
                    };
                });
            },
            setSelectedBranch: (branchId) => set({ selectedBranch: branchId }),
            logout: () => set({ token: null, user: null, selectedBranch: null }),
        }),
        { 
            name: 'erp-market-auth',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                selectedBranch: state.selectedBranch,
            }),
            storage: {
                getItem: (name) => {
                    if ((window as any).erpApi?.isElectron) {
                        return (window as any).erpApi.store.get(name);
                    }
                    const value = localStorage.getItem(name);
                    return value ? JSON.parse(value) : null;
                },
                setItem: (name, value) => {
                    if ((window as any).erpApi?.isElectron) {
                        return (window as any).erpApi.store.set(name, value);
                    }
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    if ((window as any).erpApi?.isElectron) {
                        return (window as any).erpApi.store.delete(name);
                    }
                    localStorage.removeItem(name);
                }
            }
        }
    )
);