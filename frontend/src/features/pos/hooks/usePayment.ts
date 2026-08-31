import { useState, useCallback, useMemo } from 'react';
import type { PaymentMethodRow, PaymentMethodType, Currency } from '../types';

export const DEFAULT_PAYMENT_OPTIONS: Array<{
    type: PaymentMethodType;
    label: string;
    currency: Currency;
}> = [
    { type: 'cash', label: 'Efectivo USD', currency: 'USD' },
    { type: 'cash', label: 'Efectivo VES', currency: 'VES' },
    { type: 'transfer', label: 'Pago Móvil / Transf.', currency: 'VES' },
    { type: 'card', label: 'Tarjeta / Punto', currency: 'VES' },
];

export interface UsePaymentReturn {
    rows: PaymentMethodRow[];
    totalInCOP: number; // para compatibilidad
    totalInUSD: number;
    paidTotalInUSD: number;
    paidTotalInCOP: number;
    changeInUSD: number;
    changeInCOP: number;
    remainingInUSD: number;
    remainingInCOP: number;
    isChangeOver: boolean;
    canConfirm: boolean;
    addRow: () => void;
    updateRow: (key: string, updates: Partial<Omit<PaymentMethodRow, 'key'>>) => void;
    removeRow: (key: string) => void;
    reset: (totalInUSD: number) => void;
    updateTotal: (newTotalInUSD: number) => void;
    getPayload: () => Array<{
        type: PaymentMethodType;
        amount: number;
        currency: Currency;
        exchangeRate?: number;
    }>;
    lastChangeRow: PaymentMethodRow | null;
}

/**
 * Hook para gestionar los métodos de pago en el modal de cobro del POS.
 * Trabaja con USD como referencia base principal.
 */
export function usePayment(
    rates: Record<string, number>,
    fmtCOP: (n: number) => string
): UsePaymentReturn {
    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const [totalInUSD, setTotalInUSD] = useState(0);
    const [rows, setRows] = useState<PaymentMethodRow[]>([]);

    // Reset cuando se abre el diálogo con un nuevo total en USD
    const reset = useCallback((usdTotal: number) => {
        setTotalInUSD(usdTotal);
        setRows([{
            key: crypto.randomUUID(),
            type: 'cash',
            currency: 'USD',
            amount: Number(usdTotal.toFixed(2)),
        }]);
    }, []);

    // Actualiza el total cuando cambia durante la edición de cantidades
    const updateTotal = useCallback((newTotalUSD: number) => {
        setTotalInUSD(newTotalUSD);
        setRows(prev => {
            if (prev.length === 1) {
                const firstRow = prev[0];
                let newAmount = newTotalUSD;
                if (firstRow.currency === 'USD') newAmount = newTotalUSD;
                if (firstRow.currency === 'VES') newAmount = newTotalUSD * vesRate;
                if (firstRow.currency === 'COP') newAmount = newTotalUSD * usdRate;
                return [{
                    ...firstRow,
                    amount: Number(newAmount.toFixed(2))
                }];
            }
            return prev;
        });
    }, [usdRate, vesRate]);

    // Convertir una fila a USD (referencia base)
    const toUSD = useCallback((row: PaymentMethodRow): number => {
        if (row.currency === 'USD') return row.amount;
        if (row.currency === 'VES') return vesRate > 0 ? row.amount / vesRate : 0;
        if (row.currency === 'COP') return usdRate > 0 ? row.amount / usdRate : 0;
        return row.amount;
    }, [usdRate, vesRate]);

    // paidTotal en USD y COP
    const paidTotalInUSD = useMemo(() =>
        rows.reduce((sum, r) => sum + toUSD(r), 0),
    [rows, toUSD]);

    const paidTotalInCOP = useMemo(() => paidTotalInUSD * usdRate, [paidTotalInUSD, usdRate]);
    const totalInCOP = useMemo(() => totalInUSD * usdRate, [totalInUSD, usdRate]);

    const remainingInUSD = useMemo(() =>
        Math.max(0, totalInUSD - paidTotalInUSD),
    [totalInUSD, paidTotalInUSD]);

    const remainingInCOP = useMemo(() => remainingInUSD * usdRate, [remainingInUSD, usdRate]);

    const changeInUSD = useMemo(() =>
        paidTotalInUSD - totalInUSD,
    [totalInUSD, paidTotalInUSD]);

    const changeInCOP = useMemo(() => changeInUSD * usdRate, [changeInUSD, usdRate]);

    const isChangeOver = changeInUSD > 0.01;

    // puede confirmar si pagó al menos el total (con tolerancia de 1 centavo USD)
    const canConfirm = useMemo(() =>
        paidTotalInUSD >= (totalInUSD - 0.01),
    [paidTotalInUSD, totalInUSD]);

    const lastChangeRow = useMemo<PaymentMethodRow | null>(() => {
        const cashRows = rows.filter(r => r.type === 'cash');
        return cashRows.length > 0 ? cashRows[cashRows.length - 1] : null;
    }, [rows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            key: crypto.randomUUID(),
            type: 'cash',
            currency: 'USD',
            amount: 0,
        }]);
    }, []);

    const updateRow = useCallback((
        key: string,
        updates: Partial<Omit<PaymentMethodRow, 'key'>>
    ) => {
        setRows(prev => {
            const idx = prev.findIndex(r => r.key === key);
            if (idx === -1) return prev;

            const otherRowsUSD = prev.reduce((sum, r, i) => {
                if (i === idx) return sum;
                return sum + toUSD(r);
            }, 0);

            const remainingUSD = Math.max(0, totalInUSD - otherRowsUSD);

            return prev.map((r, i) => {
                if (i !== idx) return r;

                const next = { ...r, ...updates };

                if (updates.type && !updates.currency) {
                    const opt = DEFAULT_PAYMENT_OPTIONS.find(o => o.type === updates.type);
                    next.currency = opt?.currency || 'USD';
                }

                if (updates.type || updates.currency) {
                    let newAmount = remainingUSD;
                    if (next.currency === 'USD') newAmount = remainingUSD;
                    if (next.currency === 'VES') newAmount = remainingUSD * vesRate;
                    if (next.currency === 'COP') newAmount = remainingUSD * usdRate;
                    next.amount = Number(newAmount.toFixed(2));
                }

                return next;
            });
        });
    }, [totalInUSD, toUSD, usdRate, vesRate]);

    const removeRow = useCallback((key: string) => {
        setRows(prev => {
            if (prev.length <= 1) return prev;
            return prev.filter(r => r.key !== key);
        });
    }, []);

    // Construir payload para el API
    const getPayload = useCallback(() =>
        rows
            .filter(r => r.amount > 0)
            .map(r => ({
                type: r.type,
                amount: r.amount,
                currency: r.currency,
                exchangeRate: r.currency === 'USD' ? usdRate : r.currency === 'VES' ? vesRate : undefined,
            })),
    [rows, usdRate, vesRate]);

    return {
        rows,
        totalInCOP,
        totalInUSD,
        paidTotalInUSD,
        paidTotalInCOP,
        changeInUSD,
        changeInCOP,
        remainingInUSD,
        remainingInCOP,
        isChangeOver,
        canConfirm,
        addRow,
        updateRow,
        removeRow,
        reset,
        updateTotal,
        getPayload,
        lastChangeRow,
    };
}