// =============================================================================
// CORE TYPES — ERP-MARKET
// Tipos genéricos y shared para toda la aplicación
// =============================================================================

/**
 * Respuesta paginada estándar
 */
export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

/**
 * Metadatos de paginación
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Opciones de paginación (input)
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}

/**
 * Tipos de rol del sistema
 */
export type UserRole = 'OWNER' | 'SELLER';

/**
 * Tipos de transacción
 */
export type TransactionType = 'SALE' | 'INVENTORY_IN';

/**
 * Estado de transacción
 */
export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'PENDING';

/**
 * Estado de caja
 */
export type CashRegisterStatus = 'OPEN' | 'CLOSED';

/**
 * Extensión de Request de Express para incluir usuario autenticado
 */
import { Request } from 'express';

export interface AuthUser {
    id: string;
    role: UserRole;
    name: string;
    email: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
    validated?: unknown;
}

/**
 * Error response estándar
 */
export interface ApiError {
    error: string;
    details?: Record<string, string[]>;
    code?: string;
}

/**
 * Success response estándar
 */
export interface ApiSuccess<T> {
    data: T;
    message?: string;
}