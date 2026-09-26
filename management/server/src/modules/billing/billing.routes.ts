// =============================================================================
// BILLING — Tenant Self-Service Endpoints
// Permite a los dueños de bodes ver su estado y registrar pagos
// =============================================================================

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const router = Router();

/**
 * Middleware: valida que el request viene de un tenant válido
 * El tenant envía su slug + un shared secret en headers
 */
function tenantAuth(req: Request, res: Response, next: Function) {
    const slug = req.headers['x-tenant-slug'] as string;
    const secret = req.headers['x-tenant-secret'] as string;

    if (!slug || !secret) {
        res.status(401).json({ error: 'Credenciales de tenant requeridas' });
        return;
    }

    // El secret debe coincadir con el BILLING_SECRET del mgmt
    const expected = process.env.BILLING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production';
    if (secret !== expected) {
        res.status(401).json({ error: 'Secret inválido' });
        return;
    }

    // CRÍTICO: validar que el slug del header coincida con el slug de la ruta
    const paramSlug = (req.params as any)?.slug;
    if (paramSlug && paramSlug !== slug) {
        res.status(403).json({ error: 'Slug no autorizado' });
        return;
    }

    // Adjuntar el slug al request para uso posterior
    (req as any).tenantSlug = slug;
    next();
}

router.use(tenantAuth);

export interface PlanDefinition {
    id: string;
    name: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
    currency: string;
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
    features: string[];
}

export const CANONICAL_PLANS: Record<string, PlanDefinition> = {
    free: {
        id: 'free',
        name: 'Free / Trial',
        monthlyPriceCents: 0,
        annualPriceCents: 0,
        currency: 'USD',
        maxUsers: 2,
        maxBranches: 1,
        maxProducts: 250,
        features: ['Hasta 2 usuarios', '1 sucursal / caja', 'Hasta 250 productos', 'Prueba de 14 días'],
    },
    basic: {
        id: 'basic',
        name: 'Básico',
        monthlyPriceCents: 1000,
        annualPriceCents: 10000, // $100/año (Ahorro $20)
        currency: 'USD',
        maxUsers: 2,
        maxBranches: 1,
        maxProducts: 500,
        features: ['Hasta 2 usuarios cajeros', '1 sucursal / caja principal', 'Hasta 500 productos', 'Punto de venta e inventario', 'Flujo de caja y arqueos', 'Desktop App Offline incluida'],
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        monthlyPriceCents: 2000,
        annualPriceCents: 20000, // $200/año (Ahorro $40)
        currency: 'USD',
        maxUsers: 6,
        maxBranches: 2,
        maxProducts: 99999,
        features: ['Hasta 6 usuarios activos', 'Hasta 2 sucursales', 'Productos ilimitados', 'Clientes y Fiados (crédito)', 'Compras a Proveedores', 'Toma de inventario física por lotes', 'Desktop App Offline incluida'],
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        monthlyPriceCents: 3000,
        annualPriceCents: 30000, // $300/año (Ahorro $60)
        currency: 'USD',
        maxUsers: 999,
        maxBranches: 5,
        maxProducts: 99999,
        features: ['Usuarios ilimitados', 'Hasta 5 sucursales centralizadas', 'Productos ilimitados', 'Catálogo Digital en Línea público', 'Módulo de Bancos y Conciliación', 'Cotizaciones y presupuestos', 'Soporte prioritario 24/7', 'Desktop App Offline incluida'],
    },
};

/**
 * GET /api/billing/:slug/status
 * Retorna el estado de facturación del tenant
 */
router.get('/:slug/status', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: {
                id: true,
                slug: true,
                plan: true,
                billingCycle: true,
                status: true,
                subscriptionStartedAt: true,
                lastPaymentAt: true,
                nextPaymentDue: true,
                discountPercent: true,
                customPriceCents: true,
                systemNotice: true,
                noticeLevel: true,
            },
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }

        // Calcular días hasta vencimiento
        const now = new Date();
        const dueDate = tenant.nextPaymentDue ? new Date(tenant.nextPaymentDue) : null;
        const daysUntilDue = dueDate
            ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Determinar estado del pago
        let paymentStatus: 'current' | 'due_soon' | 'overdue' | 'unknown' = 'unknown';
        if (daysUntilDue !== null) {
            if (daysUntilDue > 7) paymentStatus = 'current';
            else if (daysUntilDue > 0) paymentStatus = 'due_soon';
            else paymentStatus = 'overdue';
        }

        const planKey = (tenant.plan || 'free').toLowerCase();
        const normalizedKey = planKey === 'basico' ? 'basic' : planKey;
        const plan = CANONICAL_PLANS[normalizedKey] || CANONICAL_PLANS.free;
        const currentCycle = tenant.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
        
        // Calcular precio considerando customPriceCents o discountPercent
        const baseMonthlyCents = tenant.customPriceCents ?? plan.monthlyPriceCents;
        const baseAnnualCents = tenant.customPriceCents ? (tenant.customPriceCents * 10) : plan.annualPriceCents;
        const discountFactor = tenant.discountPercent > 0 ? (1 - tenant.discountPercent / 100) : 1;

        const effectiveMonthlyCents = Math.round(baseMonthlyCents * discountFactor);
        const effectiveAnnualCents = Math.round(baseAnnualCents * discountFactor);
        const expectedPriceCents = currentCycle === 'ANNUAL' ? effectiveAnnualCents : effectiveMonthlyCents;

        // Verificar si tiene un pago pendiente
        const pendingPayment = await prisma.payment.findFirst({
            where: { tenantId: tenant.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                paymentCode: true,
                amountCents: true,
                billingCycle: true,
                periodMonths: true,
                provider: true,
                createdAt: true,
            },
        });

        // Últimos 5 pagos
        const recentPayments = await prisma.payment.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                amountCents: true,
                currency: true,
                status: true,
                provider: true,
                billingCycle: true,
                periodMonths: true,
                paymentCode: true,
                createdAt: true,
                paidAt: true,
            },
        });

        const canPay = paymentStatus !== 'current' && !pendingPayment;

        res.json({
            tenant: {
                slug: tenant.slug,
                plan: tenant.plan,
                billingCycle: currentCycle,
                status: tenant.status,
                discountPercent: tenant.discountPercent,
                customPriceCents: tenant.customPriceCents,
                systemNotice: tenant.systemNotice,
                noticeLevel: tenant.noticeLevel,
            },
            subscription: {
                plan: {
                    name: plan.name,
                    priceCents: expectedPriceCents,
                    monthlyPriceCents: effectiveMonthlyCents,
                    annualPriceCents: effectiveAnnualCents,
                    originalMonthlyPriceCents: plan.monthlyPriceCents,
                    originalAnnualPriceCents: plan.annualPriceCents,
                    currency: plan.currency,
                    maxUsers: plan.maxUsers,
                    maxBranches: plan.maxBranches,
                    maxProducts: plan.maxProducts,
                    features: plan.features,
                },
                discountPercent: tenant.discountPercent,
                customPriceCents: tenant.customPriceCents,
                systemNotice: tenant.systemNotice,
                noticeLevel: tenant.noticeLevel,
                billingCycle: currentCycle,
                availablePlans: CANONICAL_PLANS,
                paymentStatus,
                daysUntilDue,
                subscriptionStartedAt: tenant.subscriptionStartedAt,
                lastPaymentAt: tenant.lastPaymentAt,
                nextPaymentDue: tenant.nextPaymentDue,
                canPay,
                hasPendingPayment: Boolean(pendingPayment),
                pendingPayment: pendingPayment ? {
                    id: pendingPayment.id,
                    paymentCode: pendingPayment.paymentCode,
                    amount: pendingPayment.amountCents / 100,
                    billingCycle: pendingPayment.billingCycle || currentCycle,
                    periodMonths: pendingPayment.periodMonths || (currentCycle === 'ANNUAL' ? 12 : 1),
                    provider: pendingPayment.provider,
                    createdAt: pendingPayment.createdAt,
                } : null,
            },
            recentPayments: recentPayments.map(p => ({
                id: p.id,
                amount: p.amountCents / 100,
                currency: p.currency,
                status: p.status,
                provider: p.provider,
                billingCycle: p.billingCycle || 'MONTHLY',
                periodMonths: p.periodMonths || 1,
                paymentCode: p.paymentCode,
                createdAt: p.createdAt,
                paidAt: p.paidAt,
            })),
        });
    } catch (error) {
        console.error('[billing] Error obteniendo estado:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * POST /api/billing/:slug/pay
 * Registra un pago desde el tenant
 * El dueño envía: monto, método, referencia
 */
router.post('/:slug/pay', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const { amount, provider, reference, notes, billingCycle } = req.body;

        // Validaciones
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            res.status(422).json({ error: 'El monto debe ser un número mayor a 0' });
            return;
        }

        const VALID_PROVIDERS = ['zelle', 'pago_movil', 'binance', 'cash', 'other'];
        if (provider && !VALID_PROVIDERS.includes(provider)) {
            res.status(422).json({ error: 'Método de pago inválido' });
            return;
        }

        // Buscar tenant
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, slug: true, plan: true, billingCycle: true, nextPaymentDue: true },
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }

        // 1. Validar si la cuenta está al día (más de 7 días antes de la fecha de corte)
        const now = new Date();
        const dueDate = tenant.nextPaymentDue ? new Date(tenant.nextPaymentDue) : null;
        const daysUntilDue = dueDate
            ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        if (daysUntilDue !== null && daysUntilDue > 7) {
            res.status(400).json({
                error: `Tu cuenta se encuentra al día (vence en ${daysUntilDue} días). Podrás registrar tu pago durante los 7 días previos a la fecha de corte.`,
                code: 'PAYMENT_NOT_DUE',
                daysUntilDue,
                nextPaymentDue: tenant.nextPaymentDue,
            });
            return;
        }

        // 2. Validar si ya existe un pago pendiente de confirmación
        const existingPending = await prisma.payment.findFirst({
            where: { tenantId: tenant.id, status: 'PENDING' },
        });

        if (existingPending) {
            res.status(400).json({
                error: `Ya tienes un pago pendiente de confirmación (${existingPending.paymentCode}). Espera a que el administrador lo verifique.`,
                code: 'PAYMENT_ALREADY_PENDING',
                paymentCode: existingPending.paymentCode,
            });
            return;
        }

        // Generar paymentCode
        const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const randomBase32 = (len: number) => {
            let result = '';
            for (let i = 0; i < len; i++) {
                result += BASE32[Math.floor(Math.random() * BASE32.length)];
            }
            return result;
        };

        let paymentCode = '';
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = 'ALLCODE-' + randomBase32(6);
            const existing = await prisma.payment.findUnique({ where: { paymentCode: code } });
            if (!existing) {
                paymentCode = code;
                break;
            }
        }

        if (!paymentCode) {
            res.status(500).json({ error: 'No se pudo generar código de pago' });
            return;
        }

        const cycle = (billingCycle === 'ANNUAL' || billingCycle === 'annual')
            ? 'ANNUAL'
            : (billingCycle === 'MONTHLY' || billingCycle === 'monthly')
                ? 'MONTHLY'
                : (tenant.billingCycle || 'MONTHLY');
        const periodMonths = cycle === 'ANNUAL' ? 12 : 1;

        // Crear pago como PENDING (el admin lo confirma)
        const amountCents = Math.round(amount * 100);
        const payment = await prisma.payment.create({
            data: {
                tenantId: tenant.id,
                amountCents,
                currency: 'USD',
                status: 'PENDING',
                provider: provider || 'other',
                billingCycle: cycle,
                periodMonths,
                externalId: reference || null,
                paymentCode,
                notes: notes || null,
                dueDate: new Date(),
            },
        });

        console.log(
            `[billing] Pago ${paymentCode} registrado por tenant ${slug} — ` +
            `${amountCents} cents via ${provider || 'other'}`
        );

        res.status(201).json({
            success: true,
            paymentCode: payment.paymentCode,
            message: 'Pago registrado. Será confirmado por el administrador.',
        });
    } catch (error) {
        console.error('[billing] Error registrando pago:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
