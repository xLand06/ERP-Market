// =============================================================================
// API TYPES — Tipos para respuestas de la API
// Coincide con backend/src/core/types/responses.ts
// =============================================================================

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ApiListResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

export interface ApiError {
    error: string;
    code?: string;
    details?: Record<string, string[]>;
}

export interface ApiSuccess {
    success: boolean;
    message?: string;
}

export type ApiEndpointResponse<T> =
    | ApiResponse<T>
    | ApiListResponse<T>
    | ApiError
    | ApiSuccess;

export interface ListParams {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
}

export interface DateRangeParams {
    from?: string;
    to?: string;
}

export interface IdParam {
    id: string;
}