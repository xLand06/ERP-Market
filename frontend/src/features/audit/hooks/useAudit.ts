import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, getAuditStats } from './services/auditService';
import type { AuditFilters } from './services/auditService';

export function useAuditLogs(filters: AuditFilters = {}) {
    return useQuery({
        queryKey: ['audit-logs', filters],
        queryFn: () => getAuditLogs(filters),
        retry: false,
    });
}

export function useAuditStats() {
    return useQuery({
        queryKey: ['audit-stats'],
        queryFn: () => getAuditStats(),
        retry: false,
    });
}