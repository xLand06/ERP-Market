# Kits Specification

## Purpose

Permite vender productos compuestos (kits) cuyo precio es la suma de componentes. Validación y deducción de stock por componente al vender.

## Requirements

### REQ-KI-01: Modelo KitComponent

Crear model `KitComponent`: `id`, `parentProductId` (Product), `componentProductId` (Product), `quantity Decimal`. Relación N:1 con Product padre. Un producto puede tener múltiples componentes.

### REQ-KI-02: Editor de kits en ProductForm

Formulario de producto MUST permitir agregar/quitar componentes con cantidad. Validación: componente no puede ser el mismo producto padre, cantidad > 0.

### REQ-KI-03: Expansión en POS

Al agregar kit al carrito, POS MUST expandirlo en sus componentes individuales. Cada componente se muestra como línea separada con su precio unitario. Precio kit = suma(componentes × cantidad).

### REQ-KI-04: Validación stock por componente

Al confirmar venta con kit, sistema MUST validar stock de CADA componente en la sucursal. Si algún componente tiene stock insuficiente, rechaza la venta completa.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products/:id/components` | Listar componentes del kit |
| PUT | `/api/products/:id/components` | Actualizar componentes (batch) |

## Schema Changes

**schema.prisma** — NUEVO model `KitComponent`: id String @id, quantity Decimal(12,3), parentProductId String → Product, componentProductId String → Product. @@unique([parentProductId, componentProductId]). Product: agregar relation `kitComponents KitComponent[]` (parent) + `usedInKits KitComponent[]` (component).

**schema.local.prisma** — idéntico sin @db.Decimal.

## Business Rules

- Precio de kit = suma(componente.price × componente.quantity).
- No se permite componente circular (A→B→A).
- Stock se valida por componente, no por kit como unidad.
- Si un componente no tiene BranchInventory en la sucursal, stock = 0.

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Stock componente insuficiente | 422 | `{ error: "Stock insuficiente para componente X", stock, requerido }` |
| Componente circular | 422 | `{ error: "No se permite componente circular" }` |
| Componente = producto padre | 422 | `{ error: "El producto no puede ser componente de sí mismo" }` |

## Scenarios

#### GIVEN kit "Combo A" con componente "Prod1" qty=2 y "Prod2" qty=1 WHEN agregar al carrito THEN expande en 2 líneas con precios individuales
#### GIVEN kit con componente que tiene stock=1 en sucursal WHEN vender kit qty=1 (requiere 2) THEN responde 422 stock insuficiente
#### GIVEN kit con componente en otra sucursal WHEN vender en sucursal B THEN stock=0, responde 422

## Files to Modify

- `backend/prisma/schema.prisma` — KitComponent, Product relations
- `backend/prisma/schema.local.prisma` — idéntico
- `backend/src/modules/products/products.service.ts` — CRUD componentes
- `backend/src/modules/pos/pos.service.ts` — expansión + validación stock
- `backend/src/core/validations/products.zod.ts` — zod kit
- `frontend/src/features/products/components/ProductFormModal.tsx` — editor kits
- `frontend/src/features/pos/hooks/useCart.ts` — expansión kit
