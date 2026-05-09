import { useState, useCallback, useMemo, useEffect } from 'react';
import type { PaymentMethodRow, PaymentMethodType, Currency } from '../types';

const DEFAULT_PAYMENT_OPTIONS: Array<{
    id: string;
    type: PaymentMethodType;
    label: string;
    currency: Currency;
}> = [
    { id: 'cash_cop', type: 'cash', label: 'Efectivo COP', currency: 'COP' },
    { id: 'cash_usd', type: 'cash', label: 'Efectivo USD', currency: 'USD' },
    { id: 'pagomovil', type: 'transfer', label: 'Pago Móvil VES', currency: 'VES' },
    { id: 'card', type: 'card', label: 'Tarjeta', currency: 'COP' },
];

interface UsePaymentReturn {
    rows: PaymentMethodRow[];
    totalInCOP: number;
    paidTotalInCOP: number;
    changeInCOP: number;
    remainingInCOP: number;
    isChangeOver: boolean;
    canConfirm: boolean;
    addRow: () => void;
    updateRow: (key: string, field: 'type' | 'currency' | 'amount', value: string | number) => void;
    removeRow: (key: string) => void;
    reset: (totalCOP: number) => void;
    getPayload: () => Array<{ type: PaymentMethodType; amount: number; currency: Currency; exchangeRate?: number }>;
    lastChangeRow: PaymentMethodRow | null;
}

/**
 * Maneja el estado multi-pago en el diálogo decobro.
 * Convierte tudo a COP para calcular vuelto/faltante.
 */
export function usePayment(
    rates: Record<string, number>,
    fmtCOP: (n: number) => string
): UsePaymentReturn {
    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const [totalInCOP, setTotalInCOP] = useState(0);
    const [rows, setRows] = useState<PaymentMethodRow[]>([]);

    // Reset cuando se abre el diálogo con un nuevo total
    const reset = useCallback((totalCOP: number) => {
        setTotalInCOP(totalCOP);
        setRows([{
            key: crypto.randomUUID(),
            type: 'cash',
            currency: 'COP',
            amount: totalCOP,
        }]);
    }, []);

    // Convertir una fila a COP
    const toCOP = useCallback((row: PaymentMethodRow): number => {
        if (row.currency === 'COP') return row.amount;
        if (row.currency === 'USD') return row.amount * usdRate;
        if (row.currency === 'VES') return row.amount * vesRate;
        return row.amount;
    }, [usdRate, vesRate]);

    // paidTotal en COP
    const paidTotalInCOP = useMemo(() =>
        rows.reduce((sum, r) => sum + toCOP(r), 0),
    [rows, toCOP]);

    const remainingInCOP = useMemo(() =>
        Math.max(0, totalInCOP - paidTotalInCOP),
    [totalInCOP, paidTotalInCOP]);

    const changeInCOP = useMemo(() =>
        paidTotalInCOP - totalInCOP,
    [totalInCOP, paidTotalInCOP]);

    const isChangeOver = changeInCOP > 0.01; // tolerancia 1 centavo

    // puede confirmar si pagó al menos el total (o con tolerncia de $1)
    const canConfirm = useMemo(() =>
        paidTotalInCOP >= (totalInCOP - 1),
    [paidTotalInCOP, totalInCOP]);

    // La última fila en efectivo (para calcular vuelto visual)
    const lastChangeRow = useMemo<PaymentMethodRow | null>(() => {
        const cashRows = rows.filter(r => r.type === 'cash');
        return cashRows.length > 0 ? cashRows[cashRows.length - 1] : null;
    }, [rows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            key: crypto.randomUUID(),
            type: 'cash',
            currency: 'USD', // siguiente será USD
            amount: 0,
        }]);
    }, []);

    const updateRow = useCallback((
        key: string,
        field: 'type' | 'currency' | 'amount',
        value: string | number
    ) => {
        setRows(prev => {
            const idx = prev.findIndex(r => r.key === key);
            if (idx === -1) return prev;

            const otherRowsCOP = prev.reduce((sum, r, i) => {
                if (i === idx) return sum;
                return sum + toCOP(r);
            }, 0);

            const remainingCOP = Math.max(0, totalInCOP - otherRowsCOP);

            return prev.map((r, i) => {
                if (i !== idx) return r;

                if (field === 'type') {
                    const newType = value as PaymentMethodType;
                    const opt = DEFAULT_PAYMENT_OPTIONS.find(o => o.type === newType);
                    const newCurrency = opt?.currency || 'COP';
                    let newAmount = remainingCOP;
                    if (newCurrency === 'USD') newAmount = remainingCOP / usdRate;
                    if (newCurrency === 'VES') newAmount = remainingCOP / vesRate;

                    return { ...r, type: newType, currency: newCurrency, amount: Number(newAmount.toFixed(2)) };
                }

                if (field === 'currency') {
                    const newCurrency = value as Currency;
                    let newAmount = remainingCOP;
                    if (newCurrency === 'USD') newAmount = remainingCOP / usdRate;
                    if (newCurrency === 'VES') newAmount = remainingCOP / vesRate;

                    return { ...r, currency: newCurrency, amount: Number(newAmount.toFixed(2)) };
                }

                if (field === 'amount') {
                    return { ...r, amount: typeof value === 'number' ? value : parseFloat(value) || 0 };
                }

                return r;
            });
        });
    }, [totalInCOP, toCOP, usdRate, vesRate]);

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
        paidTotalInCOP,
        changeInCOP,
        remainingInCOP,
        isChangeOver,
        canConfirm,
        addRow,
        updateRow,
        removeRow,
        reset,
        getPayload,
        lastChangeRow,
    };
}