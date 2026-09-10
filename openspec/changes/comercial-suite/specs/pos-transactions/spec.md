# Pos-Transactions (Modified) Specification

## Purpose

POS se extiende con soporte para cotizaciones (QUOTE) y kits. Este spec documenta los CAMBIOS al módulo POS existente.

## MODIFIED Requirements

### REQ-POS-01: Crear transacción (MODIFICADO)

El sistema MUST aceptar type `QUOTE` además de `SALE` e `INVENTORY_IN`. Para QUOTE: `cashRegisterId` es opcional, `paymentMethods` es opcional, stock NO se deduce.
(Previously: Solo aceptaba SALE e INVENTORY_IN con caja y stock obligatorio)

### REQ-POS-02: Expansión de kits en carrito (NUEVO)

Al agregar un producto con `KitComponent` al carrito, el sistema MUST expandirlo en sus componentes individuales, cada uno como línea separada con precio unitario del componente.
(Previously: No existía concepto de kit)

## API Endpoints (agregados)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pos/quotes` | Crear cotización (NUEVO) |
| GET | `/api/pos/quotes` | Listar cotizaciones (NUEVO) |
| PUT | `/api/pos/quotes/:id/convert` | Convertir quote→sale (NUEVO) |

## Schema Changes

- TransactionType: + `QUOTE`
- Transaction: + `customerId String?`, + `metadata Json?`

## Business Rules

- QUOTE no toca stock ni caja.
- Conversión quote→sale valida stock y requiere caja abierta.
- Conversión idempotente: quote ya convertida retorna venta existente.

## Scenarios

#### GIVEN carrito con kit "Combo" (2 componentes) WHEN agregar al carrito THEN expansion en 2 líneas con precios individuales
#### GIVEN cotización existente WHEN convertir a venta THEN deduce stock y registra en caja
#### GIVEN cotización ya convertida WHEN convertir nuevamente THEN retorna 200 con venta existente

## Files to Modify

- `backend/src/modules/pos/pos.service.ts` — cotizaciones + kits
- `backend/src/modules/pos/pos.routes.ts` — rutas cotizaciones
- `backend/src/core/validations/pos.zod.ts` — zod quotes
- `frontend/src/features/pos/hooks/useCart.ts` — expansión kit
- `frontend/src/features/pos/components/PaymentDialog.tsx` — selector cliente + crédito
