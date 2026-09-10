# Plan Enforcement Specification

## Purpose

Controla límites de plan (usuarios, sucursales, productos) en backend. Fuente de verdad: middleware rechaza 422 si se excede el límite.

## Requirements

### REQ-PE-01: PlanConfig por tier

Sistema MUST consultar SystemSetting key `planConfig` (JSON: `{ maxUsers, maxBranches, maxProducts }`) para validar límites.

### REQ-PE-02: Middleware de enforcement

Middleware MUST interceptar operaciones POST/PUT en `users`, `branches`, `products` y verificar conteo actual vs límite antes de ejecutar. Responder 422 `{ error: string, limit: number, current: number }` al exceder.

### REQ-PE-03: Frontend como hint

Frontend MUST mostrar warning visual cuando el usuario esté cerca del límite (≥80%), pero backend es source of truth.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/plan-config` | Retorna config del plan actual |

## Schema Changes

**schema.prisma** — sin modelos nuevos; SystemSetting key `planConfig` almacena JSON.

**schema.local.prisma** — idéntico.

## Business Rules

- Valores por defecto si no existe planConfig: maxUsers=999, maxBranches=99, maxProducts=9999.
- Plan enforcement aplica SOLO a ALL MARKET tier (flag en SystemSetting).
- Soft-delete no cuenta: solo usuarios/branches/products con `isActive=true`.

## Error Handling

| Caso | Código | Respuesta |
|------|--------|-----------|
| Usuarios excedidos | 422 | `{ error: "Límite de usuarios alcanzado", limit, current }` |
| Sucursales excedidas | 422 | `{ error: "Límite de sucursales alcanzado", limit, current }` |
| Productos excedidos | 422 | `{ error: "Límite de productos alcanzado", limit, current }` |

## Scenarios

#### GIVEN planConfig = { maxUsers: 3 } WHEN crear 4to usuario activo THEN responde 422 con mensaje de límite
#### GIVEN planConfig = { maxBranches: 2 } WHEN crear 3ra sucursal THEN responde 422
#### GIVEN 250 productos activos y maxProducts = 250 WHEN crear producto THEN responde 422
#### GIVEN usuario desactivado que no cuenta para el límite WHEN crear nuevo usuario THEN permite si count < max

## Files to Modify

- `backend/src/middleware/plan-enforcement.ts` — NUEVO middleware
- `backend/src/modules/settings/settings.routes.ts` — agregar GET plan-config
- `frontend/src/lib/planConfig.ts` — sincronizar con backend
