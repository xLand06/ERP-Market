// =============================================================================
// CATEGORIES VALIDATIONS — Zod Schemas
// =============================================================================

/**
 * Esquema para crear categoría
 */
export const createCategorySchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const fieldErrors: Record<string, string[]> = {};
        
        const name = obj?.name as string;
        if (!name || name.length < 2) {
            fieldErrors['name'] = ['El nombre debe tener al menos 2 caracteres'];
        } else if (name.length > 100) {
            fieldErrors['name'] = ['El nombre es muy largo'];
        }
        
        const description = obj?.description as string | undefined;
        if (description && description.length > 500) {
            fieldErrors['description'] = ['La descripción es muy larga'];
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
            data: { name, description: description || undefined } 
        };
    }
};

/**
 * Esquema para actualizar categoría
 */
export const updateCategorySchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        const fieldErrors: Record<string, string[]> = {};
        
        if (obj.name !== undefined) {
            const name = obj.name as string;
            if (name.length < 2) {
                fieldErrors['name'] = ['El nombre debe tener al menos 2 caracteres'];
            } else if (name.length > 100) {
                fieldErrors['name'] = ['El nombre es muy largo'];
            } else {
                result.name = name;
            }
        }
        
        if (obj.description !== undefined) {
            const description = obj.description as string;
            if (description && description.length > 500) {
                fieldErrors['description'] = ['La descripción es muy larga'];
            } else {
                result.description = description || undefined;
            }
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
        
        return { success: true as const, data: result };
    }
};

/**
 * Tipo inferido de createCategorySchema
 */
export type CreateCategoryInput = {
    name: string;
    description?: string;
};

/**
 * Tipo inferido de updateCategorySchema
 */
export type UpdateCategoryInput = Partial<CreateCategoryInput>;