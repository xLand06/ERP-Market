# Catálogo Digital Specification

## Purpose

Endpoint público que muestra productos activos de una sucursal sin autenticación. Página standalone accesible vía slug compartible.

## Requirements

### REQ-CD-01: Endpoint público

GET `/api/catalog/:slug` MUST retornar productos activos de la sucursal asociada al slug. No requiere auth. Productos inactivos están excluidos.

### REQ-CD-02: Slug en SystemSetting

SystemSetting key `catalogSlug` almacena JSON: `{ slug: string, branchId: string, socialLinks: { whatsapp?, instagram?, facebook? } }`.

### REQ-CD-03: Página standalone

Frontend: ruta `/catalogo/:slug`渲染iza una página standalone sin layout del ERP. Muestra nombre, precio, imagen, descripción de cada producto.

### REQ-CD-04: Link compartible

El slug genera URL amigable: `/catalogo/mi-tienda`. El endpoint accepta cualquier slug y resuelve la sucursal.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/catalog/:slug` | Catálogo público de productos |
| GET | `/api/catalog/:slug/product/:id` | Detalle de producto |

## Schema Changes

**schema.prisma** — sin modelos nuevos. SystemSetting key `catalogSlug` almacena config.

**schema.local.prisma** — idéntico.

## Business Rules

- Solo productos con `isActive=true` aparecen en el catálogo.
- Slug debe ser único; si no existe, retorna 404.
- No expone stock, costos ni datos internos.
- socialLinks es opcional en la respuesta.

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Slug inexistente | 404 | `{ error: "Catálogo no encontrado" }` |
| Sucursal inactiva | 404 | `{ error: "Sucursal no disponible" }` |

## Scenarios

#### GIVEN slug "mi-tienda" asociado a sucursal activa WHEN GET /api/catalog/mi-tienda THEN retorna productos activos con nombre, precio, imagen
#### GIVEN producto inactivo en la sucursal WHEN consultar catálogo THEN no aparece en la respuesta
#### GIVEN slug inexistente WHEN GET /api/catalog/noexiste THEN responde 404

## Files to Modify

- `backend/src/modules/catalog/` — NUEVO módulo (routes, controller, service)
- `backend/src/core/validations/catalog.zod.ts` — NUEVO
- `frontend/src/pages/CatalogPage.tsx` — NUEVO (standalone)
