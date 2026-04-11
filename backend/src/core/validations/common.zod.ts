// =============================================================================
// COMMON VALIDATIONS — Zod Schemas
// Esquemas comunes usados en toda la aplicación
// =============================================================================

/**
 * Esquema de paginación
 * page y limit se coerce a number (string → number)
 */
export const paginationSchema = {
    parse: (data: unknown) => {
        const obj = data as Record<string, unknown>;
        const page = obj?.page ? Number(obj.page) : 1;
        const limit = obj?.limit ? Number(obj.limit) : 20;
        const search = obj?.search as string | undefined;
        
        if (isNaN(page) || page < 1) return { data: null, error: 'Page must be >= 1' };
        if (isNaN(limit) || limit < 1 || limit > 100) return { data: null, error: 'Limit must be between 1 and 100' };
        
        return { data: { page, limit, search }, error: null };
    },
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const page = obj?.page ? Number(obj.page) : 1;
        const limit = obj?.limit ? Number(obj.limit) : 20;
        const search = obj?.search as string | undefined;
        
        const issues: string[] = [];
        if (isNaN(page) || page < 1) issues.push('Page must be >= 1');
        if (isNaN(limit) || limit < 1 || limit > 100) issues.push('Limit must be between 1 and 100');
        
        if (issues.length > 0) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: issues }, 
                        fieldErrors: {} as Record<string, string[]> 
                    }) 
                } 
            };
        }
        
        return { 
            success: true as const, 
            data: { page, limit, search } 
        };
    }
};

/**
 * Esquema para ID como parámetro URL
 */
export const idParamSchema = {
    parse: (data: unknown) => {
        const obj = data as Record<string, unknown>;
        const id = obj?.id as string;
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!id || !uuidRegex.test(id)) {
            return { data: null, error: 'ID inválido' };
        }
        
        return { data: { id }, error: null };
    },
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const id = obj?.id as string;
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!id || !uuidRegex.test(id)) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors: { id: ['ID inválido'] } as Record<string, string[]> 
                    }) 
                } 
            };
        }
        
        return { success: true as const, data: { id } };
    }
};

/**
 * Esquema de email
 */
export const emailSchema = {
    parse: (data: unknown) => {
        const str = data as string;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!str || !emailRegex.test(str)) {
            return { data: null, error: 'Email inválido' };
        }
        return { data: str.toLowerCase(), error: null };
    },
    safeParse: function(data: unknown) {
        const str = data as string;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!str || !emailRegex.test(str)) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors: { email: ['Email inválido'] } as Record<string, string[]> 
                    }) 
                } 
            };
        }
        return { success: true as const, data: str.toLowerCase() };
    }
};

/**
 * Esquema de password
 */
export const passwordSchema = {
    parse: (data: unknown) => {
        const str = data as string;
        if (!str || str.length < 6) {
            return { data: null, error: 'La contraseña debe tener al menos 6 caracteres' };
        }
        if (str.length > 100) {
            return { data: null, error: 'La contraseña es muy larga' };
        }
        return { data: str, error: null };
    },
    safeParse: function(data: unknown) {
        const str = data as string;
        const issues: string[] = [];
        if (!str || str.length < 6) issues.push('La contraseña debe tener al menos 6 caracteres');
        if (str.length > 100) issues.push('La contraseña es muy larga');
        
        if (issues.length > 0) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: issues }, 
                        fieldErrors: {} as Record<string, string[]> 
                    }) 
                } 
            };
        }
        return { success: true as const, data: str };
    }
};

/**
 * Tipo inferido de paginationSchema
 */
export type PaginationInput = {
    page?: number;
    limit?: number;
    search?: string;
};

/**
 * Tipo inferido de idParamSchema
 */
export type IdParamInput = {
    id: string;
};

/**
 * Tipo inferido de dateRangeSchema
 */
export type DateRangeInput = {
    from?: string;
    to?: string;
};

// =============================================================================
// SUPPLIER SCHEMAS
// =============================================================================

import { z } from 'zod';

export const createSupplierSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    rut: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string().optional(),
    address: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
    isActive: z.boolean().optional(),
});