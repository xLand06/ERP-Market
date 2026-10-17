import { useState, useCallback, useMemo } from 'react';
import type { PaymentMethodRow, PaymentMethodType, Currency } from '../types';

export const DEFAULT_PAYMENT_OPTIONS: Array<{
    type: PaymentMethodType;
    label: string;
    currency: Currency;
}> = [
    { type: 'cash', label: 'Efectivo USD', currency: 'USD' },
    { type: 'cash', label: 'Efectivo COP', currency: 'COP' },
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
    splitEvenly: (parts: number) => void;
    updateRow: (key: string, updates: Partial<Omit<PaymentMethodRow, 'key'>>) => void;
    removeRow: (key: string) => void;
    reset: (totalInMain: number) => void;
    updateTotal: (newTotalInMain: number) => void;
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
 * Dinámicamente trabaja con la moneda base configurada (mainCurrency).
 */
export function usePayment(
    rates: Record<string, number>,
    fmtCOP?: (n: number) => string,
    mainCurrency: string = 'USD',
    convertFn?: (amount: number, from: string, to: string) => number
): UsePaymentReturn {
    const convert = useCallback((amount: number, from: string, to: string) => {
        if (!amount) return 0;
        const f = (from || mainCurrency || 'USD').toUpperCase();
        const t = (to || mainCurrency || 'USD').toUpperCase();
        if (f === t) return amount;
        if (convertFn) return convertFn(amount, f, t);

        const m = (mainCurrency || 'USD').toUpperCase();
        const getR = (c: string) => {
            if (c === m) return 1.0;
            const r = Number(rates[c]);
            return r > 0 ? r : 1.0;
        };

        const rFrom = getR(f);
        const inMain = f === m ? amount : (amount / rFrom);
        const rTo = getR(t);
        return t === m ? inMain : (inMain * rTo);
    }, [convertFn, mainCurrency, rates]);

    const [totalInMain, setTotalInMain] = useState(0);
    const [rows, setRows] = useState<PaymentMethodRow[]>([]);

    // Reset cuando se abre el diálogo con un nuevo total en la moneda base
    const reset = useCallback((newTotal: number) => {
        setTotalInMain(newTotal);
        const cur = (mainCurrency || 'USD').toUpperCase();
        setRows([{
            key: crypto.randomUUID(),
            type: 'cash',
            currency: cur,
            amount: cur === 'COP' ? Math.round(newTotal) : Number(newTotal.toFixed(2)),
        }]);
    }, [mainCurrency]);

    // Actualiza el total cuando cambia durante la edición de cantidades
    const updateTotal = useCallback((newTotal: number) => {
        setTotalInMain(newTotal);
        setRows(prev => {
            if (prev.length === 1) {
                const firstRow = prev[0];
                const newAmount = convert(newTotal, mainCurrency, firstRow.currency);
                return [{
                    ...firstRow,
                    amount: firstRow.currency === 'COP' ? Math.round(newAmount) : Number(newAmount.toFixed(2))
                }];
            }
            return prev;
        });
    }, [mainCurrency, convert]);

    // Convertir una fila a la moneda base
    const toBase = useCallback((row: PaymentMethodRow): number => {
        return convert(row.amount, row.currency, mainCurrency);
    }, [convert, mainCurrency]);

    // Totales en moneda base
    const paidTotalInBase = useMemo(() =>
        rows.reduce((sum, r) => sum + toBase(r), 0),
    [rows, toBase]);

    const remainingInBase = useMemo(() =>
        Math.max(0, totalInMain - paidTotalInBase),
    [totalInMain, paidTotalInBase]);

    const changeInBase = useMemo(() =>
        paidTotalInBase - totalInMain,
    [totalInMain, paidTotalInBase]);

    const isChangeOver = changeInBase > 0.01;

    // Puede confirmar si pagó al menos el total (con tolerancia de 0.01 unidades de moneda base)
    const canConfirm = useMemo(() =>
        paidTotalInBase >= (totalInMain - 0.01),
    [paidTotalInBase, totalInMain]);

    // Campos calculados retrocompatibles
    const totalInUSD = useMemo(() => convert(totalInMain, mainCurrency, 'USD'), [convert, totalInMain, mainCurrency]);
    const totalInCOP = useMemo(() => convert(totalInMain, mainCurrency, 'COP'), [convert, totalInMain, mainCurrency]);
    const paidTotalInUSD = useMemo(() => convert(paidTotalInBase, mainCurrency, 'USD'), [convert, paidTotalInBase, mainCurrency]);
    const paidTotalInCOP = useMemo(() => convert(paidTotalInBase, mainCurrency, 'COP'), [convert, paidTotalInBase, mainCurrency]);
    const remainingInUSD = useMemo(() => convert(remainingInBase, mainCurrency, 'USD'), [convert, remainingInBase, mainCurrency]);
    const remainingInCOP = useMemo(() => convert(remainingInBase, mainCurrency, 'COP'), [convert, remainingInBase, mainCurrency]);
    const changeInUSD = useMemo(() => convert(Math.max(0, changeInBase), mainCurrency, 'USD'), [convert, changeInBase, mainCurrency]);
    const changeInCOP = useMemo(() => convert(Math.max(0, changeInBase), mainCurrency, 'COP'), [convert, changeInBase, mainCurrency]);

    const lastChangeRow = useMemo<PaymentMethodRow | null>(() => {
        const cashRows = rows.filter(r => r.type === 'cash');
        return cashRows.length > 0 ? cashRows[cashRows.length - 1] : null;
    }, [rows]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, {
            key: crypto.randomUUID(),
            type: 'cash',
            currency: (mainCurrency || 'USD').toUpperCase(),
            amount: 0,
        }]);
    }, [mainCurrency]);

    // Dividir total equitativamente en N partes (ej: 50/50 o en 3 partes)
    const splitEvenly = useCallback((parts: number) => {
        if (parts < 2 || totalInMain <= 0) return;
        const partInBase = totalInMain / parts;
        const main = (mainCurrency || 'USD').toUpperCase();

        const newRows: PaymentMethodRow[] = Array.from({ length: parts }).map((_, idx) => {
            if (idx === 0) {
                return {
                    key: crypto.randomUUID(),
                    type: 'cash',
                    currency: main,
                    amount: main === 'COP' ? Math.round(partInBase) : Number(partInBase.toFixed(2)),
                };
            }
            if (idx === 1) {
                const cur = main === 'VES' ? 'USD' : 'VES';
                const amt = convert(partInBase, main, cur);
                return {
                    key: crypto.randomUUID(),
                    type: cur === 'VES' ? 'transfer' : 'cash',
                    currency: cur,
                    amount: cur === 'COP' ? Math.round(amt) : Number(amt.toFixed(2)),
                };
            }
            const cur = main === 'USD' ? 'VES' : 'USD';
            const amt = convert(partInBase, main, cur);
            return {
                key: crypto.randomUUID(),
                type: 'card',
                currency: cur,
                amount: cur === 'COP' ? Math.round(amt) : Number(amt.toFixed(2)),
            };
        });

        setRows(newRows);
    }, [totalInMain, mainCurrency, convert]);

    const updateRow = useCallback((
        key: string,
        updates: Partial<Omit<PaymentMethodRow, 'key'>>
    ) => {
        setRows(prev => {
            const idx = prev.findIndex(r => r.key === key);
            if (idx === -1) return prev;

            const otherRowsInBase = prev.reduce((sum, r, i) => {
                if (i === idx) return sum;
                return sum + toBase(r);
            }, 0);

            const remainingInBase = Math.max(0, totalInMain - otherRowsInBase);

            return prev.map((r, i) => {
                if (i !== idx) return r;

                const next = { ...r, ...updates };

                if (updates.type && !updates.currency) {
                    const opt = DEFAULT_PAYMENT_OPTIONS.find(o => o.type === updates.type);
                    next.currency = opt?.currency || mainCurrency;
                }

                if (updates.type || updates.currency) {
                    const newAmount = convert(remainingInBase, mainCurrency, next.currency);
                    next.amount = next.currency === 'COP' ? Math.round(newAmount) : Number(newAmount.toFixed(2));
                }

                return next;
            });
        });
    }, [totalInMain, toBase, mainCurrency, convert]);

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
                exchangeRate: r.currency === mainCurrency ? 1 : Number(rates[r.currency] || 1),
            })),
    [rows, mainCurrency, rates]);

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
        splitEvenly,
        updateRow,
        removeRow,
        reset,
        updateTotal,
        getPayload,
        lastChangeRow,
    };
}