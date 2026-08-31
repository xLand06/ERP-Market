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

/**
 * Obtener tasas vivas de DolarApi
 */
export const getLiveDolarApiRates = async () => {
    const { fetchDolarApiRates } = await import('./dolarapi.service');
    return fetchDolarApiRates();
};

/**
 * Sincronizar y aplicar tasa seleccionada de DolarApi en DB local y audit log
 */
export const syncSelectedRateFromDolarApi = async (provider: string, userId: string, ipAddress: string) => {
    const { fetchDolarApiRates } = await import('./dolarapi.service');
    const liveRates = await fetchDolarApiRates();

    let rateToApply = 0;
    switch (provider) {
        case 've_dolar_oficial':
            rateToApply = liveRates.ve_dolar_oficial;
            break;
        case 've_dolar_paralelo':
            rateToApply = liveRates.ve_dolar_paralelo;
            break;
        case 've_euro_oficial':
            rateToApply = liveRates.ve_euro_oficial;
            break;
        case 've_euro_paralelo':
            rateToApply = liveRates.ve_euro_paralelo;
            break;
        default:
            throw new Error('Proveedor de tasa inválido');
    }

    if (rateToApply <= 0) {
        throw new Error('No se pudo obtener una tasa válida desde DolarApi');
    }

    // Actualizar tasa VES en la base de datos
    const updatedRate = await updateExchangeRate({ code: 'VES', rate: rateToApply });

    const { logAudit } = await import('../../core/middlewares/audit.middleware');
    await logAudit({
        action: 'FINANCE_DOLARAPI_SYNC',
        module: 'finance',
        details: { provider, rate: rateToApply, liveRates },
        userId,
        ipAddress,
    });

    return {
        rate: updatedRate,
        provider,
        appliedRate: rateToApply,
        liveRates,
    };
};
