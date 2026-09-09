// =============================================================================
// FINANCE MODULE — SERVICE
// Lógica para tasas de cambio y configuraciones financieras
// =============================================================================

import { prisma } from '../../config/prisma';
import { UpdateExchangeRateInput } from '../../core/validations/finance.zod';

// ── In-memory cache para tasas de cambio ─────────────────────────
// Las tasas cambian poco (1-2 veces al día). Un cache de 5 min
// elimina ~95% de las queries a PostgreSQL en uso normal.
const RATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const rateCache = new Map<string, { data: any; expires: number }>();

function getCachedRates() {
    const cached = rateCache.get('all');
    if (cached && Date.now() < cached.expires) return cached.data;
    return null;
}

function setCachedRates(data: any) {
    rateCache.set('all', { data, expires: Date.now() + RATE_CACHE_TTL });
}

function invalidateRateCache() {
    rateCache.clear();
}

/**
 * Obtener todas las tasas de cambio (con cache en memoria)
 */
export const getExchangeRates = async () => {
    const cached = getCachedRates();
    if (cached) return cached;

    const rates = await prisma.exchangeRate.findMany({
        orderBy: { code: 'asc' },
    });

    setCachedRates(rates);
    return rates;
};

/**
 * Actualizar o crear una tasa de cambio
 */
export const updateExchangeRate = async (data: UpdateExchangeRateInput) => {
    const { code, rate } = data;
    
    const result = await prisma.exchangeRate.upsert({
        where: { code },
        update: { rate },
        create: { code, rate },
    });

    // Invalidar cache para que el próximo GET traiga datos frescos
    invalidateRateCache();

    return result;
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

    // updateExchangeRate ya invalida el cache internamente

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
