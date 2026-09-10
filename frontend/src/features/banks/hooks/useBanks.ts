import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '@/services/banks.service';
import toast from 'react-hot-toast';
import type { CreateBankAccountPayload, UpdateBankAccountPayload, CreateBankTransactionPayload } from '../types';

/**
 * Lista de cuentas bancarias (queryKey: ['bank-accounts'])
 */
export function useBankAccounts() {
    return useQuery({
        queryKey: ['bank-accounts'],
        queryFn: () => banksApi.getAccounts(),
        retry: false,
    });
}

/**
 * Resumen total de cuentas bancarias (queryKey: ['bank-summary'])
 */
export function useBankSummary() {
    return useQuery({
        queryKey: ['bank-summary'],
        queryFn: () => banksApi.getSummary(),
        retry: false,
    });
}

/**
 * Movimientos de una cuenta (queryKey: ['bank-transactions', accountId])
 */
export function useAccountTransactions(accountId: string | undefined) {
    return useQuery({
        queryKey: ['bank-transactions', accountId],
        queryFn: () => banksApi.getTransactions(accountId!),
        enabled: !!accountId,
        retry: false,
    });
}

/**
 * Crear una cuenta bancaria
 */
export function useCreateBankAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateBankAccountPayload) => {
            return banksApi.createAccount(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['bank-summary'] });
            toast.success('Cuenta bancaria creada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al crear la cuenta');
        },
    });
}

/**
 * Actualizar una cuenta bancaria
 */
export function useUpdateBankAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateBankAccountPayload & { id: string }) => {
            return banksApi.updateAccount(id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['bank-summary'] });
            toast.success('Cuenta actualizada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al actualizar la cuenta');
        },
    });
}

/**
 * Registrar un movimiento bancario (income | expense)
 */
export function useCreateBankTransaction(accountId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateBankTransactionPayload) => {
            return banksApi.createTransaction(accountId!, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['bank-transactions', accountId] });
            queryClient.invalidateQueries({ queryKey: ['bank-summary'] });
            toast.success('Movimiento registrado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err?.response?.data?.error || 'Error al registrar el movimiento');
        },
    });
}