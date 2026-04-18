// =============================================================================
// FINANCE MODULE — SERVICE
// Lógica para tasas de cambio y configuraciones financieras
// =============================================================================

import { prisma } from '../../config/prisma';
import { UpdateExchangeRateInput } from '../../core/validations/finance.zod';

/**
 * Obtener todas las tasas de cambio
 */
export const getExchangeRates = async () => {
    return prisma.exchangeRate.findMany({
        orderBy: { code: 'asc' },
    });
};

/**
 * Actualizar o crear una tasa de cambio
 */
export const updateExchangeRate = async (data: UpdateExchangeRateInput) => {
    const { code, rate } = data;
    
    return prisma.exchangeRate.upsert({
        where: { code },
        update: { rate },
        create: { code, rate },
    });
};

/**
 * Obtener una tasa específica por código
 */
export const getRateByCode = async (code: string) => {
    return prisma.exchangeRate.findUnique({
        where: { code: code.toUpperCase() },
    });
};
