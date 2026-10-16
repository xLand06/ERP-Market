// =============================================================================
// SMS PARSER — Pago Móvil bank SMS parsing for Management Server
// Extracts amount (Bs), reference and sender phone from Venezuelan bank SMS.
// Supported banks: BDV, Banesco, Mercantil, Provincial, Bancamiga, etc.
// =============================================================================

export interface ParsedPagoMovil {
    amountVes: number;
    reference: string;
    senderPhone?: string;
    senderBank: string;
}

const normalizeAmount = (raw: string): number | null => {
    let s = raw.trim().replace(/[.,]+$/, '');
    if (!/^\d[\d.,]*$/.test(s)) return null;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastDot >= 0 && lastComma >= 0) {
        s = lastComma > lastDot
            ? s.replace(/\./g, '').replace(/,/g, '.')
            : s.replace(/,/g, '');
    } else if (lastComma >= 0) {
        s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot >= 0) {
        const parts = s.split('.');
        if (parts.length > 2) {
            s = s.replace(/\./g, '');
        } else if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
            s = parts[0] + parts[1];
        }
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const inferSenderBank = (sender: string, body: string): string => {
    if (sender.includes('2661') || sender.includes('2662')) return 'BDV';
    if (sender.includes('2846')) return 'Banesco';
    if (sender.includes('24024')) return 'Mercantil';
    if (sender.includes('provincial') || sender.includes('bbva')) return 'Provincial';

    if (/\bbdv\b|banco de\s+venezuela/i.test(body)) return 'BDV';
    if (/banesco/i.test(body)) return 'Banesco';
    if (/mercantil/i.test(body)) return 'Mercantil';
    if (/provincial|bbva/i.test(body)) return 'Provincial';
    if (/bancamiga/i.test(body)) return 'Bancamiga';

    return 'UNKNOWN';
};

export const parsePagoMovilSms = (
    sender: string,
    body: string
): ParsedPagoMovil | null => {
    if (!body) return null;

    const amountMatch = body.match(/\bbs\.?\s*([\d][\d.,]*)/i);
    if (!amountMatch) return null;
    const amountVes = normalizeAmount(amountMatch[1]);
    if (amountVes === null || amountVes <= 0) return null;

    const refMatch = body.match(/\bref(?:erencia)?\.?[:#]?\s*(\d{4,20})/i);
    if (!refMatch) return null;
    const reference = refMatch[1];

    const phoneMatch = body.match(/\b(04\d{9})\b/);

    return {
        amountVes,
        reference,
        senderPhone: phoneMatch ? phoneMatch[1] : undefined,
        senderBank: inferSenderBank(sender ?? '', body),
    };
};
