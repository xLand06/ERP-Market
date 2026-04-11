// =============================================================================
// PRODUCTS VALIDATIONS — Zod Schemas
// Validaciones para el módulo de productos
// =============================================================================

/**
 * Esquema para validar ID en parámetros URL
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
 * Esquema para crear un producto
 */
export const createProductSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const fieldErrors: Record<string, string[]> = {};
        
        // Name validation
        const name = obj?.name as string;
        if (!name || name.length < 2) {
            fieldErrors['name'] = ['El nombre debe tener al menos 2 caracteres'];
        } else if (name.length > 200) {
            fieldErrors['name'] = ['El nombre es muy largo'];
        }
        
        // Description (optional)
        const description = obj?.description as string | undefined;
        if (description && description.length > 500) {
            fieldErrors['description'] = ['La descripción es muy larga'];
        }
        
        // Barcode (optional)
        const barcode = obj?.barcode as string | undefined;
        if (barcode && barcode.length > 50) {
            fieldErrors['barcode'] = ['El código de barras es muy largo'];
        }
        
        // Price validation
        const price = obj?.price;
        if (price === undefined || price === null || price === '') {
            fieldErrors['price'] = ['El precio es requerido'];
        } else {
            const priceNum = Number(price);
            if (isNaN(priceNum)) {
                fieldErrors['price'] = ['El precio debe ser un número'];
            } else if (priceNum <= 0) {
                fieldErrors['price'] = ['El precio debe ser mayor a 0'];
            } else if (priceNum > 999999.99) {
                fieldErrors['price'] = ['El precio excede el límite permitido'];
            }
        }
        
        // Cost (optional)
        const cost = obj?.cost;
        if (cost !== undefined && cost !== null && cost !== '') {
            const costNum = Number(cost);
            if (isNaN(costNum) || costNum <= 0) {
                fieldErrors['cost'] = ['El costo debe ser mayor a 0'];
            }
        }
        
        // Image URL (optional)
        const imageUrl = obj?.imageUrl as string | undefined;
        if (imageUrl && imageUrl.length > 0) {
            try {
                new URL(imageUrl);
            } catch {
                fieldErrors['imageUrl'] = ['URL de imagen inválida'];
            }
        }
        
        // Category ID (optional)
        const categoryId = obj?.categoryId as string | undefined;
        if (categoryId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(categoryId)) {
                fieldErrors['categoryId'] = ['ID de categoría inválido'];
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
        
        return { 
            success: true as const, 
            data: {
                name,
                description,
                barcode,
                price: Number(price),
                cost: cost ? Number(cost) : undefined,
                imageUrl: imageUrl || undefined,
                categoryId: categoryId || undefined,
                isActive: obj?.isActive !== undefined ? Boolean(obj.isActive) : true,
            }
        };
    }
};

/**
 * Esquema para actualizar un producto
 */
export const updateProductSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        const fieldErrors: Record<string, string[]> = {};
        
        // Name (optional)
        if (obj.name !== undefined) {
            const name = obj.name as string;
            if (name.length < 2) {
                fieldErrors['name'] = ['El nombre debe tener al menos 2 caracteres'];
            } else if (name.length > 200) {
                fieldErrors['name'] = ['El nombre es muy largo'];
            } else {
                result.name = name;
            }
        }
        
        // Description (optional)
        if (obj.description !== undefined) {
            const description = obj.description as string;
            if (description && description.length > 500) {
                fieldErrors['description'] = ['La descripción es muy larga'];
            } else {
                result.description = description || undefined;
            }
        }
        
        // Barcode (optional)
        if (obj.barcode !== undefined) {
            const barcode = obj.barcode as string;
            if (barcode && barcode.length > 50) {
                fieldErrors['barcode'] = ['El código de barras es muy largo'];
            } else {
                result.barcode = barcode || undefined;
            }
        }
        
        // Price (optional)
        if (obj.price !== undefined) {
            const price = obj.price;
            if (price !== null && price !== '') {
                const priceNum = Number(price);
                if (isNaN(priceNum)) {
                    fieldErrors['price'] = ['El precio debe ser un número'];
                } else if (priceNum <= 0) {
                    fieldErrors['price'] = ['El precio debe ser mayor a 0'];
                } else if (priceNum > 999999.99) {
                    fieldErrors['price'] = ['El precio excede el límite permitido'];
                } else {
                    result.price = priceNum;
                }
            }
        }
        
        // Cost (optional)
        if (obj.cost !== undefined) {
            const cost = obj.cost;
            if (cost !== null && cost !== '') {
                const costNum = Number(cost);
                if (isNaN(costNum) || costNum <= 0) {
                    fieldErrors['cost'] = ['El costo debe ser mayor a 0'];
                } else {
                    result.cost = costNum;
                }
            }
        }
        
        // Image URL (optional)
        if (obj.imageUrl !== undefined) {
            const imageUrl = obj.imageUrl as string;
            if (imageUrl && imageUrl.length > 0) {
                try {
                    new URL(imageUrl);
                    result.imageUrl = imageUrl;
                } catch {
                    fieldErrors['imageUrl'] = ['URL de imagen inválida'];
                }
            } else {
                result.imageUrl = undefined;
            }
        }
        
        // Category ID (optional)
        if (obj.categoryId !== undefined) {
            const categoryId = obj.categoryId as string;
            if (categoryId) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(categoryId)) {
                    fieldErrors['categoryId'] = ['ID de categoría inválido'];
                } else {
                    result.categoryId = categoryId;
                }
            } else {
                result.categoryId = undefined;
            }
        }
        
        // isActive (optional)
        if (obj.isActive !== undefined) {
            result.isActive = Boolean(obj.isActive);
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
 * Filtros para listar productos
 */
export const productFiltersSchema = {
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
        
        if (obj?.search) result.search = String(obj.search);
        if (obj?.categoryId) result.categoryId = String(obj.categoryId);
        if (obj?.isActive !== undefined) result.isActive = obj.isActive === 'true' || obj.isActive === true;
        
        return { success: true as const, data: result };
    }
};

/**
 * Tipo inferido de createProductSchema
 */
export type CreateProductInput = {
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    isActive?: boolean;
};

/**
 * Tipo inferido de updateProductSchema
 */
export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * Tipo inferido de productFiltersSchema
 */
export type ProductFiltersInput = {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    isActive?: boolean;
};