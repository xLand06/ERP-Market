import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi, type Quote } from '@/services/quotes.service';
import toast from 'react-hot-toast';

/**
 * Lista cotizaciones (queryKey: ['quotes', branchId])
 */
export function useQuotes(branchId?: string) {
    return useQuery({
        queryKey: ['quotes', branchId],
        queryFn: () => quotesApi.listQuotes({ branchId }),
        retry: false,
    });
}

/**
 * Convierte una cotización en venta.
 * Al convertir: toast de éxito + refresh de la lista de cotizaciones y transacciones.
 */
export function useConvertQuote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, branchId }: { id: string; branchId?: string }) => {
            return quotesApi.convertQuote(id, branchId ? { branchId } : undefined);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            toast.success('Cotización convertida a venta correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al convertir la cotización');
        },
    });
}

export type { Quote }; // re-export util para los componentes