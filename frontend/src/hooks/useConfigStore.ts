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
    ivaEnabled: boolean;
    ivaPercent: number;
    ivaMode: 'included' | 'added';
    mainCurrency: string; // 'USD' | 'VES' | 'COP'
    autoOpenTime: string | null; // 'HH:mm' o null para desactivado
    autoCloseTime: string | null; // 'HH:mm' o null para desactivado
    purgeRetentionDays: number; // Días de retención para transacciones en purga automática
    purgeLogRetentionDays: number; // Días de retención para logs en purga automática

    // Datos Fiscales & Negocio
    businessName: string;
    taxId: string;
    fiscalAddress: string;
    fiscalPhone: string;

    // Impresora Térmica & Impresión
    thermalPrinterEnabled: boolean;
    printerType: 'browser' | 'thermal_usb' | 'thermal_network' | 'thermal_serial';
    selectedPrinterId: string | null;
    selectedPrinterName: string | null;
    printerNetworkIp: string;
    paperWidth: '80mm' | '58mm';
    autoCut: boolean;
    openCashDrawer: boolean;
    printCopies: number;
    autoPrintOnCheckout: boolean;

    // Visibilidad & Plantilla de Factura
    showBusinessHeader: boolean;
    showTaxId: boolean;
    showFiscalAddress: boolean;
    showCustomer: boolean;
    showMultiCurrencySummary: boolean;
    showPaymentMethods: boolean;
    showIvaBreakdown: boolean;
    footerMessage: string;

    // Convenience getters
    vesRate: number;
    copRate: number;

    // Actions
    fetchRates: () => Promise<void>;
    updateRate: (code: string, rate: number) => Promise<void>;
    setIva: (iva: number) => void;
    setMainCurrency: (currency: string) => void;
    setAutoOpenTime: (time: string | null) => void;
    setAutoCloseTime: (time: string | null) => void;
    setPurgeRetention: (days: number) => void;
    setPurgeLogRetention: (days: number) => void;
    fetchSettings: () => Promise<void>;
    updateSettings: (settings: Partial<ConfigState>) => Promise<void>;

    // Helpers de conversión
    toUSD: (amount: number, currency: string) => number;
    fromUSD: (usdAmount: number, targetCurrency: string) => number;
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
    /** Formatea según la moneda principal seleccionada por el dueño */
    fmtMain: (amount: number) => string;
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
            iva: 16,
            ivaEnabled: true,
            ivaPercent: 16,
            ivaMode: 'added',
            mainCurrency: 'USD',
            autoOpenTime: null,
            autoCloseTime: null,
            purgeRetentionDays: 30,
            purgeLogRetentionDays: 90,

            businessName: 'ABASTOS SOFIMAR',
            taxId: 'J-12345678-9',
            fiscalAddress: 'Calle Principal, Local #1',
            fiscalPhone: '0414-1234567',

            thermalPrinterEnabled: true,
            printerType: 'browser',
            selectedPrinterId: null,
            selectedPrinterName: null,
            printerNetworkIp: '192.168.1.200',
            paperWidth: '80mm',
            autoCut: true,
            openCashDrawer: true,
            printCopies: 1,
            autoPrintOnCheckout: false,

            showBusinessHeader: true,
            showTaxId: true,
            showFiscalAddress: true,
            showCustomer: true,
            showMultiCurrencySummary: true,
            showPaymentMethods: true,
            showIvaBreakdown: true,
            footerMessage: '¡Gracias por su compra! Vuelva pronto',

            get vesRate() { return get().rates['VES'] || 5.5; },
            get copRate() { return get().rates['USD'] || get().rates['COP'] || 3600; },

            // ── Conversiones ────────────────────────────────────────────────
            toUSD: (amount: number, currency: string) => {
                const r = get().rates;
                const usdRate = r['USD'] || r['COP'] || 3600;
                const vesRate = r['VES'] || 5.5;

                if (currency === 'USD') return amount;
                if (currency === 'VES') return vesRate > 0 ? amount / vesRate : amount;
                if (currency === 'COP') return usdRate > 0 ? amount / usdRate : amount;
                return amount;
            },

            fromUSD: (usdAmount: number, targetCurrency: string) => {
                const r = get().rates;
                const usdRate = r['USD'] || r['COP'] || 3600;
                const vesRate = r['VES'] || 5.5;

                if (targetCurrency === 'USD') return usdAmount;
                if (targetCurrency === 'VES') return usdAmount * vesRate;
                if (targetCurrency === 'COP') return usdAmount * usdRate;
                return usdAmount;
            },

            toCOP: (amount: number, currency: string) => {
                const r = get().rates;
                const usdRate = r['USD'] || r['COP'] || 3600;
                const vesRate = r['VES'] || 5.5;

                if (currency === 'COP') return amount;
                if (currency === 'USD') return amount * usdRate;
                if (currency === 'VES') return (amount / vesRate) * usdRate;
                return amount;
            },

            fromCOP: (copAmount: number, targetCurrency: string) => {
                const r = get().rates;
                const usdRate = r['USD'] || r['COP'] || 3600;
                const vesRate = r['VES'] || 5.5;

                if (targetCurrency === 'COP') return copAmount;
                if (targetCurrency === 'USD') return copAmount / usdRate;
                if (targetCurrency === 'VES') return (copAmount / usdRate) * vesRate;
                return copAmount;
            },

            // ── Formateadores ────────────────────────────────────────────────
            fmtCOP: (amount: number) =>
                new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
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

            fmtMain: (usdAmount: number) => {
                const main = get().mainCurrency || 'USD';
                if (main === 'USD') return get().fmtUSD(usdAmount);
                if (main === 'VES') return get().fmtVES(get().fromUSD(usdAmount, 'VES'));
                if (main === 'COP') return get().fmtCOP(get().fromUSD(usdAmount, 'COP'));
                return get().fmtUSD(usdAmount);
            },

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
            setMainCurrency: (mainCurrency) => set({ mainCurrency }),
            setAutoOpenTime: (time) => set({ autoOpenTime: time }),
            setAutoCloseTime: (time) => set({ autoCloseTime: time }),
            setPurgeRetention: (days) => set({ purgeRetentionDays: days }),
            setPurgeLogRetention: (days) => set({ purgeLogRetentionDays: days }),

            fetchSettings: async () => {
                try {
                    const res = await api.get('/settings');
                    if (res.data.success) {
                        set({
                            ...res.data.data,
                            iva: res.data.data.ivaPercent ?? res.data.data.iva ?? 16,
                            mainCurrency: res.data.data.mainCurrency || 'USD',
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
