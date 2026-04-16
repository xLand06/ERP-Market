import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface ExchangeRate {
    code: string;
    rate: number;
}

interface ConfigState {
    rates: Record<string, number>;
    iva: number;
    // Convenience getters
    vesRate: number;
    copRate: number;
    
    // Actions
    fetchRates: () => Promise<void>;
    updateRate: (code: string, rate: number) => Promise<void>;
    setIva: (iva: number) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set, get) => ({
            rates: {
                VES: 36.50,
                COP: 4100,
                USD: 1
            },
            iva: 0.16,
            
            get vesRate() { return get().rates['VES'] || 36.50; },
            get copRate() { return get().rates['COP'] || 4100; },

            fetchRates: async () => {
                try {
                    const res = await api.get('/finance/rates');
                    if (res.data.success) {
                        const newRates: Record<string, number> = { ...get().rates };
                        res.data.data.forEach((r: ExchangeRate) => {
                            newRates[r.code] = Number(r.rate);
                        });
                        set({ rates: newRates });
                    }
                } catch (error) {
                    console.error('Error fetching rates:', error);
                }
            },

            updateRate: async (code, rate) => {
                try {
                    await api.post('/finance/rates', { code, rate });
                    set((state) => ({
                        rates: { ...state.rates, [code]: rate }
                    }));
                } catch (error) {
                    console.error('Error updating rate:', error);
                    throw error;
                }
            },

            setIva: (iva) => set({ iva: iva }),
        }),
        {
            name: 'erp-config-storage',
        }
    )
);
