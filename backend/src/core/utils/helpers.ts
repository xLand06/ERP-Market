/** Formats a price number to a localized currency string. */
export const formatCurrency = (amount: number, currency: 'USD' | 'VES' = 'USD'): string =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency }).format(amount);

/** Returns today's date as YYYY-MM-DD string. */
export const todayISO = (): string => new Date().toISOString().split('T')[0];

/** Checks if a product batch is expired. */
export const isBatchExpired = (expirationDate: Date): boolean =>
    new Date() > new Date(expirationDate);

/** Paginates an array. */
export const paginate = <T>(data: T[], page: number, limit: number) => {
    const start = (page - 1) * limit;
    return { items: data.slice(start, start + limit), total: data.length, page, limit };
};

/**
 * Parses a date range from strings.
 * If 'to' is a date-only string (YYYY-MM-DD), it sets it to the end of that day (23:59:59.999Z).
 */
export const parseDateRange = (from?: string, to?: string) => {
    const fromDate = from ? new Date(from) : undefined;
    let toDate = to ? new Date(to) : undefined;

    if (toDate && to?.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        toDate.setUTCHours(23, 59, 59, 999);
    }

    return { fromDate, toDate };
};
