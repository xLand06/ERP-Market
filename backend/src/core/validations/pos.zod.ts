// =============================================================================
// POS VALIDATIONS — Zod Schemas
// Validaciones para el módulo de POS (transacciones)
// =============================================================================

/**
 * Esquema para un ítem de transacción
 */
const transactionItemSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const fieldErrors: Record<string, string[]> = {};
        
        const productId = obj?.productId as string;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!productId || !uuidRegex.test(productId)) {
            fieldErrors['productId'] = ['ID de producto inválido'];
        }
        
        const quantity = Number(obj?.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            fieldErrors['quantity'] = ['La cantidad debe ser mayor a 0'];
        }
        
        const unitPrice = Number(obj?.unitPrice);
        if (isNaN(unitPrice) || unitPrice <= 0) {
            fieldErrors['unitPrice'] = ['El precio unitario debe ser mayor a 0'];
        }
        
        if (Object.keys(fieldErrors).length > 0) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors 
                    }) 
                } 
            };
        }
        
        return { 
            success: true as const, 
            data: { productId, quantity, unitPrice } 
        };
    }
};

/**
 * Esquema para crear una venta (SALE)
 */
export const createSaleSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const fieldErrors: Record<string, string[]> = {};
        
        // Branch ID
        const branchId = obj?.branchId as string;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!branchId || !uuidRegex.test(branchId)) {
            fieldErrors['branchId'] = ['ID de sede inválido'];
        }
        
        // Items
        const items = obj?.items;
        if (!items || !Array.isArray(items) || items.length === 0) {
            fieldErrors['items'] = ['Debe incluir al menos un producto'];
        } else {
            const validItems: { productId: string; quantity: number; unitPrice: number }[] = [];
            let hasErrors = false;
            
            for (let i = 0; i < items.length; i++) {
                const itemResult = (transactionItemSchema as any).safeParse(items[i]);
                if (!itemResult.success) {
                    const errors = itemResult.error.flatten().fieldErrors as Record<string, string[]>;
                    const errorMessages = Object.values(errors).flat() as string[];
                    fieldErrors[`items[${i}]`] = errorMessages;
                    hasErrors = true;
                } else {
                    validItems.push(itemResult.data);
                }
            }
            
            if (hasErrors) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors 
                        }) 
                    } 
                };
            }
        }
        
        // CashRegister ID (optional)
        const cashRegisterId = obj?.cashRegisterId as string | undefined;
        if (cashRegisterId && !uuidRegex.test(cashRegisterId)) {
            fieldErrors['cashRegisterId'] = ['ID de caja inválido'];
        }
        
        // Notes (optional)
        const notes = obj?.notes as string | undefined;
        if (notes && notes.length > 500) {
            fieldErrors['notes'] = ['Las notas son muy largas'];
        }
        
        if (Object.keys(fieldErrors).length > 0) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors 
                    }) 
                } 
            };
        }
        
        return { 
            success: true as const, 
            data: { 
                branchId, 
                items: items || [], 
                cashRegisterId: cashRegisterId || undefined,
                notes: notes || undefined,
                ipAddress: obj?.ipAddress as string | undefined
            }
        };
    }
};

/**
 * Esquema para filtros de transacciones
 */
export const transactionFiltersSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        
        const page = Number(obj?.page) || 1;
        const limit = Number(obj?.limit) || 20;
        
        if (page < 1 || isNaN(page)) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: ['Page debe ser >= 1'] }, 
                        fieldErrors: {} 
                    }) 
                } 
            };
        }
        
        if (limit < 1 || limit > 100 || isNaN(limit)) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: ['Limit debe estar entre 1 y 100'] }, 
                        fieldErrors: {} 
                    }) 
                } 
            };
        }
        
        result.page = page;
        result.limit = limit;
        
        if (obj?.type && ['SALE', 'INVENTORY_IN'].includes(obj.type as string)) {
            result.type = obj.type;
        }
        if (obj?.status && ['COMPLETED', 'CANCELLED', 'PENDING'].includes(obj.status as string)) {
            result.status = obj.status;
        }
        if (obj?.branchId) result.branchId = obj.branchId;
        if (obj?.userId) result.userId = obj.userId;
        if (obj?.from) result.from = obj.from;
        if (obj?.to) result.to = obj.to;
        
        return { success: true as const, data: result };
    }
};

/**
 * Esquema para cancelar transacción
 */
export const cancelTransactionSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const reason = obj?.reason as string;
        
        if (!reason || reason.length < 5) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors: { reason: ['Debe especificar un motivo de cancelación'] } 
                    }) 
                } 
            };
        }
        
        if (reason.length > 500) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors: { reason: ['El motivo es muy largo'] } 
                    }) 
                } 
            };
        }
        
        return { success: true as const, data: { reason } };
    }
};

/**
 * Tipo inferido de createSaleSchema
 */
export type CreateSaleInput = {
    branchId: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    cashRegisterId?: string;
    notes?: string;
    ipAddress?: string;
};

/**
 * Tipo inferido de transactionFiltersSchema
 */
export type TransactionFiltersInput = {
    page?: number;
    limit?: number;
    type?: 'SALE' | 'INVENTORY_IN';
    status?: 'COMPLETED' | 'CANCELLED' | 'PENDING';
    branchId?: string;
    userId?: string;
    from?: string;
    to?: string;
};

/**
 * Tipo inferido de cancelTransactionSchema
 */
export type CancelTransactionInput = {
    reason: string;
};