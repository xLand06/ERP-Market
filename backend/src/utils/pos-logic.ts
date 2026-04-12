/**
 * Lógica de conversión de Inventario (UMB - Unidad de Medida Base)
 * ERP-MARKET
 */

export interface CartItem {
    productId: string;
    quantity: number;
    presentation?: {
        multiplier: number;
    } | null;
}

/**
 * Calcula la cantidad real a deducir del stock basado en el multiplicador de la presentación.
 * 
 * Ejemplo:
 * - Venta de 1 "Bolsa x 24" -> quantity: 1, multiplier: 24 -> devuelve 24 unidades.
 * - Venta de 0.5 kg de producto base -> quantity: 0.5, multiplier: null -> devuelve 0.5 unidades.
 * 
 * @param quantity Cantidad vendida (lo que ingresa el cajero)
 * @param multiplier Multiplicador de la presentación seleccionada (si existe)
 * @returns Cantidad real en la Unidad de Medida Base (UMB)
 */
export function calculateInventoryDeduction(quantity: number, multiplier?: number | null): number {
    const factor = multiplier || 1;
    return quantity * factor;
}
