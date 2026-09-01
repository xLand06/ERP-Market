import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ReportAuditData } from '@/components/common/ThermalAuditTicket';

export function useReportX(registerId: string | null) {
    return useQuery<ReportAuditData>({
        queryKey: ['report-x', registerId],
        queryFn: async () => {
            if (!registerId) throw new Error('ID de caja requerido');
            const res = await api.get(`/cash-flow/registers/${registerId}/report-x`);
            return {
                ...res.data.data,
                type: 'X',
            };
        },
        enabled: !!registerId,
        staleTime: 0,
    });
}

export interface ExecuteReportZParams {
    registerId: string;
    physicalCounts?: {
        countedCOP?: number;
        countedUSD?: number;
        countedVES?: number;
        usdRate?: number;
        vesRate?: number;
    };
    closingAmount: number;
    notes?: string;
}

export function useExecuteReportZ() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ registerId, physicalCounts, closingAmount, notes }: ExecuteReportZParams) => {
            const res = await api.post(`/cash-flow/registers/${registerId}/report-z`, {
                physicalCounts,
                closingAmount,
                notes,
            });
            return res.data.data as ReportAuditData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['openRegister'] });
            queryClient.invalidateQueries({ queryKey: ['cash-entries'] });
            queryClient.invalidateQueries({ queryKey: ['cashRegisterHistory'] });
            toast.success('Cierre de caja (Reporte Z) ejecutado exitosamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Error al ejecutar Reporte Z');
        },
    });
}
