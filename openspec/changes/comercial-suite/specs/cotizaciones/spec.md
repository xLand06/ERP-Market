# Cotizaciones Specification

## Purpose

Permite crear cotizaciones (presupuestos) que se convierten en ventas en POS. No afecta stock ni caja hasta la conversión.

## Requirements

### REQ-CO-01: TransactionType.QUOTE

Agregar `QUOTE` al enum `TransactionType` en ambos schemas. Cotización es una Transaction con status `PENDING` por defecto.

### REQ-CO-02: Crear cotización sin caja/pago/stock

Sistema MUST permitir crear cotización sin `cashRegisterId`, sin `paymentMethods` y sin deducir stock. `cashRegisterId` y `paymentMethods` son nullable.

### REQ-CO-03: Conversión idempotente quote→sale

Conversión de QUOTE a SALE MUST ser idempotente: si ya fue convertida, retorna la venta existente sin duplicar. Usa `metadata.quoteConvertedTo` en la venta resultante.

### REQ-CO-04: Lista de cotizaciones

Endpoint GET retorna cotizaciones con filtros por fecha, cliente y estado.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pos/quotes` | Crear cotización |
| GET | `/api/pos/quotes` | Listar cotizaciones |
| PUT | `/api/pos/quotes/:id/convert` | Convertir a venta |
| GET | `/api/pos/quotes/:id` | Detalle cotización |

## Schema Changes

**schema.prisma** — enum TransactionType: agregar `QUOTE`. Transaction: `metadata Json?` (almacena `quoteConvertedTo`).

**schema.local.prisma** — idéntico (Transaction.metadata como String?).

## Business Rules

- Cotización NO deduce stock ni toca caja.
- Conversión a venta SÍ deduce stock y requiere caja abierta.
- Si cotización ya fue convertida, PUT /convert retorna 200 con venta existente (no duplica).

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Conversión sin caja abierta | 422 | `{ error: "Se requiere caja abierta para convertir" }` |
| Conversión con stock insuficiente | 422 | `{ error: "Stock insuficiente para producto X" }` |
| Cotización ya convertida | 200 | Retorna venta existente con flag `alreadyConverted: true` |

## Scenarios

#### GIVEN items en carrito WHEN crear cotización THEN persiste Transaction type=QUOTE, status=PENDING, sin deducir stock
#### GIVEN cotización existente WHEN convertir a venta THEN crea Transaction type=SALE, deduce stock, registra en caja
#### GIVEN cotización ya convertida WHEN convertir nuevamente THEN retorna 200 con venta existente, no duplica
#### GIVEN cotización con 3 ítems WHEN listar THEN aparece con total calculado y estado PENDING

## Files to Modify

- `backend/prisma/schema.prisma` — enum + metadata field
- `backend/prisma/schema.local.prisma` — idéntico
- `backend/src/modules/pos/pos.service.ts` — lógica quotes
- `backend/src/modules/pos/pos.routes.ts` — rutas quotes
- `backend/src/core/validations/pos.zod.ts` — zod schemas
- `frontend/src/features/pos/` — componente cotización
