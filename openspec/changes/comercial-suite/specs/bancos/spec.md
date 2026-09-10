# Bancos Specification

## Purpose

Gestiona cuentas bancarias y transacciones bancarias (ingresos/egresos). Conciliación básica con movimientos.

## Requirements

### REQ-BA-01: Modelo BankAccount

Crear model `BankAccount`: `id`, `nombre`, `tipo` (enum: AHORRO|CORRIENTE|CAJA|OTRO), `saldoInicial Decimal`, `saldoActual Decimal`, `isActive`, `createdAt`, `updatedAt`.

### REQ-BA-02: Modelo BankTransaction

Crear model `BankTransaction`: `id`, `tipo` (enum: INGRESO|EGRESO|TRASLADO), `monto Decimal`, `descripcion`, `referencia?`, `fecha DateTime`, `bankAccountId`, `relatedTransactionId?`, `createdAt`.

### REQ-BA-03: Módulo banks

CRUD completo de cuentas y transacciones bancarias. `saldoActual` se actualiza automáticamente al registrar transacciones.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/banks/accounts` | Crear cuenta bancaria |
| GET | `/api/banks/accounts` | Listar cuentas con saldo |
| PUT | `/api/banks/accounts/:id` | Editar cuenta |
| POST | `/api/banks/accounts/:id/transactions` | Registrar transacción |
| GET | `/api/banks/accounts/:id/transactions` | Historial de transacciones |
| GET | `/api/banks/summary` | Resumen total de todas las cuentas |

## Schema Changes

**schema.prisma** — NUEVO enum `BankAccountType { AHORRO CORRIENTE CAJA OTRO }`. NUEVO enum `BankTransactionType { INGRESO EGRESO TRASLADO }`. NUEVO model `BankAccount`: id, nombre, tipo BankAccountType, saldoInicial Decimal(12,2), saldoActual Decimal(12,2), isActive, createdAt, updatedAt. NUEVO model `BankTransaction`: id, tipo BankTransactionType, monto Decimal(12,2), descripcion, referencia?, fecha DateTime, bankAccountId → BankAccount, relatedTransactionId?, createdAt.

**schema.local.prisma** — idéntico sin @db.Decimal.

## Business Rules

- INGRESO incrementa saldoActual, EGRESO decrementa.
- TRASLADO crea 2 transacciones (egreso en origen, ingreso en destino).
- saldoActual se calcula en tiempo real: saldoInicial + sum(INGRESOS) - sum(EGRESOS).
- No se permite eliminación de transacciones (solo anulación con transacción de reversa).

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| EGRESO excede saldo | 422 | `{ error: "Saldo insuficiente", saldo, monto }` |
| Cuenta inactiva | 422 | `{ error: "Cuenta desactivada" }` |
| Traslado misma cuenta | 422 | `{ error: "No se puede trasladar a la misma cuenta" }` |

## Scenarios

#### GIVEN cuenta "Banco X" con saldo 500000 WHEN registrar INGRESO de 100000 THEN saldoActual = 600000
#### GIVEN cuenta con saldo 50000 WHEN registrar EGRESO de 60000 THEN responde 422 saldo insuficiente
#### GIVEN dos cuentas A (saldo 200000) y B (saldo 100000) WHEN trasladar 50000 de A a B THEN A=150000, B=150000

## Files to Modify

- `backend/prisma/schema.prisma` — enums + BankAccount, BankTransaction
- `backend/prisma/schema.local.prisma` — idéntico
- `backend/src/modules/banks/` — NUEVO módulo completo
- `backend/src/core/validations/banks.zod.ts` — NUEVO
- `frontend/src/features/banks/` — NUEVO módulo
