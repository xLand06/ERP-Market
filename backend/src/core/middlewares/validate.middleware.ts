// =============================================================================
// VALIDATE MIDDLEWARE — Zod Validation Handler
// Middleware genérico para validar requests con Zod
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ZodTypeAny } from 'zod';

/**
 * Opciones de validación
 */
interface ValidateOptions {
    /** Validar body (default) */
    source?: 'body' | 'query' | 'params';
    /** Si es true, permite datos vacíos */
    allowEmpty?: boolean;
}

/**
 * Middleware de validación con Zod
 * @param schema - Esquema Zod a usar
 * @param options - Opciones de validación
 * 
 * @example
 * // Validar body
 * router.post('/products', validate(createProductSchema), controller);
 * 
 * // Validar query params
 * router.get('/products', validate(paginationSchema, { source: 'query' }), controller);
 * 
 * // Validar URL params
 * router.get('/products/:id', validate(idParamSchema, { source: 'params' }), controller);
 */
export const validate = (schema: any, options: ValidateOptions = {}) => {
    const { source = 'body' } = options;

    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const data = req[source];

        // Validar datos
        const result = schema.safeParse(data);

        if (!result.success) {
            console.error('[Validation Error]', JSON.stringify(result.error.flatten(), null, 2));
            const error = result.error;
            const formattedErrors: Record<string, string[]> = {};
            
            if (error && error.flatten) {
                const errors = error.flatten();
                
                // Form errors
                if (errors.formErrors?.formErrors) {
                    formattedErrors['_'] = errors.formErrors.formErrors;
                }
                
                // Field errors
                if (errors.fieldErrors) {
                    Object.entries(errors.fieldErrors).forEach(([field, messages]) => {
                        if (messages && Array.isArray(messages)) {
                            formattedErrors[field] = messages;
                        }
                    });
                }
            }

            res.status(400).json({
                error: 'Validation failed',
                details: formattedErrors,
            });
            return;
        }

        // Adjuntar datos validados al request
        if (source === 'body') {
            (req as any).validatedBody = result.data;
        } else if (source === 'query') {
            (req as any).validatedQuery = result.data;
        } else if (source === 'params') {
            (req as any).validatedParams = result.data;
        }

        next();
    };
};

/**
 * Middleware para extraer datos validados
 * @param source - De dónde obtener los datos (body, query, params)
 * 
 * @example
 * const { name, price } = validatedData(req, 'body');
 */
export const validatedData = (req: AuthRequest, source: 'body' | 'query' | 'params' = 'body') => {
    const key = source === 'body' ? 'validatedBody' : 
                source === 'query' ? 'validatedQuery' : 'validatedParams';
    return (req as any)[key];
};