// =============================================================================
// SMS & NOTIFICATION PARSER — Pago Móvil bank parsing for Management Server
// Extracts amount (Bs), reference and sender phone from Venezuelan bank SMS / push notifications.
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

export const inferSenderBank = (sender: string, body: string): string => {
    if (sender.includes('2661') || sender.includes('2662')) return 'BDV';
    if (sender.includes('2846')) return 'Banesco';
    if (sender.includes('24024')) return 'Mercantil';
    if (sender.includes('provincial') || sender.includes('bbva')) return 'Provincial';

    if (/\bbdv\b|banco de\s+venezuela|bdvapp|bdv digital/i.test(body)) return 'BDV';
    if (/banesco/i.test(body)) return 'Banesco';
    if (/mercantil/i.test(body)) return 'Mercantil';
    if (/provincial|bbva/i.test(body)) return 'Provincial';
    if (/bancamiga/i.test(body)) return 'Bancamiga';
    if (/bancaribe/i.test(body)) return 'Bancaribe';
    if (/bnc\b|banco nacional de credito/i.test(body)) return 'BNC';

    return 'BDV'; // Default común si vino de notificación bancaria
};

export const parsePagoMovilSms = (
    sender: string,
    body: string
): ParsedPagoMovil | null => {
    if (!body || !body.trim()) return null;

    // Monto:
    // Patrón 1: Bs. 1.000,00 | Bs 100 | BsD 100 | BsS 100 | VES 100
    let amountVes: number | null = null;
    const amountPrefixMatch = body.match(/\b(?:bs\.?(?:d|s)?|ves)\s*([\d][\d.,]*)/i);
    if (amountPrefixMatch) {
        amountVes = normalizeAmount(amountPrefixMatch[1]);
    }

    // Patrón 2: 1.000,00 Bs | 100 Bs. | 100 VES
    if (!amountVes) {
        const amountSuffixMatch = body.match(/([\d][\d.,]*)\s*(?:bs\.?(?:d|s)?|ves)\b/i);
        if (amountSuffixMatch) {
            amountVes = normalizeAmount(amountSuffixMatch[1]);
        }
    }

    // Patrón 3: "monto: 1.000,00" o "por 1.000,00"
    if (!amountVes) {
        const amountGenericMatch = body.match(/\b(?:monto|por|valor|importe)\.?[:#]?\s*([\d][\d.,]*)/i);
        if (amountGenericMatch) {
            amountVes = normalizeAmount(amountGenericMatch[1]);
        }
    }

    // Referencia:
    // ref: 12345678 | referencia: 12345678 | operacion: 12345678 | op: 12345678 | nro: 12345678
    let reference = '';
    const refMatch = body.match(/\b(?:ref(?:erencia)?|operaci[oó]n|op|nro|num|numero|comprobante|transacci[oó]n|secuencia)\.?[:#]?\s*(\d{4,20})/i);
    if (refMatch) {
        reference = refMatch[1];
    } else {
        // Fallback: secuencia de 6 a 12 dígitos
        const digitsMatch = body.match(/\b(\d{6,12})\b/);
        if (digitsMatch) {
            reference = digitsMatch[1];
        }
    }

    if (!amountVes && !reference) {
        return null;
    }

    const phoneMatch = body.match(/\b(04\d{9})\b/);

    return {
        amountVes: amountVes || 0,
        reference: reference || 'SIN_REF',
        senderPhone: phoneMatch ? phoneMatch[1] : undefined,
        senderBank: inferSenderBank(sender ?? '', body),
    };
};
