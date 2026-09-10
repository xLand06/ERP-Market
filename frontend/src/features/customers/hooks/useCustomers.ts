import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/services/customers.service';
import toast from 'react-hot-toast';
import type { CreateCustomerPayload, UpdateCustomerPayload, RecordPaymentPayload } from '../types';

/**
 * Lista de clientes (queryKey: ['customers', params])
 */
export function useCustomers(params?: { search?: string; isActive?: boolean }) {
    return useQuery({
        queryKey: ['customers', params],
        queryFn: () => customersApi.getCustomers(params),
        retry: false,
    });
}

/**
 * Detalle de un cliente (queryKey: ['customer', id])
 */
export function useCustomer(id: string | undefined) {
    return useQuery({
        queryKey: ['customer', id],
        queryFn: () => customersApi.getCustomerById(id!),
        enabled: !!id,
        retry: false,
    });
}

/**
 * Estado de cuenta de un cliente (saldo + ventas a crédito + abonos)
 */
export function useCustomerStatement(id: string | undefined) {
    return useQuery({
        queryKey: ['customer-statement', id],
        queryFn: () => customersApi.getCustomerStatement(id!),
        enabled: !!id,
        retry: false,
    });
}

/**
 * Crear un cliente
 */
export function useCreateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateCustomerPayload) => {
            return customersApi.createCustomer(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Cliente creado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al crear el cliente');
        },
    });
}

/**
 * Actualizar un cliente
 */
export function useUpdateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateCustomerPayload & { id: string }) => {
            return customersApi.updateCustomer(id, payload);
        },
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['customer', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['customer-statement', vars.id] });
            toast.success('Cliente actualizado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al actualizar el cliente');
        },
    });
}

/**
 * Registrar un abono (cobranza)
 */
export function useRecordPayment(customerId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: RecordPaymentPayload) => {
            return customersApi.recordPayment(customerId!, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-statement', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Abono registrado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al registrar el abono');
        },
    });
}