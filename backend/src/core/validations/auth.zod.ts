// =============================================================================
// AUTH VALIDATIONS — Zod Schemas
// Login por username/cedula Venezuela
// =============================================================================

import { z } from 'zod';

/**
 * Esquema base para validación de fuerza de contraseña
 */
const passwordStrengthSchema = z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .refine((pwd) => /[A-Z]/.test(pwd), 'Debe tener al menos una letra mayúscula')
    .refine((pwd) => /[a-z]/.test(pwd), 'Debe tener al menos una letra minúscula')
    .refine((pwd) => /[0-9]/.test(pwd), 'Debe tener al menos un número')
    .refine((pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd), 'Debe tener al menos un carácter especial (!@#$%^&*...)');

/**
 * Esquema base para username (alfanumérico)
 */
const usernameSchema = z.string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(20, 'El usuario debe tener máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
    .transform(val => val.toLowerCase());

/**
 * Esquema base para cédula de identidad Venezuela
 */
const cedulaSchema = z.string()
    .regex(/^[VE]-[0-9]{6,8}$/, 'Formato: V-12345678 o E-12345678')
    .transform(val => val.toUpperCase());

/**
 * Esquema de Login
 */
export const loginSchema = z.object({
    username: z.string().min(1, 'El usuario es requerido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

/**
 * Esquema de Registro / Creación de Usuario
 */
export const registerSchema = z.object({
    username: usernameSchema,
    cedula: cedulaSchema,
    cedulaType: z.enum(['V', 'E']).default('V'),
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    apellido: z.string().max(100).optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string().regex(/^[0-9]{10,15}$/, 'Teléfono inválido').optional().or(z.literal('')),
    password: passwordStrengthSchema,
    role: z.enum(['OWNER', 'SELLER']).default('SELLER'),
    branchId: z.string().cuid('ID de sucursal inválido').optional(),
});

/**
 * Esquema de Actualización de Usuario
 * Se usa .partial() para que todos los campos sean opcionales
 */
export const updateUserSchema = registerSchema.omit({ 
    password: true,
    cedulaType: true 
}).partial().extend({
    isActive: z.boolean().optional(),
    password: passwordStrengthSchema.optional(), // Opcional por si se quiere cambiar
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
