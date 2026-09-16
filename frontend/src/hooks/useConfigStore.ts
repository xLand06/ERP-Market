import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { getCurrencyInfo } from '@/constants/currencies';

interface ExchangeRate {
    code: string;
    rate: number;
}

export interface ThermalPrinterConfig {
    id: string;
    name: string;
    connectionType: 'thermal_usb' | 'thermal_network' | 'thermal_serial' | 'browser';
    ipAddress?: string;
    port?: number;
    usbVendorId?: number;
    usbProductId?: number;
    paperWidth: '80mm' | '58mm';
    autoCut: boolean;
    openCashDrawer: boolean;
    isPrimary: boolean;
    role: 'pos' | 'kitchen' | 'backup';
}

export type UITheme = 'emerald' | 'indigo' | 'amber' | 'rose' | 'dark';

export interface ConfigState {
    // Monedas & Tasas
    mainCurrency: string;
    activeCurrencies: string[];
    rates: Record<string, number>;
    updatedAt: string | null;

    // Tema de Interfaz
    activeTheme: UITheme;

    // IVA & Turnos
    iva: number;
    ivaEnabled: boolean;
    ivaPercent: number;
    ivaMode: 'included' | 'added';
    autoOpenTime: string | null;
    autoCloseTime: string | null;

    // Mantenimiento & Purga de datos
    purgeRetentionDays: number;
    purgeLogRetentionDays: number;

    // Datos Fiscales & Negocio
    businessName: string;
    taxId: string;
    fiscalAddress: string;
    fiscalPhone: string;

    // Impresoras Térmicas Múltiples
    thermalPrinterEnabled: boolean;
    printers: ThermalPrinterConfig[];
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

    // Catálogo digital (F5)
    catalogSlug: string;    // slug público del catálogo ('' = sin catálogo)
    catalogActive: boolean; // flag maestro que habilita el catálogo público
    socialLinks: string;    // JSON string: { facebook?, instagram?, whatsapp? }

    // Convenience getters
    vesRate: number;
    copRate: number;

    // Actions
    fetchRates: () => Promise<void>;
    updateRate: (code: string, rate: number) => Promise<void>;
    setTheme: (theme: UITheme) => void;
    setIva: (iva: number) => void;
    setMainCurrency: (currency: string) => void;
    setActiveCurrencies: (currencies: string[]) => void;
    setAutoOpenTime: (time: string | null) => void;
    setAutoCloseTime: (time: string | null) => void;
    setPurgeRetention: (days: number) => void;
    setPurgeLogRetention: (days: number) => void;
    fetchSettings: () => Promise<void>;
    updateSettings: (settings: Partial<ConfigState>) => Promise<void>;
    addPrinter: (printer: Omit<ThermalPrinterConfig, 'id'>) => void;
    updatePrinter: (id: string, updates: Partial<ThermalPrinterConfig>) => void;
    deletePrinter: (id: string) => void;
    setPrimaryPrinter: (id: string) => void;

    // Helpers de conversión dinámicos
    convert: (amount: number, fromCurrency: string, toCurrency: string) => number;
    formatCurrency: (amount: number, currencyCode?: string) => string;

    // Helpers de compatibilidad retrocompatible
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
            updatedAt: null,
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
            activeCurrencies: ['USD', 'COP', 'VES'],
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

            catalogSlug: '',
            catalogActive: false,
            socialLinks: '{}',

            get vesRate() { return get().rates['VES'] || 5.5; },
            get copRate() { return get().rates['USD'] || get().rates['COP'] || 3600; },

            // ── Conversión Universal ────────────────────────────────────────
            convert: (amount: number, fromCurrency: string, toCurrency: string) => {
                if (!amount || fromCurrency === toCurrency) return amount;
                const main = get().mainCurrency || 'USD';
                const rates = get().rates;

                const getRate = (code: string) => {
                    if (code === main) return 1;
                    if (main === 'USD') {
                        if (code === 'VES') return rates['VES'] || 5.5;
                        if (code === 'COP') return rates['USD'] || rates['COP'] || 3600;
                    }
                    return rates[code] || 1;
                };

                let amountInMain = amount;
                if (fromCurrency !== main) {
                    const rFrom = getRate(fromCurrency);
                    amountInMain = rFrom > 0 ? amount / rFrom : amount;
                }

                if (toCurrency === main) return amountInMain;
                const rTo = getRate(toCurrency);
                return amountInMain * rTo;
            },

            formatCurrency: (amount: number, currencyCode?: string) => {
                const code = (currencyCode || get().mainCurrency || 'USD').toUpperCase();
                const info = getCurrencyInfo(code);
                try {
                    return new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: code,
                        minimumFractionDigits: info.decimals,
                        maximumFractionDigits: info.decimals,
                    }).format(amount);
                } catch (_) {
                    return `${info.symbol} ${amount.toFixed(info.decimals)}`;
                }
            },

            // ── Conversiones Retrocompatibles ──────────────────────────────
            toUSD: (amount: number, currency: string) => get().convert(amount, currency, 'USD'),
            fromUSD: (usdAmount: number, targetCurrency: string) => get().convert(usdAmount, 'USD', targetCurrency),
            toCOP: (amount: number, currency: string) => get().convert(amount, currency, 'COP'),
            fromCOP: (copAmount: number, targetCurrency: string) => get().convert(copAmount, 'COP', targetCurrency),

            // ── Formateadores ────────────────────────────────────────────────
            fmtCOP: (amount: number) => get().formatCurrency(amount, 'COP'),
            fmtUSD: (amount: number) => get().formatCurrency(amount, 'USD'),
            fmtVES: (amount: number) =>
                `Bs. ${new Intl.NumberFormat('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(amount)}`,

            fmtMain: (amount: number) => {
                const main = get().mainCurrency || 'USD';
                return get().formatCurrency(amount, main);
            },

            currencySymbol: (currency: string) => {
                return getCurrencyInfo(currency).symbol;
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
            setActiveCurrencies: (activeCurrencies) => set({ activeCurrencies }),
            setAutoOpenTime: (time) => set({ autoOpenTime: time }),
            setAutoCloseTime: (time) => set({ autoCloseTime: time }),
            setPurgeRetention: (days) => set({ purgeRetentionDays: days }),
            setPurgeLogRetention: (days) => set({ purgeLogRetentionDays: days }),

            fetchSettings: async () => {
                try {
                    const currentTheme = get().activeTheme;
                    const res = await api.get('/settings');
                    if (res.data.success) {
                        // Priorizar tema del backend sobre el default 'emerald'
                        const themeToApply = (currentTheme && currentTheme !== 'emerald')
                            ? currentTheme
                            : (res.data.data.activeTheme || 'emerald');
                        set({
                            ...res.data.data,
                            activeTheme: themeToApply,
                            iva: res.data.data.ivaPercent ?? res.data.data.iva ?? 16,
                            mainCurrency: res.data.data.mainCurrency || 'USD',
                            activeCurrencies: res.data.data.activeCurrencies || get().activeCurrencies || ['USD', 'COP', 'VES'],
                        });
                        if (typeof document !== 'undefined') {
                            document.documentElement.setAttribute('data-theme', themeToApply);
                            document.documentElement.className = themeToApply === 'dark' ? 'theme-dark dark' : `theme-${themeToApply}`;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching settings:', error);
                }
            },

            printers: [
                {
                    id: 'default-pos-usb',
                    name: 'Impresora Caja Principal (USB 80mm)',
                    connectionType: 'thermal_usb',
                    paperWidth: '80mm',
                    autoCut: true,
                    openCashDrawer: true,
                    isPrimary: true,
                    role: 'pos',
                },
                {
                    id: 'kitchen-epson-net',
                    name: 'Impresora Cocina / Depósito (Red IP)',
                    connectionType: 'thermal_network',
                    ipAddress: '192.168.1.200',
                    port: 9100,
                    paperWidth: '80mm',
                    autoCut: true,
                    openCashDrawer: false,
                    isPrimary: false,
                    role: 'kitchen',
                },
            ],

            addPrinter: (newP) => {
                const id = `printer-${Date.now()}`;
                const printer: ThermalPrinterConfig = { ...newP, id };
                set(state => {
                    const currentPrinters = state.printers || [];
                    const updated = printer.isPrimary
                        ? currentPrinters.map(p => ({ ...p, isPrimary: false })).concat(printer)
                        : [...currentPrinters, printer];
                    return { printers: updated, selectedPrinterId: printer.isPrimary ? printer.id : state.selectedPrinterId };
                });
            },

            updatePrinter: (id, updates) => {
                set(state => {
                    const currentPrinters = state.printers || [];
                    const updated = currentPrinters.map(p => {
                        if (p.id !== id) {
                            return updates.isPrimary ? { ...p, isPrimary: false } : p;
                        }
                        return { ...p, ...updates };
                    });
                    return { printers: updated };
                });
            },

            deletePrinter: (id) => {
                set(state => {
                    const currentPrinters = state.printers || [];
                    const updated = currentPrinters.filter(p => p.id !== id);
                    if (updated.length > 0 && !updated.some(p => p.isPrimary)) {
                        updated[0].isPrimary = true;
                    }
                    return { printers: updated };
                });
            },

            setPrimaryPrinter: (id) => {
                set(state => {
                    const currentPrinters = state.printers || [];
                    const updated = currentPrinters.map(p => ({
                        ...p,
                        isPrimary: p.id === id,
                    }));
                    const primary = updated.find(p => p.id === id);
                    return {
                        printers: updated,
                        selectedPrinterId: id,
                        selectedPrinterName: primary?.name || state.selectedPrinterName,
                        printerType: primary?.connectionType || state.printerType,
                        paperWidth: primary?.paperWidth || state.paperWidth,
                    };
                });
            },

            activeTheme: 'emerald',
            setTheme: async (theme) => {
                set({ activeTheme: theme });
                if (typeof document !== 'undefined') {
                    document.documentElement.setAttribute('data-theme', theme);
                    document.documentElement.className = theme === 'dark' ? 'theme-dark dark' : `theme-${theme}`;
                }
                try {
                    await api.post('/settings', { activeTheme: theme });
                } catch (error) {
                    console.error('Error persisting theme to backend:', error);
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
