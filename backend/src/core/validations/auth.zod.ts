// =============================================================================
// AUTH VALIDATIONS — Zod Schemas
// Validaciones para el módulo de autenticación
// =============================================================================

import { z } from 'zod';

const passwordStrengthSchema = z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .refine(
        (pwd) => /[A-Z]/.test(pwd),
        { message: 'Debe tener al menos una letra mayúscula' }
    )
    .refine(
        (pwd) => /[a-z]/.test(pwd),
        { message: 'Debe tener al menos una letra minúscula' }
    )
    .refine(
        (pwd) => /[0-9]/.test(pwd),
        { message: 'Debe tener al menos un número' }
    )
    .refine(
        (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
        { message: 'Debe tener al menos un carácter especial (!@#$%^&*...)' }
    );

const emailSchema = z.string().email('Email inválido');

const loginSchemaBase = z.object({
    email: emailSchema,
    password: passwordStrengthSchema,
});

const registerSchemaBase = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es muy largo'),
    email: emailSchema,
    password: passwordStrengthSchema,
    role: z.enum(['OWNER', 'SELLER']).optional(),
});

export const loginSchema = {
    parse: (data: unknown) => {
        try {
            const parsed = loginSchemaBase.parse(data);
            return { data: parsed, error: null };
        } catch (e) {
            if (e instanceof z.ZodError) {
                return { data: null, error: e.errors[0].message };
            }
            return { data: null, error: 'Validación fallida' };
        }
    },
    safeParse: loginSchemaBase.safeParse,
};

export const registerSchema = {
    parse: (data: unknown) => {
        try {
            const parsed = registerSchemaBase.parse(data);
            return { data: parsed, error: null };
        } catch (e) {
            if (e instanceof z.ZodError) {
                const messages = e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
                return { data: null, error: messages };
            }
            return { data: null, error: 'Validación fallida' };
        }
    },
    safeParse: registerSchemaBase.safeParse,
};

export const updateUserSchema = {
    safeParse: function(data: unknown) {
        const obj = data as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        
        if (obj.name !== undefined) {
            const name = obj.name as string;
            if (name.length < 2) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { name: ['El nombre debe tener al menos 2 caracteres'] } 
                        }) 
                    } 
                };
            }
            if (name.length > 100) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { name: ['El nombre es muy largo'] } 
                        }) 
                    } 
                };
            }
            result.name = name;
        }
        
        if (obj.email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(obj.email as string)) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { email: ['Email inválido'] } 
                        }) 
                    } 
                };
            }
            result.email = (obj.email as string).toLowerCase();
        }
        
        if (obj.role !== undefined && !['OWNER', 'SELLER'].includes(obj.role as string)) {
            return { 
                success: false as const, 
                error: { 
                    flatten: () => ({ 
                        formErrors: { formErrors: [] }, 
                        fieldErrors: { role: ['Rol inválido'] } 
                    }) 
                } 
            };
        }
        
        if (obj.role !== undefined) result.role = obj.role;
        if (obj.isActive !== undefined) result.isActive = obj.isActive;
        
        return { success: true as const, data: result };
    }
};

export type LoginInput = z.infer<typeof loginSchemaBase>;
export type RegisterInput = z.infer<typeof registerSchemaBase>;
export type UpdateUserInput = {
    name?: string;
    email?: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
};