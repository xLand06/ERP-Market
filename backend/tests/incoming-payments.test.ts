/**
 * INCOMING PAYMENTS INTEGRATION TESTS
 * - POST /api/incoming-payments/webhook (público, x-webhook-secret)
 * - GET  /api/incoming-payments?status=PENDING (cola)
 * - POST /api/incoming-payments (captura manual)
 * - POST /api/incoming-payments/:id/verify
 * - POST /api/incoming-payments/:id/reject
 * - Regresión: POST /api/customers/:id/payments (abono manual instantáneo)
 *
 * Nota de roles (roleGuard jerárquico: OWNER > MANAGER > SELLER):
 * verify/reject usan roleGuard('MANAGER') → OWNER ✅, MANAGER ✅, SELLER ❌ (403).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, prisma, SEED } from './setup';
import { loginAsOwner, loginAsSeller } from './helpers';

// Tasa VES sembrada en beforeEach para que amountBase = amountVes / RATE sea
// determinístico. (Sin fila VES, el servicio cae al fallback 3600 — mismo valor.)
const RATE = 3600;

// Mismo orden de precedencia que incoming-payments.routes.ts. Se evalúa en el
// momento de cada request, cuando setup.ts ya fijó JWT_SECRET='changeme'.
const webhookSecret = (): string =>
    process.env.PAYMENTS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'changeme';

// Referencia única por test para no colisionar con dedupe entre tests.
let refCounter = 0;
const uniqueRef = (): string => `${Date.now()}${(refCounter++).toString().padStart(3, '0')}`;

/** SMS de Pago Móvil con forma real (BDV 2662) */
const bdvSms = (phone: string, amount: string, ref: string) => ({
    sender: '2662',
    body: `BDV: Ha recibido Pago Movil de ${phone} por Bs ${amount} Ref ${ref} el 07/10/2026`,
    received_at: new Date().toISOString(),
});

const postWebhook = (payload: object, secret?: string) => {
    const req = request(app).post('/api/incoming-payments/webhook');
    if (secret !== undefined) req.set('x-webhook-secret', secret);
    return req.send(payload);
};

/** Crea cliente vía API y le fija un saldo known (la API no expone balance). */
const createCustomerWithBalance = async (name: string, balance: number, phone?: string): Promise<string> => {
    const res = await request(app)
        .post('/api/customers')
        .set(loginAsOwner())
        .send({ name, phone });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    await prisma.customer.update({ where: { id }, data: { balance } });
    return id;
};

const getBalance = async (customerId: string): Promise<number> => {
    const row = await prisma.customer.findUnique({ where: { id: customerId } });
    return Number(row!.balance);
};

describe('Incoming Payments Module', () => {
    beforeEach(async () => {
        // Limpieza propia: setup.ts no limpia estas tablas y este DB es exclusivo
        // de este archivo (UUID por worker). Orden por FK: hijas primero.
        await prisma.incomingPayment.deleteMany({});
        await prisma.customerPayment.deleteMany({});
        await prisma.customer.deleteMany({});
        await prisma.exchangeRate.upsert({
            where: { code: 'VES' },
            update: { rate: RATE },
            create: { code: 'VES', rate: RATE },
        });
    });

    // ─── WEBHOOK PÚBLICO ─────────────────────────────────────────────────────

    describe('POST /api/incoming-payments/webhook', () => {
        it('SMS BDV válido con secret correcto → crea reclamo PENDING/WEBHOOK con cliente sugerido por teléfono', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Feliz', 200, '04141234567');

            const res = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.accepted).toBe(true);
            expect(res.body.data.duplicate).toBe(false);

            const payment = res.body.data.payment;
            expect(payment.status).toBe('PENDING');
            expect(payment.source).toBe('WEBHOOK');
            expect(payment.amountVes).toBe(36000); // normalizado a number
            expect(payment.reference).toBe(ref);
            expect(payment.senderBank).toBe('BDV');
            expect(payment.senderPhone).toBe('04141234567');
            expect(payment.customerId).toBe(customerId); // match exacto por phone

            // Auditoría del webhook (sin usuario autenticado)
            const audit = await prisma.auditLog.findFirst({
                where: { action: 'PAYMENT_INCOMING_RECEIVED', module: 'incoming-payments' },
            });
            expect(audit).not.toBeNull();
            expect(audit!.userId).toBeNull();
        });

        it('GET /api/incoming-payments?status=PENDING muestra el reclamo con monto/referencia/banco parseados', async () => {
            const ref = uniqueRef();
            await createCustomerWithBalance('Cliente Lista', 100, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            expect(wh.status).toBe(200);

            const res = await request(app)
                .get('/api/incoming-payments')
                .query({ status: 'PENDING' })
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const row = res.body.data.find((p: any) => p.reference === ref);
            expect(row).toBeDefined();
            expect(row.status).toBe('PENDING');
            expect(row.amountVes).toBe(36000); // number, no string de Decimal
            expect(row.reference).toBe(ref);
            expect(row.senderBank).toBe('BDV');
        });

        it('secret incorrecto → 401 y no crea fila', async () => {
            const res = await postWebhook(bdvSms('04141234567', '1.500,00', uniqueRef()), 'wrong-secret');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/invalid webhook secret/i);
            expect(await prisma.incomingPayment.count()).toBe(0);
        });

        it('sin header x-webhook-secret → 401', async () => {
            const res = await postWebhook(bdvSms('04141234567', '1.500,00', uniqueRef()));

            expect(res.status).toBe(401);
            expect(await prisma.incomingPayment.count()).toBe(0);
        });

        it('misma referencia duplicada → duplicate:true y exactamente 1 fila en la cola', async () => {
            const ref = uniqueRef();
            await createCustomerWithBalance('Cliente Duplicado', 500, '04141234567');
            const sms = bdvSms('04141234567', '36.000,00', ref);

            const first = await postWebhook(sms, webhookSecret());
            expect(first.status).toBe(200);
            expect(first.body.data.duplicate).toBe(false);

            const second = await postWebhook(sms, webhookSecret());
            expect(second.status).toBe(200);
            expect(second.body.data.accepted).toBe(true);
            expect(second.body.data.duplicate).toBe(true);

            expect(await prisma.incomingPayment.count({ where: { reference: ref } })).toBe(1);
        });

        it('body no parseable con secret válido → 200 accepted:false y NO crea fila', async () => {
            const res = await postWebhook(
                {
                    sender: '2846',
                    body: 'Hola, ¿cómo estás? Recuerda que tu saldo disponible es 1.234,00 bolivares.',
                    received_at: new Date().toISOString(),
                },
                webhookSecret()
            );

            // 200 para que el dispositivo no entre en loop de reintentos
            expect(res.status).toBe(200);
            expect(res.body.data.accepted).toBe(false);
            expect(res.body.data.reason).toBe('unparseable');
            expect(await prisma.incomingPayment.count()).toBe(0);
        });
    });

    // ─── CAPTURA MANUAL ──────────────────────────────────────────────────────

    describe('POST /api/incoming-payments (captura manual)', () => {
        it('SELLER crea reclamo MANUAL PENDING', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Manual', 300, '04129876543');

            const res = await request(app)
                .post('/api/incoming-payments')
                .set(loginAsSeller())
                .send({
                    amountVes: 1500,
                    reference: ref,
                    senderPhone: '04129876543',
                    senderBank: 'Banesco',
                    customerId,
                    notes: 'Reclamo tomado en caja',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('PENDING');
            expect(res.body.data.source).toBe('MANUAL');
            expect(res.body.data.amountVes).toBe(1500);
            expect(res.body.data.reference).toBe(ref);
            expect(res.body.data.customerId).toBe(customerId);
        });

        it('referencia manual duplicada → 409', async () => {
            const ref = uniqueRef();
            const payload = { amountVes: 900, reference: ref };

            const first = await request(app)
                .post('/api/incoming-payments')
                .set(loginAsSeller())
                .send(payload);
            expect(first.status).toBe(201);

            const second = await request(app)
                .post('/api/incoming-payments')
                .set(loginAsSeller())
                .send(payload);
            expect(second.status).toBe(409);
        });
    });

    // ─── VERIFICACIÓN ────────────────────────────────────────────────────────

    describe('POST /api/incoming-payments/:id/verify', () => {
        it('OWNER verifica → APPLIED, abono transfer creado, saldo descontado amountVes/tasa y campos de auditoría en la fila', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Deudor', 200, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            const incomingId = wh.body.data.payment.id;

            const res = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('APPLIED');
            expect(res.body.data.appliedPaymentId).toBeTruthy();
            expect(res.body.data.verifiedAt).toBeTruthy();
            expect(res.body.data.verifiedById).toBe(SEED.ownerId);
            expect(res.body.data.exchangeRate).toBe(RATE);
            expect(res.body.data.amountBase).toBe(10); // 36000 / 3600

            // Abono CxC: method transfer + referencia del Pago Móvil preservada
            const payment = await prisma.customerPayment.findUnique({
                where: { id: res.body.data.appliedPaymentId },
            });
            expect(payment).not.toBeNull();
            expect(payment!.method).toBe('transfer');
            expect(payment!.reference).toBe(ref);
            expect(Number(payment!.amount)).toBe(10);
            expect(payment!.customerId).toBe(customerId);

            // Saldo descontado dentro de 0.01
            expect(Math.abs((await getBalance(customerId)) - 190)).toBeLessThan(0.01);

            // Auditoría con actor
            const audit = await prisma.auditLog.findFirst({
                where: { action: 'PAYMENT_VERIFIED', userId: SEED.ownerId },
            });
            expect(audit).not.toBeNull();
        });

        it('monto excede el saldo → 422 y NO cambia nada (fila PENDING, saldo intacto, sin abono)', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Pobre', 5, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            const incomingId = wh.body.data.payment.id;

            const res = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({});

            expect(res.status).toBe(422);
            expect(res.body.error).toMatch(/exceeds the pending balance/i);

            const row = await prisma.incomingPayment.findUnique({ where: { id: incomingId } });
            expect(row!.status).toBe('PENDING');
            expect(row!.appliedPaymentId).toBeNull();
            expect(await getBalance(customerId)).toBe(5);
            expect(await prisma.customerPayment.count({ where: { customerId } })).toBe(0);
        });

        it('verificar dos veces → segundo intento 409, sin doble abono', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Dos Veces', 200, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            const incomingId = wh.body.data.payment.id;

            const first = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({});
            expect(first.status).toBe(200);

            const second = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({});
            expect(second.status).toBe(409);

            // Un solo abono y un solo descuento
            expect(await prisma.customerPayment.count({ where: { customerId } })).toBe(1);
            expect(Math.abs((await getBalance(customerId)) - 190)).toBeLessThan(0.01);
        });

        it('sin match de teléfono → verify exige customerId; con customerId acredita al cliente elegido', async () => {
            const ref = uniqueRef();
            // Teléfono emisor que NO corresponde a ningún cliente
            const wh = await postWebhook(bdvSms('04249998877', '36.000,00', ref), webhookSecret());
            expect(wh.body.data.payment.customerId).toBeNull();
            const incomingId = wh.body.data.payment.id;

            // Sin customerId → 422 (todo el request se revierte)
            const noCustomer = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({});
            expect(noCustomer.status).toBe(422);
            expect(noCustomer.body.error).toMatch(/customerId is required/i);

            // El gestor elige el cliente manualmente
            const chosenId = await createCustomerWithBalance('Cliente Elegido', 100);
            const res = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsOwner())
                .send({ customerId: chosenId });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('APPLIED');
            expect(res.body.data.customerId).toBe(chosenId);
            expect(Math.abs((await getBalance(chosenId)) - 90)).toBeLessThan(0.01);
        });
    });

    // ─── RECHAZO ─────────────────────────────────────────────────────────────

    describe('POST /api/incoming-payments/:id/reject', () => {
        it('OWNER rechaza con motivo → REJECTED, saldo intacto, sin abono', async () => {
            const ref = uniqueRef();
            const customerId = await createCustomerWithBalance('Cliente Rechazado', 100, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            const incomingId = wh.body.data.payment.id;

            const res = await request(app)
                .post(`/api/incoming-payments/${incomingId}/reject`)
                .set(loginAsOwner())
                .send({ reason: 'La referencia no corresponde a esta tienda' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('REJECTED');
            expect(res.body.data.rejectReason).toBe('La referencia no corresponde a esta tienda');
            expect(res.body.data.verifiedById).toBe(SEED.ownerId);

            expect(await getBalance(customerId)).toBe(100);
            expect(await prisma.customerPayment.count({ where: { customerId } })).toBe(0);

            const audit = await prisma.auditLog.findFirst({
                where: { action: 'PAYMENT_REJECTED', userId: SEED.ownerId },
            });
            expect(audit).not.toBeNull();
        });
    });

    // ─── PERMISOS ────────────────────────────────────────────────────────────

    describe('permisos de rol', () => {
        it('SELLER no puede verificar ni rechazar → 403', async () => {
            const ref = uniqueRef();
            await createCustomerWithBalance('Cliente Protegido', 200, '04141234567');
            const wh = await postWebhook(bdvSms('04141234567', '36.000,00', ref), webhookSecret());
            const incomingId = wh.body.data.payment.id;

            const verifyRes = await request(app)
                .post(`/api/incoming-payments/${incomingId}/verify`)
                .set(loginAsSeller())
                .send({});
            expect(verifyRes.status).toBe(403);

            const rejectRes = await request(app)
                .post(`/api/incoming-payments/${incomingId}/reject`)
                .set(loginAsSeller())
                .send({ reason: 'no autorizado' });
            expect(rejectRes.status).toBe(403);

            // La fila queda intacta
            const row = await prisma.incomingPayment.findUnique({ where: { id: incomingId } });
            expect(row!.status).toBe('PENDING');
        });
    });

    // ─── REGRESIÓN: FLUJO PREVIO NO GATEADO ──────────────────────────────────

    describe('regresión: abono manual existente', () => {
        it('POST /api/customers/:id/payments aplica al instante (201, saldo descontado) — sin verificación', async () => {
            const customerId = await createCustomerWithBalance('Cliente Fiado', 100);

            const res = await request(app)
                .post(`/api/customers/${customerId}/payments`)
                .set(loginAsOwner())
                .send({ amount: 40, method: 'cash', reference: 'CAJA-001' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.method).toBe('cash');

            // Sin gating: el saldo baja de inmediato
            expect(Math.abs((await getBalance(customerId)) - 60)).toBeLessThan(0.01);
            const payment = await prisma.customerPayment.findFirst({ where: { customerId } });
            expect(payment).not.toBeNull();
            expect(payment!.method).toBe('cash');
        });
    });
});
