# CxP (Cuentas por Pagar) Specification

## Purpose

Registra pagos a proveedores contra órdenes de compra. Estado de cuenta proveedor con saldos pendientes.

## Requirements

### REQ-CX-01: PaidAmount y dueDate en PurchaseOrder

Agregar campos `paidAmount Decimal @default(0)` y `dueDate DateTime?` a PurchaseOrder. `paidAmount` rastrea cuánto se ha pagado de la orden.

### REQ-CX-02: Modelo SupplierPayment

Crear model `SupplierPayment`: `id`, `monto Decimal`, `metodoPago String`, `referencia?`, `purchaseOrderId`, `supplierId`, `createdAt`.

### REQ-CX-03: Registrar pago a proveedor

Endpoint POST para registrar pago parcial o total sobre una PurchaseOrder. `paidAmount` se incrementa con cada pago. Si paidAmount >= total, orden cambia a status `RECEIVED`.

### REQ-CX-04: Panel de cuentas por pagar

Endpoint GET retorna órdenes con saldo pendiente (total - paidAmount > 0), agrupadas por proveedor.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/suppliers/:id/payments` | Registrar pago a proveedor |
| GET | `/api/suppliers/:id/payments` | Historial de pagos del proveedor |
| GET | `/api/suppliers/payable` | Cuentas por pagar (todas las órdenes con saldo) |
| GET | `/api/purchase-orders/:id` | Detalle con saldo |

## Schema Changes

**schema.prisma** — PurchaseOrder: agregar `paidAmount Decimal @default(0) @db.Decimal(12,2)`, `dueDate DateTime? @db.Timestamptz`. NUEVO model `SupplierPayment`: id, monto Decimal(12,2), metodoPago String, referencia?, purchaseOrderId → PurchaseOrder, supplierId → Supplier, createdAt.

**schema.local.prisma** — idéntico sin @db.Decimal ni @db.Timestamptz.

## Business Rules

- Pago parcial: paidAmount += monto. Si paidAmount >= total → status = RECEIVED.
- Pago excede saldo pendiente: rechazar (422).
- No se puede pagar orden con status CANCELLED.
- dueDate es opcional; usado para priorización en panel de CxP.

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Pago excede saldo pendiente | 422 | `{ error: "El pago excede el saldo pendiente", pendiente, monto }` |
| Orden cancelada | 422 | `{ error: "No se puede pagar una orden cancelada" }` |
| Orden no encontrada | 404 | `{ error: "Orden de compra no encontrada" }` |

## Scenarios

#### GIVEN orden de compra por 500000 con paidAmount=0 WHEN pagar 200000 THEN paidAmount=200000, status sigue SENT
#### GIVEN orden por 500000 con paidAmount=400000 WHEN pagar 100000 THEN paidAmount=500000, status cambia a RECEIVED
#### GIVEN orden por 500000 con paidAmount=400000 WHEN pagar 200000 THEN responde 422 "excede saldo pendiente"
#### GIVEN 3 órdenes pendientes de 2 proveedores WHEN consultar /payable THEN retorna 3 órdenes agrupadas por proveedor con saldo

## Files to Modify

- `backend/prisma/schema.prisma` — SupplierPayment, PurchaseOrder fields
- `backend/prisma/schema.local.prisma` — idéntico
- `backend/src/modules/suppliers/suppliers.service.ts` — pagos
- `backend/src/modules/suppliers/suppliers.routes.ts` — rutas pagos
- `backend/src/core/validations/suppliers.zod.ts` — zod pagos
- `frontend/src/features/suppliers/` — panel CxP
