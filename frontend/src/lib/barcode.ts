// =============================================================================
// BARCODE VALIDATION UTILITY
// Validación de códigos de barras EAN-13, EAN-8, UPC-A y códigos internos
// =============================================================================

/** Tipos de código de barras disponibles */
export const BARCODE_LABELS = [
  { value: 'EAN-13', label: 'EAN-13 (13 dígitos)', example: '5901234123457' },
  { value: 'EAN-8', label: 'EAN-8 (8 dígitos)', example: '12345670' },
  { value: 'UPC-A', label: 'UPC-A (12 dígitos)', example: '042100005264' },
  { value: 'INTERNO', label: 'Código Interno', example: 'PROD-001' },
  { value: 'PROVEEDOR', label: 'Código de Proveedor', example: 'ABC-12345' },
  { value: 'OTRO', label: 'Otro', example: '...' },
] as const;

export type BarcodeLabel = (typeof BARCODE_LABELS)[number]['value'];

// =============================================================================
// DETECCIÓN DE FORMATO
// =============================================================================

/** Detecta el formato de un código de barras por su longitud y patrón */
export function detectBarcodeFormat(code: string): BarcodeLabel | null {
  if (!code.trim()) return null;
  if (/^\d{13}$/.test(code)) return 'EAN-13';
  if (/^\d{8}$/.test(code)) return 'EAN-8';
  if (/^\d{12}$/.test(code)) return 'UPC-A';
  return null;
}

// =============================================================================
// VALIDACIÓN DE DÍGITO VERIFICADOR (GS1 / Módulo 10)
// =============================================================================

/**
 * Valida el dígito verificador de un EAN-13.
 * Algoritmo: posiciones impares (1-indexed) × 1, pares × 3.
 * El último dígito es el verificador.
 */
export function validateEAN13CheckDigit(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

/**
 * Valida el dígito verificador de un UPC-A (12 dígitos).
 * Algoritmo: posiciones impares (1-indexed) × 3, pares × 1.
 */
export function validateUPCACheckDigit(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[11];
}

/**
 * Valida el dígito verificador de un EAN-8.
 * Mismo algoritmo que UPC-A (posiciones impares × 3).
 */
export function validateEAN8CheckDigit(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += digits[i] * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[7];
}

// =============================================================================
// VALIDACIÓN COMPLETA
// =============================================================================

export interface BarcodeValidation {
  valid: boolean;
  message?: string;
  severity: 'success' | 'warning' | 'error';
  /** País detectado si es EAN-13 válido (ej: 'México', 'Colombia') */
  countryHint?: string;
}

/** Mapa de prefijos EAN-13 a país */
const EAN_COUNTRIES: Record<string, string> = {
  '750': 'México',
  '759': 'Venezuela',
  '770': 'Colombia',
  '773': 'Uruguay',
  '779': 'Argentina',
  '780': 'Chile',
  '784': 'Paraguay',
  '786': 'Ecuador',
  '789': 'Brasil',
  '775': 'Perú',
  '740': 'Guatemala',
  '741': 'El Salvador',
  '742': 'Honduras',
  '743': 'Nicaragua',
  '744': 'Costa Rica',
  '745': 'Panamá',
  '746': 'Rep. Dominicana',
  '847': 'España',
  '000': 'EE.UU. / Canadá',
  '060': 'EE.UU. / Canadá',
  '001': 'EE.UU. / Canadá',
  '070': 'Noruega',
  '400': 'Alemania',
  '440': 'Alemania',
  '490': 'Japón',
  '450': 'Japón',
  '690': 'China',
  '880': 'Corea del Sur',
};

/**
 * Valida un código de barras según su label.
 * Devuelve validación con mensaje, severidad y pista de país.
 */
export function validateBarcode(
  label: BarcodeLabel | '',
  code: string
): BarcodeValidation {
  if (!code.trim()) {
    return { valid: false, message: 'El código es requerido', severity: 'error' };
  }

  // Solo dígitos para formatos estándar
  const isStandard = label === 'EAN-13' || label === 'EAN-8' || label === 'UPC-A';

  if (isStandard && /\D/.test(code)) {
    return { valid: false, message: 'Solo se permiten dígitos', severity: 'error' };
  }

  switch (label) {
    case 'EAN-13': {
      if (!/^\d{13}$/.test(code)) {
        const len = code.replace(/\D/g, '').length;
        return {
          valid: false,
          message: `EAN-13 requiere 13 dígitos (tiene ${len})`,
          severity: 'error',
        };
      }
      const validDigit = validateEAN13CheckDigit(code);
      const prefix = code.substring(0, 3);
      const country = EAN_COUNTRIES[prefix];

      if (validDigit) {
        return {
          valid: true,
          message: `EAN-13 válido${country ? ` — ${country}` : ''}`,
          severity: 'success',
          countryHint: country,
        };
      }
      return {
        valid: true,
        message: 'Dígito verificador incorrecto',
        severity: 'warning',
      };
    }

    case 'EAN-8': {
      if (!/^\d{8}$/.test(code)) {
        const len = code.replace(/\D/g, '').length;
        return {
          valid: false,
          message: `EAN-8 requiere 8 dígitos (tiene ${len})`,
          severity: 'error',
        };
      }
      const validDigit = validateEAN8CheckDigit(code);
      return validDigit
        ? { valid: true, message: 'EAN-8 válido', severity: 'success' }
        : { valid: true, message: 'Dígito verificador incorrecto', severity: 'warning' };
    }

    case 'UPC-A': {
      if (!/^\d{12}$/.test(code)) {
        const len = code.replace(/\D/g, '').length;
        return {
          valid: false,
          message: `UPC-A requiere 12 dígitos (tiene ${len})`,
          severity: 'error',
        };
      }
      const validDigit = validateUPCACheckDigit(code);
      return validDigit
        ? { valid: true, message: 'UPC-A válido', severity: 'success' }
        : { valid: true, message: 'Dígito verificador incorrecto', severity: 'warning' };
    }

    case 'INTERNO':
    case 'PROVEEDOR':
      if (code.trim().length < 2) {
        return { valid: false, message: 'Mínimo 2 caracteres', severity: 'error' };
      }
      return { valid: true, severity: 'success' };

    case 'OTRO':
    default:
      return { valid: true, severity: 'success' };
  }
}

// =============================================================================
// PLACEHOLDERS DINÁMICOS
// =============================================================================

/** Devuelve un placeholder contextual según el tipo de código */
export function getBarcodePlaceholder(label: BarcodeLabel | ''): string {
  switch (label) {
    case 'EAN-13':
      return '1234567890123';
    case 'EAN-8':
      return '12345670';
    case 'UPC-A':
      return '123456789012';
    case 'INTERNO':
      return 'PROD-001';
    case 'PROVEEDOR':
      return 'ABC-12345';
    default:
      return 'Código de barras';
  }
}
