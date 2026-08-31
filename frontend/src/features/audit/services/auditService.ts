import { api } from '../../../lib/api';
import { ApiResponse } from '../../../types';

export interface AuditLog {
    id: string;
    action: string;
    module: string;
    details: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    user?: {
        id: string;
        username?: string;
        nombre?: string;
        apellido?: string | null;
        name?: string;
        email?: string | null;
        role?: string;
    } | null;
    // Campos enriquecidos (generados por el backend)
    descripcion?: string;
    posicionConsolidada?: {
        anterior: number;
        ingreso: number;
        total: number;
        moneda: string;
    } | null;
}

export interface AuditFilters {
    userId?: string;
    action?: string;
    module?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

export const getAuditLogs = async (filters: AuditFilters = {}): Promise<AuditLog[]> => {
    // Corregida la ruta para que coincida con backend (audit/logs)
    const { data } = await api.get<ApiResponse<AuditLog[]>>('/audit/logs', { params: filters });
    return data.data;
};

export const getAuditStats = async (): Promise<any> => {
    const { data } = await api.get<ApiResponse<any>>('/audit/stats');
    return data.data;
};
