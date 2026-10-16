// =============================================================================
// SMS PARSER — Pago Móvil bank SMS parsing (pure functions)
// Extracts amount (Bs), reference and sender phone from Venezuelan bank SMS.
// Supported banks: BDV (2661/2662), Banesco (2846), Mercantil (24024).
// No Prisma import on purpose: this module is fully unit-testable.
// =============================================================================

export interface ParsedPagoMovil {
    amountVes: number;
    reference: string;
    senderPhone?: string;
    senderBank: string;
}

/**
 * Normalize a Venezuelan-formatted amount to a JS number.
 * Handles: `1.450,50` (thousands dot + decimal comma), `120.000,75`,
 * `1,450.50` (US style), `1450,50`, `1450.50`, `1500`.
 * Returns null when the string is not a plausible number.
 */
const normalizeAmount = (raw: string): number | null => {
    let s = raw.trim().replace(/[.,]+$/, ''); // strip trailing separators
    if (!/^\d[\d.,]*$/.test(s)) return null;

    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastDot >= 0 && lastComma >= 0) {
        // Both separators present: the LAST one is the decimal separator
        s = lastComma > lastDot
            ? s.replace(/\./g, '').replace(/,/g, '.') // 1.450,50 -> 1450.50
            : s.replace(/,/g, '');                    // 1,450.50 -> 1450.50
    } else if (lastComma >= 0) {
        // Only commas: Venezuelan convention -> comma is the decimal separator.
        // More than one comma means US-style thousands grouping: drop them.
        s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (lastDot >= 0) {
        const parts = s.split('.');
        if (parts.length > 2) {
            // Multiple dots -> thousands grouping (1.234.567)
            s = s.replace(/\./g, '');
        } else if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
            // Single dot with exactly 3 trailing digits -> thousands (1.450, 120.000)
            s = parts[0] + parts[1];
        }
        // Otherwise it is a plain decimal dot (1450.50): keep as-is
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

/**
 * Infer the issuing bank from the SMS sender short code,
 * falling back to a keyword in the message body.
 */
const inferSenderBank = (sender: string, body: string): string => {
    if (sender.includes('2661') || sender.includes('2662')) return 'BDV';
    if (sender.includes('2846')) return 'Banesco';
    if (sender.includes('24024')) return 'Mercantil';

    if (/\bbdv\b|banco de\s+venezuela/i.test(body)) return 'BDV';
    if (/banesco/i.test(body)) return 'Banesco';
    if (/mercantil/i.test(body)) return 'Mercantil';

    return 'UNKNOWN';
};

/**
 * Parse a Pago Móvil notification SMS.
 * Returns null when no amount+reference pair is found, so callers
 * never create garbage rows from unparseable messages.
 */
export const parsePagoMovilSms = (
    sender: string,
    body: string
): ParsedPagoMovil | null => {
    if (!body) return null;

    // Amount: "Bs 1.450,50", "Bs. 1450.50", "BS 1500" ...
    const amountMatch = body.match(/\bbs\.?\s*([\d][\d.,]*)/i);
    if (!amountMatch) return null;
    const amountVes = normalizeAmount(amountMatch[1]);
    if (amountVes === null || amountVes <= 0) return null;

    // Reference: first digits token (4..20) after Ref / REF / Referencia / operacion
    const refMatch = body.match(/\b(?:ref(?:erencia)?|operaci[oó]n|op|n[uú]m(?:ero)?(?:\s+de\s+operaci[oó]n)?|comprobante|transacci[oó]n|secuencia)\.?[:#]?\s*(\d{4,20})/i);
    if (!refMatch) return null;
    const reference = refMatch[1];

    // Sender phone: 11-digit Venezuelan mobile (0412-1234567, 0414 1234567, 04121234567)
    const phoneMatch = body.match(/\b(04(?:12|14|24|16|26)[- ]?\d{7})\b/) || body.match(/\b(04\d{9})\b/);

    // Titular / Nombre (cuando es entre cuentas del mismo banco, ej. BDV a BDV)
    let senderName: string | undefined;
    const nameMatch = body.match(/(?:de|del)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ ]{3,45}?)\s+(?:por\s+bs|con\s+el|bajo\s+el|en\s+fecha)/i);
    if (nameMatch) {
        const candidate = nameMatch[1].trim();
        if (!/^\d+$/.test(candidate) && !/^(un|una|el|la)\s+/i.test(candidate)) {
            senderName = candidate.toUpperCase();
        }
    }

    return {
        amountVes,
        reference,
        senderPhone: phoneMatch ? phoneMatch[1].replace(/[- ]/g, '') : (senderName || undefined),
        senderBank: inferSenderBank(sender ?? '', body),
    };
};
