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
    autoOpenTime: string | null; // 'HH:mm' o null para desactivado
    purgeRetentionDays: number; // Días de retención para transacciones en purga automática
    purgeLogRetentionDays: number; // Días de retención para logs en purga automática
    // Convenience getters
    vesRate: number;
    copRate: number;

    // Actions
    fetchRates: () => Promise<void>;
    updateRate: (code: string, rate: number) => Promise<void>;
    setIva: (iva: number) => void;
    setAutoOpenTime: (time: string | null) => void;
    setPurgeRetention: (days: number) => void;
    setPurgeLogRetention: (days: number) => void;
    fetchSettings: () => Promise<void>;
    updateSettings: (settings: Partial<ConfigState>) => Promise<void>;

    // Helpers de conversión (COP es la moneda base del sistema)
    /** Convierte desde cualquier moneda a COP */
    toCOP: (amount: number, currency: string) => number;
    /** Convierte desde COP a otra moneda */
    fromCOP: (copAmount: number, targetCurrency: string) => number;
    /** Formatea en COP con formato colombiano: $4.200 */
    fmtCOP: (amount: number) => string;
    /** Formatea en USD: $4.20 */
    fmtUSD: (amount: number) => string;
    /** Formatea en VES: Bs. 152.40 */
    fmtVES: (amount: number) => string;
    /** Retorna el símbolo de una moneda */
    currencySymbol: (currency: string) => string;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set, get) => ({
            rates: {
                VES: 5.5,
                USD: 3600,
                COP: 1,
            },
            iva: 0,
            autoOpenTime: null,
            purgeRetentionDays: 30,
            purgeLogRetentionDays: 90,

            get vesRate() { return get().rates['VES'] || 5.5; },
            get copRate() { return get().rates['USD'] || get().rates['COP'] || 3600; },

            // ── Conversiones ────────────────────────────────────────────────
            toCOP: (amount: number, currency: string) => {
                const r = get().rates;
                if (currency === 'COP') return amount;
                if (currency === 'USD') return amount * (r['USD'] || r['COP'] || 3600);
                if (currency === 'VES') return amount * (r['VES'] || 5.5);
                return amount;
            },

            fromCOP: (copAmount: number, targetCurrency: string) => {
                const r = get().rates;
                if (targetCurrency === 'COP') return copAmount;
                if (targetCurrency === 'USD') return copAmount / (r['USD'] || r['COP'] || 3600);
                if (targetCurrency === 'VES') return copAmount / (r['VES'] || 5.5);
                return copAmount;
            },

            // ── Formateadores ────────────────────────────────────────────────
            fmtCOP: (amount: number) =>
                new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0,
                }).format(amount),

            fmtUSD: (amount: number) =>
                new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(amount),

            fmtVES: (amount: number) =>
                `Bs. ${new Intl.NumberFormat('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(amount)}`,

            currencySymbol: (currency: string) => {
                if (currency === 'COP') return '$';
                if (currency === 'USD') return '$';
                if (currency === 'VES') return 'Bs.';
                return '$';
            },

            // ── Actions ──────────────────────────────────────────────────────
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

            setIva: (iva) => set({ iva }),
            setAutoOpenTime: (time) => set({ autoOpenTime: time }),
            setPurgeRetention: (days) => set({ purgeRetentionDays: days }),
            setPurgeLogRetention: (days) => set({ purgeLogRetentionDays: days }),

            fetchSettings: async () => {
                try {
                    const res = await api.get('/settings');
                    if (res.data.success) {
                        set({
                            iva: res.data.data.iva,
                            autoOpenTime: res.data.data.autoOpenTime,
                            purgeRetentionDays: res.data.data.purgeRetentionDays,
                            purgeLogRetentionDays: res.data.data.purgeLogRetentionDays
                        });
                    }
                } catch (error) {
                    console.error('Error fetching settings:', error);
                }
            },

            updateSettings: async (settings) => {
                try {
                    const res = await api.post('/settings', settings);
                    if (res.data.success) {
                        set(settings);
                    }
                } catch (error) {
                    console.error('Error updating settings:', error);
                    throw error;
                }
            }
        }),
        {
            name: 'erp-config-storage',
        }
    )
);
