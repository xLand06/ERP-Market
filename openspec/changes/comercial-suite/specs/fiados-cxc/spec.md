# Fiados / CxC Specification

## Purpose

Gestiona crédito a clientes: modelo Customer, ventas a crédito en POS, cobranzas parciales/totales, estado de cuenta por cliente.

## Requirements

### REQ-FC-01: Modelo Customer

Crear model `Customer` con campos: `id`, `nombre`, `cedula`, `telefono?`, `email?`, `limiteCredito Decimal`, `saldoPendiente Decimal`, `isActive`, `createdAt`, `updatedAt`. Relación 1:N con Transaction (campo `customerId?`).

### REQ-FC-02: Venta a crédito en POS

POS MUST aceptar venta sin pago inmediato cuando se selecciona un cliente. `Transaction.customerId` vincula la venta. `paymentMethods` puede ser vacío para ventas a crédito.

### REQ-FC-03: Cobranzas (abonos)

Endpoint para registrar abonos parciales o totales sobre una venta a crédito. Abono es `CustomerPayment` con: `id`, `monto`, `metodoPago`, `referencia?`, `transactionId`, `customerId`, `createdAt`.

### REQ-FC-04: Estado de cuenta

Endpoint GET retorna historial de ventas a crédito y abonos de un cliente con saldo calculado.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/customers` | Crear cliente |
| GET | `/api/customers` | Listar clientes |
| PUT | `/api/customers/:id` | Editar cliente |
| GET | `/api/customers/:id/account` | Estado de cuenta |
| POST | `/api/customers/:id/payments` | Registrar abono |
| GET | `/api/customers/:id/payments` | Historial de abonos |

## Schema Changes

**schema.prisma** — NUEVO model `Customer`: id, nombre, cedula, telefono?, email?, limiteCredito Decimal(12,2) @default(0), saldoPendiente Decimal(12,2) @default(0), isActive, createdAt, updatedAt. NUEVO model `CustomerPayment`: id, monto Decimal(12,2), metodoPago String, referencia?, transactionId, customerId, createdAt. Transaction: agregar `customerId String?` + relation Customer.

**schema.local.prisma** — idéntico sin @db.Decimal.

## Business Rules

- `saldoPendiente` se recalcula al registrar abono: saldo -= monto.
- Si saldo + nueva venta > limiteCredito, MUST rechazar (422).
- Abono parcial reduce saldo proporcionalmente.
- Abono total cierra la deuda y actualiza saldo a 0.

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Crédito excede límite | 422 | `{ error: "Límite de crédito excedido", limite, saldo, venta }` |
| Abono mayor al saldo | 422 | `{ error: "El abono excede el saldo pendiente" }` |
| Cliente inactivo | 422 | `{ error: "Cliente desactivado" }` |

## Scenarios

#### GIVEN cliente con limiteCredito=100000 WHEN vender a crédito por 50000 THEN saldoPendiente = 50000
#### GIVEN cliente con saldo 50000 WHEN abonar 20000 THEN saldoPendiente = 30000
#### GIVEN cliente con saldo 50000 y limite 100000 WHEN vender 60000 THEN responde 422 "Límite de crédito excedido"
#### GIVEN cliente con saldo 30000 WHEN abonar 30000 THEN saldoPendiente = 0, deuda cerrada

## Files to Modify

- `backend/prisma/schema.prisma` — Customer, CustomerPayment, Transaction.customerId
- `backend/prisma/schema.local.prisma` — idéntico
- `backend/src/modules/customers/` — NUEVO módulo completo
- `backend/src/modules/pos/pos.service.ts` — soporte customerId en ventas
- `backend/src/core/validations/customers.zod.ts` — NUEVO
- `frontend/src/features/customers/` — NUEVO módulo
