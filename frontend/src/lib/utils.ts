import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Normaliza texto: quita acentos/diacríticos y convierte a MAYÚSCULAS.
 * Uso: normalizeText('Café') → 'CAFE', normalizeText('Niño') → 'NINO'
 */
export function normalizeText(value: string): string {
    return value
        .normalize('NFD')                       // separa acentos (á = a + ́)
        .replace(/[\u0300-\u036f]/g, '')        // elimina diacríticos
        .toUpperCase();
}
