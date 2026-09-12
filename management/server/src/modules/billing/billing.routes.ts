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

    // El secret debe coincadir con el JWT secret del tenant
    const expected = process.env.BILLING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production';
    if (secret !== expected) {
        res.status(401).json({ error: 'Secret inválido' });
        return;
    }

    // Adjuntar el slug al request para uso posterior
    (req as any).tenantSlug = slug;
    next();
}

router.use(tenantAuth);

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
                status: true,
                lastPaymentAt: true,
                nextPaymentDue: true,
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

        // Planes y precios
        const plans: Record<string, { name: string; priceCents: number; currency: string }> = {
            free: { name: 'Free', priceCents: 0, currency: 'USD' },
            basic: { name: 'Básico', priceCents: 1500, currency: 'USD' },
            pro: { name: 'Pro', priceCents: 2500, currency: 'USD' },
        };

        const plan = plans[tenant.plan] || plans.free;

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
                paymentCode: true,
                createdAt: true,
                paidAt: true,
            },
        });

        res.json({
            tenant: {
                slug: tenant.slug,
                plan: tenant.plan,
                status: tenant.status,
            },
            subscription: {
                plan: plan,
                paymentStatus,
                daysUntilDue,
                lastPaymentAt: tenant.lastPaymentAt,
                nextPaymentDue: tenant.nextPaymentDue,
            },
            recentPayments: recentPayments.map(p => ({
                id: p.id,
                amount: p.amountCents / 100,
                currency: p.currency,
                status: p.status,
                provider: p.provider,
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
        const { amount, provider, reference, notes } = req.body;

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
            select: { id: true, slug: true, plan: true },
        });

        if (!tenant) {
            res.status(404).json({ error: 'Tenant no encontrado' });
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

        // Crear pago como PENDING (el admin lo confirma)
        const amountCents = Math.round(amount * 100);
        const payment = await prisma.payment.create({
            data: {
                tenantId: tenant.id,
                amountCents,
                currency: 'USD',
                status: 'PENDING',
                provider: provider || 'other',
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
