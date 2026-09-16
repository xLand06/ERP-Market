export interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    flag: string;
    region: 'americas' | 'europe' | 'asia' | 'africa' | 'oceania' | 'middle_east';
}

// ── ISO 4217 Global Currency Catalog ──────────────────────────────────────────
export const GLOBAL_CURRENCIES: CurrencyInfo[] = [
    // ── Americas ──────────────────────────────────────────────────────────────
    { code: 'USD', name: 'US Dollar',               symbol: '$',    decimals: 2, flag: '🇺🇸', region: 'americas' },
    { code: 'CAD', name: 'Canadian Dollar',          symbol: 'CA$',  decimals: 2, flag: '🇨🇦', region: 'americas' },
    { code: 'MXN', name: 'Mexican Peso',             symbol: '$',    decimals: 2, flag: '🇲🇽', region: 'americas' },
    { code: 'GTQ', name: 'Guatemalan Quetzal',       symbol: 'Q',    decimals: 2, flag: '🇬🇹', region: 'americas' },
    { code: 'HNL', name: 'Honduran Lempira',         symbol: 'L',    decimals: 2, flag: '🇭🇳', region: 'americas' },
    { code: 'NIO', name: 'Nicaraguan Córdoba',       symbol: 'C$',   decimals: 2, flag: '🇳🇮', region: 'americas' },
    { code: 'CRC', name: 'Costa Rican Colón',        symbol: '₡',    decimals: 0, flag: '🇨🇷', region: 'americas' },
    { code: 'PAB', name: 'Panamanian Balboa',        symbol: 'B/.',  decimals: 2, flag: '🇵🇦', region: 'americas' },
    { code: 'CUP', name: 'Cuban Peso',               symbol: '$',    decimals: 2, flag: '🇨🇺', region: 'americas' },
    { code: 'DOP', name: 'Dominican Peso',           symbol: 'RD$',  decimals: 2, flag: '🇩🇴', region: 'americas' },
    { code: 'HTG', name: 'Haitian Gourde',           symbol: 'G',    decimals: 2, flag: '🇭🇹', region: 'americas' },
    { code: 'JMD', name: 'Jamaican Dollar',          symbol: 'J$',   decimals: 2, flag: '🇯🇲', region: 'americas' },
    { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$',  decimals: 2, flag: '🇹🇹', region: 'americas' },
    { code: 'BBD', name: 'Barbadian Dollar',         symbol: 'Bds$', decimals: 2, flag: '🇧🇧', region: 'americas' },
    { code: 'COP', name: 'Colombian Peso',           symbol: '$',    decimals: 0, flag: '🇨🇴', region: 'americas' },
    { code: 'VES', name: 'Venezuelan Bolívar',       symbol: 'Bs.',  decimals: 2, flag: '🇻🇪', region: 'americas' },
    { code: 'GYD', name: 'Guyanese Dollar',          symbol: 'G$',   decimals: 2, flag: '🇬🇾', region: 'americas' },
    { code: 'SRD', name: 'Surinamese Dollar',        symbol: 'Sr$',  decimals: 2, flag: '🇸🇷', region: 'americas' },
    { code: 'BRL', name: 'Brazilian Real',           symbol: 'R$',   decimals: 2, flag: '🇧🇷', region: 'americas' },
    { code: 'PEN', name: 'Peruvian Sol',             symbol: 'S/',   decimals: 2, flag: '🇵🇪', region: 'americas' },
    { code: 'BOB', name: 'Bolivian Boliviano',       symbol: 'Bs.',  decimals: 2, flag: '🇧🇴', region: 'americas' },
    { code: 'CLP', name: 'Chilean Peso',             symbol: '$',    decimals: 0, flag: '🇨🇱', region: 'americas' },
    { code: 'ARS', name: 'Argentine Peso',           symbol: '$',    decimals: 2, flag: '🇦🇷', region: 'americas' },
    { code: 'UYU', name: 'Uruguayan Peso',           symbol: '$',    decimals: 2, flag: '🇺🇾', region: 'americas' },
    { code: 'PYG', name: 'Paraguayan Guaraní',       symbol: '₲',    decimals: 0, flag: '🇵🇾', region: 'americas' },
    { code: 'AWG', name: 'Aruban Florin',            symbol: 'Afl',  decimals: 2, flag: '🇦🇼', region: 'americas' },

    // ── Europe ────────────────────────────────────────────────────────────────
    { code: 'EUR', name: 'Euro',                     symbol: '€',    decimals: 2, flag: '🇪🇺', region: 'europe' },
    { code: 'GBP', name: 'British Pound',            symbol: '£',    decimals: 2, flag: '🇬🇧', region: 'europe' },
    { code: 'CHF', name: 'Swiss Franc',              symbol: 'Fr',   decimals: 2, flag: '🇨🇭', region: 'europe' },
    { code: 'NOK', name: 'Norwegian Krone',          symbol: 'kr',   decimals: 2, flag: '🇳🇴', region: 'europe' },
    { code: 'SEK', name: 'Swedish Krona',            symbol: 'kr',   decimals: 2, flag: '🇸🇪', region: 'europe' },
    { code: 'DKK', name: 'Danish Krone',             symbol: 'kr',   decimals: 2, flag: '🇩🇰', region: 'europe' },
    { code: 'PLN', name: 'Polish Złoty',             symbol: 'zł',   decimals: 2, flag: '🇵🇱', region: 'europe' },
    { code: 'CZK', name: 'Czech Koruna',             symbol: 'Kč',   decimals: 2, flag: '🇨🇿', region: 'europe' },
    { code: 'HUF', name: 'Hungarian Forint',         symbol: 'Ft',   decimals: 0, flag: '🇭🇺', region: 'europe' },
    { code: 'RON', name: 'Romanian Leu',             symbol: 'lei',  decimals: 2, flag: '🇷🇴', region: 'europe' },
    { code: 'BGN', name: 'Bulgarian Lev',            symbol: 'лв',   decimals: 2, flag: '🇧🇬', region: 'europe' },
    { code: 'HRK', name: 'Croatian Kuna',            symbol: 'kn',   decimals: 2, flag: '🇭🇷', region: 'europe' },
    { code: 'RSD', name: 'Serbian Dinar',            symbol: 'din',  decimals: 2, flag: '🇷🇸', region: 'europe' },
    { code: 'RUB', name: 'Russian Ruble',            symbol: '₽',    decimals: 2, flag: '🇷🇺', region: 'europe' },
    { code: 'UAH', name: 'Ukrainian Hryvnia',        symbol: '₴',    decimals: 2, flag: '🇺🇦', region: 'europe' },
    { code: 'ISK', name: 'Icelandic Króna',          symbol: 'kr',   decimals: 0, flag: '🇮🇸', region: 'europe' },

    // ── Asia ──────────────────────────────────────────────────────────────────
    { code: 'JPY', name: 'Japanese Yen',             symbol: '¥',    decimals: 0, flag: '🇯🇵', region: 'asia' },
    { code: 'CNY', name: 'Chinese Yuan',             symbol: '¥',    decimals: 2, flag: '🇨🇳', region: 'asia' },
    { code: 'KRW', name: 'South Korean Won',         symbol: '₩',    decimals: 0, flag: '🇰🇷', region: 'asia' },
    { code: 'HKD', name: 'Hong Kong Dollar',         symbol: 'HK$',  decimals: 2, flag: '🇭🇰', region: 'asia' },
    { code: 'SGD', name: 'Singapore Dollar',         symbol: 'S$',   decimals: 2, flag: '🇸🇬', region: 'asia' },
    { code: 'TWD', name: 'Taiwan Dollar',            symbol: 'NT$',  decimals: 2, flag: '🇹🇼', region: 'asia' },
    { code: 'INR', name: 'Indian Rupee',             symbol: '₹',    decimals: 2, flag: '🇮🇳', region: 'asia' },
    { code: 'PKR', name: 'Pakistani Rupee',          symbol: '₨',    decimals: 2, flag: '🇵🇰', region: 'asia' },
    { code: 'BDT', name: 'Bangladeshi Taka',         symbol: '৳',    decimals: 2, flag: '🇧🇩', region: 'asia' },
    { code: 'LKR', name: 'Sri Lankan Rupee',         symbol: 'Rs',   decimals: 2, flag: '🇱🇰', region: 'asia' },
    { code: 'NPR', name: 'Nepalese Rupee',           symbol: 'Rs',   decimals: 2, flag: '🇳🇵', region: 'asia' },
    { code: 'THB', name: 'Thai Baht',                symbol: '฿',    decimals: 2, flag: '🇹🇭', region: 'asia' },
    { code: 'VND', name: 'Vietnamese Dong',          symbol: '₫',    decimals: 0, flag: '🇻🇳', region: 'asia' },
    { code: 'IDR', name: 'Indonesian Rupiah',        symbol: 'Rp',   decimals: 0, flag: '🇮🇩', region: 'asia' },
    { code: 'MYR', name: 'Malaysian Ringgit',        symbol: 'RM',   decimals: 2, flag: '🇲🇾', region: 'asia' },
    { code: 'PHP', name: 'Philippine Peso',          symbol: '₱',    decimals: 2, flag: '🇵🇭', region: 'asia' },
    { code: 'MMK', name: 'Myanmar Kyat',             symbol: 'K',    decimals: 2, flag: '🇲🇲', region: 'asia' },
    { code: 'KHR', name: 'Cambodian Riel',           symbol: '៛',    decimals: 2, flag: '🇰🇭', region: 'asia' },

    // ── Middle East ───────────────────────────────────────────────────────────
    { code: 'SAR', name: 'Saudi Riyal',              symbol: '﷼',    decimals: 2, flag: '🇸🇦', region: 'middle_east' },
    { code: 'AED', name: 'UAE Dirham',               symbol: 'د.إ',  decimals: 2, flag: '🇦🇪', region: 'middle_east' },
    { code: 'QAR', name: 'Qatari Riyal',             symbol: 'ر.ق',  decimals: 2, flag: '🇶🇦', region: 'middle_east' },
    { code: 'KWD', name: 'Kuwaiti Dinar',            symbol: 'د.ك',  decimals: 3, flag: '🇰🇼', region: 'middle_east' },
    { code: 'BHD', name: 'Bahraini Dinar',           symbol: 'BD',   decimals: 3, flag: '🇧🇭', region: 'middle_east' },
    { code: 'OMR', name: 'Omani Rial',               symbol: 'ر.ع.', decimals: 3, flag: '🇴🇲', region: 'middle_east' },
    { code: 'JOD', name: 'Jordanian Dinar',          symbol: 'JD',   decimals: 3, flag: '🇯🇴', region: 'middle_east' },
    { code: 'ILS', name: 'Israeli Shekel',           symbol: '₪',    decimals: 2, flag: '🇮🇱', region: 'middle_east' },
    { code: 'TRY', name: 'Turkish Lira',             symbol: '₺',    decimals: 2, flag: '🇹🇷', region: 'middle_east' },
    { code: 'IRR', name: 'Iranian Rial',             symbol: '﷼',    decimals: 2, flag: '🇮🇷', region: 'middle_east' },

    // ── Africa ────────────────────────────────────────────────────────────────
    { code: 'ZAR', name: 'South African Rand',       symbol: 'R',    decimals: 2, flag: '🇿🇦', region: 'africa' },
    { code: 'NGN', name: 'Nigerian Naira',           symbol: '₦',    decimals: 2, flag: '🇳🇬', region: 'africa' },
    { code: 'KES', name: 'Kenyan Shilling',          symbol: 'KSh',  decimals: 2, flag: '🇰🇪', region: 'africa' },
    { code: 'GHS', name: 'Ghanaian Cedi',            symbol: 'GH₵',  decimals: 2, flag: '🇬🇭', region: 'africa' },
    { code: 'EGP', name: 'Egyptian Pound',           symbol: '£',    decimals: 2, flag: '🇪🇬', region: 'africa' },
    { code: 'MAD', name: 'Moroccan Dirham',          symbol: 'MAD',  decimals: 2, flag: '🇲🇦', region: 'africa' },
    { code: 'DZD', name: 'Algerian Dinar',           symbol: 'DA',   decimals: 2, flag: '🇩🇿', region: 'africa' },
    { code: 'TZS', name: 'Tanzanian Shilling',       symbol: 'TSh',  decimals: 2, flag: '🇹🇿', region: 'africa' },
    { code: 'UGX', name: 'Ugandan Shilling',         symbol: 'USh',  decimals: 0, flag: '🇺🇬', region: 'africa' },
    { code: 'ETB', name: 'Ethiopian Birr',           symbol: 'Br',   decimals: 2, flag: '🇪🇹', region: 'africa' },
    { code: 'XAF', name: 'Central African CFA',      symbol: 'FCFA', decimals: 0, flag: '🌍', region: 'africa' },
    { code: 'XOF', name: 'West African CFA',         symbol: 'CFA',  decimals: 0, flag: '🌍', region: 'africa' },

    // ── Oceania ───────────────────────────────────────────────────────────────
    { code: 'AUD', name: 'Australian Dollar',        symbol: 'A$',   decimals: 2, flag: '🇦🇺', region: 'oceania' },
    { code: 'NZD', name: 'New Zealand Dollar',       symbol: 'NZ$',  decimals: 2, flag: '🇳🇿', region: 'oceania' },
    { code: 'FJD', name: 'Fijian Dollar',            symbol: 'FJ$',  decimals: 2, flag: '🇫🇯', region: 'oceania' },
    { code: 'PGK', name: 'Papua New Guinea Kina',    symbol: 'K',    decimals: 2, flag: '🇵🇬', region: 'oceania' },
];

// ── Region display labels ─────────────────────────────────────────────────────
export const CURRENCY_REGIONS: Record<CurrencyInfo['region'], string> = {
    americas:    'Americas',
    europe:      'Europe',
    asia:        'Asia & Pacific',
    middle_east: 'Middle East',
    africa:      'Africa',
    oceania:     'Oceania',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getCurrencyInfo(code: string): CurrencyInfo {
    const found = GLOBAL_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (found) return found;
    return {
        code:     code.toUpperCase(),
        name:     code.toUpperCase(),
        symbol:   code.toUpperCase(),
        decimals: 2,
        flag:     '🌐',
        region:   'americas',
    };
}

/** Returns currencies grouped by region, in display order. */
export function getCurrenciesByRegion(): Record<CurrencyInfo['region'], CurrencyInfo[]> {
    const groups: Record<string, CurrencyInfo[]> = {};
    for (const c of GLOBAL_CURRENCIES) {
        if (!groups[c.region]) groups[c.region] = [];
        groups[c.region].push(c);
    }
    return groups as Record<CurrencyInfo['region'], CurrencyInfo[]>;
}
