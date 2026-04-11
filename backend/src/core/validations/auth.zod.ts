// =============================================================================
// AUTH VALIDATIONS — Zod Schemas
// Login por username/cedula Venezuela
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

const usernameSchema = z.string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(20, 'El usuario debe tener máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos');

const cedulaSchema = z.string()
    .regex(/^[VE]-[0-9]{6,8}$/, 'Formato: V-12345678 o E-12345678')
    .min(8, 'Cédula inválida')
    .max(10, 'Cédula inválida');

const nombreSchema = z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es muy largo');

const telefonoSchema = z.string()
    .regex(/^[0-9]{10,15}$/, 'Teléfono inválido')
    .optional();

const emailSchema = z.string().email('Email inválido').optional();

const loginSchemaBase = z.object({
    username: usernameSchema,
    password: z.string().min(1, 'La contraseña es requerida'),
});

const registerSchemaBase = z.object({
    username: usernameSchema,
    cedula: cedulaSchema,
    cedulaType: z.enum(['V', 'E']).default('V'),
    nombre: nombreSchema,
    apellido: z.string().max(100).optional(),
    email: emailSchema,
    telefono: telefonoSchema,
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
        
        if (obj.username !== undefined) {
            const username = obj.username as string;
            if (username.length < 3 || username.length > 20) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { username: ['Usuario debe tener entre 3 y 20 caracteres'] } 
                        }) 
                    } 
                };
            }
            result.username = username.toLowerCase();
        }
        
        if (obj.cedula !== undefined) {
            const cedulaRegex = /^[VE]-[0-9]{6,8}$/;
            if (!cedulaRegex.test(obj.cedula as string)) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { cedula: ['Formato: V-12345678 o E-12345678'] } 
                        }) 
                    } 
                };
            }
            result.cedula = (obj.cedula as string).toUpperCase();
        }
        
        if (obj.nombre !== undefined) {
            const nombre = obj.nombre as string;
            if (nombre.length < 2 || nombre.length > 100) {
                return { 
                    success: false as const, 
                    error: { 
                        flatten: () => ({ 
                            formErrors: { formErrors: [] }, 
                            fieldErrors: { nombre: ['Nombre debe tener entre 2 y 100 caracteres'] } 
                        }) 
                    } 
                };
            }
            result.nombre = nombre;
        }
        
        if (obj.apellido !== undefined) result.apellido = obj.apellido;
        if (obj.email !== undefined) result.email = (obj.email as string)?.toLowerCase();
        if (obj.telefono !== undefined) result.telefono = obj.telefono;
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
    username?: string;
    cedula?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
};