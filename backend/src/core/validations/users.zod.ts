// =============================================================================
// USERS VALIDATIONS — Zod Schemas
// =============================================================================

/**
 * Esquema para crear usuario (solo OWNER puede crear)
 */
export const createUserSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const fieldErrors: Record<string, string[]> = {};
        
        const name = obj?.name as string;
        if (!name || name.length < 2) {
            fieldErrors['name'] = ['El nombre debe tener al menos 2 caracteres'];
        } else if (name.length > 100) {
            fieldErrors['name'] = ['El nombre es muy largo'];
        }
        
        const email = obj?.email as string;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            fieldErrors['email'] = ['Email inválido'];
        }
        
        const password = obj?.password as string;
        if (!password || password.length < 6) {
            fieldErrors['password'] = ['La contraseña debe tener al menos 6 caracteres'];
        } else if (password.length > 100) {
            fieldErrors['password'] = ['La contraseña es muy larga'];
        }
        
        const role = obj?.role as string;
        if (role && !['OWNER', 'SELLER'].includes(role)) {
            fieldErrors['role'] = ['Rol inválido'];
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
                email: email.toLowerCase(), 
                password, 
                role: (role as 'OWNER' | 'SELLER') || 'SELLER',
                isActive: true,
            } 
        };
    }
};

/**
 * Esquema para filtros de usuarios
 */
export const userFiltersSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        
        if (obj?.role && ['OWNER', 'SELLER'].includes(obj.role as string)) {
            result.role = obj.role;
        }
        
        if (obj?.isActive !== undefined) {
            result.isActive = obj.isActive === 'true' || obj.isActive === true;
        }
        
        if (obj?.search) {
            result.search = String(obj.search);
        }
        
        return { success: true as const, data: result };
    }
};

/**
 * Tipo inferido de createUserSchema
 */
export type CreateUserInput = {
    name: string;
    email: string;
    password: string;
    role?: 'OWNER' | 'SELLER';
};

/**
 * Tipo inferido de userFiltersSchema
 */
export type UserFiltersInput = {
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
    search?: string;
};