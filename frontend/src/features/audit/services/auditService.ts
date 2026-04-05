import { api } from '../../../lib/api';

export interface AuditLog {
    id: string;
    action: string;
    module: string;
    details: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
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

export const getAuditLogs = async (filters: AuditFilters = {}) => {
    const { data } = await api.get<{ success: boolean; data: AuditLog[] }>('/audit', { params: filters });
    return data.data;
};

export const getAuditStats = async () => {
    const { data } = await api.get<{ success: boolean; data: any }>('/audit/stats');
    return data.data;
};
