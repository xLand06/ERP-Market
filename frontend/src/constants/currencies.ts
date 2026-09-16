export interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    flag: string;
}

export const GLOBAL_CURRENCIES: CurrencyInfo[] = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$', decimals: 2, flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, flag: '🇪🇺' },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$', decimals: 0, flag: '🇨🇴' },
    { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.', decimals: 2, flag: '🇻🇪' },
    { code: 'MXN', name: 'Peso Mexicano', symbol: '$', decimals: 2, flag: '🇲🇽' },
    { code: 'ARS', name: 'Peso Argentino', symbol: '$', decimals: 2, flag: '🇦🇷' },
    { code: 'CLP', name: 'Peso Chileno', symbol: '$', decimals: 0, flag: '🇨🇱' },
    { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', decimals: 2, flag: '🇵🇪' },
    { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', decimals: 2, flag: '🇧🇷' },
    { code: 'DOP', name: 'Peso Dominicano', symbol: 'RD$', decimals: 2, flag: '🇩🇴' },
    { code: 'GTQ', name: 'Quetzal Guatemalteco', symbol: 'Q', decimals: 2, flag: '🇬🇹' },
    { code: 'CRC', name: 'Colón Costarricense', symbol: '₡', decimals: 0, flag: '🇨🇷' },
    { code: 'UYU', name: 'Peso Uruguayo', symbol: '$', decimals: 2, flag: '🇺🇾' },
    { code: 'BOB', name: 'Boliviano', symbol: 'Bs.', decimals: 2, flag: '🇧🇴' },
    { code: 'PAB', name: 'Balboa Panameño', symbol: 'B/.', decimals: 2, flag: '🇵🇦' },
    { code: 'CAD', name: 'Dólar Canadiense', symbol: 'CA$', decimals: 2, flag: '🇨🇦' },
    { code: 'GBP', name: 'Libra Esterlina', symbol: '£', decimals: 2, flag: '🇬🇧' },
];

export function getCurrencyInfo(code: string): CurrencyInfo {
    const found = GLOBAL_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (found) return found;
    return {
        code: code.toUpperCase(),
        name: code.toUpperCase(),
        symbol: code.toUpperCase(),
        decimals: 2,
        flag: '🌐',
    };
}
