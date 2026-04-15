import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
    vesRate: number;
    iva: number;
    setVesRate: (rate: number) => void;
    setIva: (iva: number) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set) => ({
            vesRate: 36.50, // Valor inicial por defecto
            iva: 0.16,
            setVesRate: (rate) => set({ vesRate: rate }),
            setIva: (iva) => set({ iva: iva }),
        }),
        {
            name: 'erp-config-storage',
        }
    )
);
