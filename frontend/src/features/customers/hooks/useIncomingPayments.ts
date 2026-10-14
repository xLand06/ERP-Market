// =============================================================================
// USE INCOMING PAYMENTS HOOKS — Cola de pagos Pago Móvil por verificar
// Mismo patrón que useCustomers.ts (React Query + react-hot-toast).
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { incomingPaymentsApi } from '@/services/incoming-payments.service';
import type {
    CreateIncomingPaymentPayload,
    IncomingPaymentStatus,
    RejectIncomingPaymentPayload,
    VerifyIncomingPaymentPayload,
} from '@/services/incoming-payments.service';

/** Toast helper: el backend responde { success:false, error } |
 *  { response: { data: { error, saldo? } } } según el caso */
const apiErrorMessage = (error: unknown): string | undefined =>
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error;

/**
 * Cola de pagos entrantes (queryKey: ['incoming-payments', 'queue', status])
 */
export function useIncomingPaymentsQueue(status: IncomingPaymentStatus = 'PENDING', limit = 100) {
    return useQuery({
        queryKey: ['incoming-payments', 'queue', status],
        queryFn: () => incomingPaymentsApi.getIncomingPayments({ status, limit }),
        retry: false,
    });
}

/**
 * Captura manual de un reclamo (SELLER+)
 */
export function useCreateIncomingPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateIncomingPaymentPayload) => {
            return incomingPaymentsApi.createIncomingPayment(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incoming-payments'] });
            // El campana del TopBar consume ['/notifications'] (poll cada 60s);
            // se invalida por si migra a React Query.
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Pago registrado correctamente. Pendiente de verificación.');
        },
        onError: (error: unknown) => {
            toast.error(apiErrorMessage(error) || 'Error al registrar el pago');
        },
    });
}

/**
 * Verificar (acreditar) un reclamo pendiente (MANAGER+)
 */
export function useVerifyIncomingPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: VerifyIncomingPaymentPayload & { id: string }) => {
            return incomingPaymentsApi.verifyIncomingPayment(id, payload);
        },
        onSuccess: (payment, vars) => {
            const creditedCustomerId = vars.customerId || payment.customerId;
            queryClient.invalidateQueries({ queryKey: ['incoming-payments'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            if (creditedCustomerId) {
                queryClient.invalidateQueries({ queryKey: ['customer-statement', creditedCustomerId] });
                queryClient.invalidateQueries({ queryKey: ['customer', creditedCustomerId] });
                queryClient.invalidateQueries({ queryKey: ['customers'] });
            }
            toast.success('Pago verificado correctamente');
        },
        onError: (error: unknown) => {
            // 422 del backend cuando el monto supera el saldo del cliente
            const saldo = (error as { response?: { data?: { saldo?: number } } })?.response?.data?.saldo;
            if (saldo !== undefined) {
                toast.error(`El pago excede el saldo pendiente del cliente ($${Number(saldo).toFixed(2)})`);
                return;
            }
            toast.error(apiErrorMessage(error) || 'Error al verificar el pago');
        },
    });
}

/**
 * Rechazar un reclamo pendiente (no toca saldo) (MANAGER+)
 */
export function useRejectIncomingPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: RejectIncomingPaymentPayload & { id: string }) => {
            return incomingPaymentsApi.rejectIncomingPayment(id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incoming-payments'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Pago rechazado');
        },
        onError: (error: unknown) => {
            toast.error(apiErrorMessage(error) || 'Error al rechazar el pago');
        },
    });
}
