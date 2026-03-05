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
