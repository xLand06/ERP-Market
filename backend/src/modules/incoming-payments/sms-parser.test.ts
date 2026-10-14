/**
 * SMS PARSER — Unit tests for Pago Móvil SMS parsing.
 * Pure functions only: no DB, no Prisma import.
 */

import { describe, it, expect } from 'vitest';
import { parsePagoMovilSms } from './sms-parser';

const BDV_SENDER = '2662';
const BANESCO_SENDER = '2846';
const MERCANTIL_SENDER = '24024';

describe('parsePagoMovilSms', () => {
    it('parses a BDV SMS (thousands dot + decimal comma)', () => {
        const result = parsePagoMovilSms(
            BDV_SENDER,
            'BDV: Ha recibido Pago Movil de 04141234567 por Bs 1.450,50 Ref 0987654321 el 07/10/2026'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(1450.5);
        expect(result!.reference).toBe('0987654321');
        expect(result!.senderPhone).toBe('04141234567');
        expect(result!.senderBank).toBe('BDV');
    });

    it('parses a Banesco SMS with masked account', () => {
        const result = parsePagoMovilSms(
            BANESCO_SENDER,
            'Banesco: Su cuenta 0134****1234 ha recibido un Pago Móvil de Bs 120.000,75 de 04161112233 Ref 99887766'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(120000.75);
        expect(result!.reference).toBe('99887766');
        expect(result!.senderPhone).toBe('04161112233');
        expect(result!.senderBank).toBe('Banesco');
    });

    it('parses a Mercantil SMS', () => {
        const result = parsePagoMovilSms(
            MERCANTIL_SENDER,
            'Mercantil: Recibiste Pago Movil por Bs 1.500,00 de 04241234567 Ref 123123'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(1500);
        expect(result!.reference).toBe('123123');
        expect(result!.senderPhone).toBe('04241234567');
        expect(result!.senderBank).toBe('Mercantil');
    });

    it('parses plain decimal amounts (1450.50)', () => {
        const result = parsePagoMovilSms(
            BDV_SENDER,
            'BDV: Ha recibido Pago Movil de 04141234567 por Bs 1450.50 Ref 12345678'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(1450.5);
        expect(result!.reference).toBe('12345678');
    });

    it('parses integer amounts without separators', () => {
        const result = parsePagoMovilSms(
            MERCANTIL_SENDER,
            'Mercantil: Recibiste Pago Movil por Bs 1500 Ref 654321'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(1500);
        expect(result!.reference).toBe('654321');
    });

    it('supports the Referencia keyword', () => {
        const result = parsePagoMovilSms(
            BANESCO_SENDER,
            'Banesco: Abono a su cuenta por Bs 300,50 Referencia 554433 de 04121234567'
        );
        expect(result).not.toBeNull();
        expect(result!.amountVes).toBe(300.5);
        expect(result!.reference).toBe('554433');
    });

    it('infers the bank from the sender code when the body has no bank keyword', () => {
        const result = parsePagoMovilSms(
            '2661',
            'Ha recibido Pago Movil de 04141234567 por Bs 1.000,00 Ref 555666777'
        );
        expect(result).not.toBeNull();
        expect(result!.senderBank).toBe('BDV');
    });

    it('falls back to a body keyword when the sender code is unknown', () => {
        const result = parsePagoMovilSms(
            '99999',
            'Mercantil: Recibiste Pago Movil por Bs 900,00 de 04241234567 Ref 778899'
        );
        expect(result).not.toBeNull();
        expect(result!.senderBank).toBe('Mercantil');
    });

    it('leaves senderPhone undefined when the SMS has no phone', () => {
        const result = parsePagoMovilSms(
            BDV_SENDER,
            'BDV: Ha recibido Pago Movil por Bs 1.450,50 Ref 0987654321'
        );
        expect(result).not.toBeNull();
        expect(result!.senderPhone).toBeUndefined();
    });

    it('returns null for a garbage body without an amount', () => {
        const result = parsePagoMovilSms(
            BANESCO_SENDER,
            'Hola, ¿cómo estás? Recuerda que tu saldo disponible es 1.234,00 bolivares.'
        );
        expect(result).toBeNull();
    });

    it('returns null when the reference is missing', () => {
        const result = parsePagoMovilSms(
            BDV_SENDER,
            'BDV: Ha recibido Pago Movil por Bs 1.500,00 el 07/10/2026'
        );
        expect(result).toBeNull();
    });

    it('returns null when the amount is zero', () => {
        const result = parsePagoMovilSms(
            BANESCO_SENDER,
            'Banesco: Pago Movil por Bs 0,00 Ref 123456'
        );
        expect(result).toBeNull();
    });
});
