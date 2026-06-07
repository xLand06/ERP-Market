# Auditoría en Lenguaje Natural + Posición Consolidada

**Fecha:** 2026-06-06
**Estado:** Aprobado

## Objetivo

Mejorar el módulo de auditoría para que:
1. Muestre descripciones en lenguaje natural en vez de campos técnicos crudos
2. Para acciones monetarias, muestre montos con moneda y evite campos en inglés
3. Muestre posición consolidada (anterior + ingreso = total) en el panel de detalle

## Cambios en Backend

### 1. Enriquecer `logAudit` en los controllers

Cada llamada a `logAudit` debe guardar campos en español con más contexto.

**pos.controller.ts — `SALE_CREATE`:**
Agregar: `monto`, `moneda` (COP), `metodoPago`, `cantidadProductos`, `sucursalId`. Si hay caja abierta, consultar `cajaAnterior` y calcular `cajaNueva`.

**pos.controller.ts — `INVENTORY_IN`:**
Agregar: `monto`, `moneda`, `cantidadProductos`, y opcionalmente `cajaAnterior`/`cajaNueva` si hay caja abierta.

**cashFlow.controller.ts — `CASH_OPEN` / `CASH_CLOSE`:**
Renombrar campos a español: `montoApertura`, `montoCierre`, `diferencia`, `moneda`.

**Agregar `moneda` como campo estándar en el sistema** (hoy hardcodeado a "COP").

### 2. Servicio `audit.service.ts`

El método `getAuditLogs` y `getAuditLogById` deben devolver dos campos nuevos:

- **`descripcion`** (string): Frase generada a partir de los detalles. Ej: _"Juan Pérez registró una venta por $150.000 COP en Sucursal Centro (5 productos, pago en efectivo)"_
- **`posicionConsolidada`** (object | null): Solo si la acción es monetaria (venta, caja, entrada de inventario). Contiene `{ anterior, ingreso, total, moneda }`

La generación de `descripcion` se hace en el service mediante un helper `generarDescripcion(log)` que mapea cada `action` a una plantilla.

### 3. Helper `generarDescripcion`

Ubicación: `backend/src/modules/audit/audit.language.ts` (nuevo archivo)

Función pura que recibe el log con `user` incluido y devuelve un string. Soporta todas las acciones del `AuditActionType` con plantillas parametrizadas. Si no reconoce la acción, devuelve un fallback genérico.

## Cambios en Frontend

### 1. Interfaz `AuditLog` (auditService.ts)

Agregar campos opcionales:
```ts
descripcion?: string;
posicionConsolidada?: {
  anterior: number;
  ingreso: number;
  total: number;
  moneda: string;
};
```

### 2. `renderDetails` simplificado

Si el log tiene `descripcion`, usarla directamente con formato destacado.
Si no tiene (logs viejos), mantener el render actual como fallback.

### 3. Tarjeta de Posición Consolidada

Nuevo componente inline en `AuditLogsPage.tsx`, dentro del panel de detalle. Se muestra solo si `posicionConsolidada` existe.

Tres columnas con íconos:
```
🏦 Anterior: $500.000
💰 Ingreso:  $150.000
📊 Total:    $650.000
         COP
```

### 4. Reorganización del panel de detalle

Orden:
1. Encabezado (módulo + acción)
2. 📝 Descripción en lenguaje natural
3. 💰 Posición Consolidada (condicional)
4. 👤 Usuario responsable
5. 🔧 Datos técnicos (IP, fecha, user agent, ID)

## No se modifica

- Esquema de Prisma (los detalles siguen siendo JSON)
- Rutas y controllers (solo se enriquece el details que guardan)
- Tabla principal de logs (columnas sin cambios)
- Filtros y paginación
