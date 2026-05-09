# Lotes y Vencimientos — Lógica del Sistema

## ¿Qué problema resuelve?

Un bodegón recibe mercancía con lotes del proveedor y fechas de vencimiento.
Sin tracking de lotes:
- No sabés qué productos están próximos a vencer
- No podés priorizar la venta por fecha (FIFO)
- Las mermas por vencimiento no se pueden anticipar

El sistema de lotes permite **trazar cada lote desde que llega hasta que se vende o vence**.

---

## Modelo de datos

```prisma
model ProductBatch {
  id         String   @id @default(cuid())
  batchCode  String                    // código de lote del proveedor
  expiryDate DateTime                  // fecha de vencimiento
  quantity   Decimal  @default(0)      // stock actual de ESTE lote
  costPrice  Decimal?                  // precio de costo de este lote

  productId String
  product   Product @relation(...)

  branchId String
  branch   Branch @relation(...)

  @@unique([batchCode, productId, branchId])  // un lote por producto+sucursal
  @@index([productId, branchId])
  @@index([expiryDate])
}
```

### Restricciones

- **Unicidad**: no puede haber dos lotes con el mismo código para el mismo producto en la misma sucursal
- **Cantidad**: cuando se recibe más mercancía del mismo lote, se incrementa la cantidad (no se crea un duplicado)
- **Índice por fecha**: búsqueda rápida de productos próximos a vencer

---

## Ciclo de vida de un lote

```
CREACIÓN (manual o por compra)
    │
    ▼
LOTE ACTIVO (quantity > 0)
    │
    ├── Se vende → quantity decrece (futuro: FIFO por fecha)
    │
    ├── Vence → aparece en /api/batches/expired
    │      │
    │      └── Se registra merma → quantity = 0
    │
    └── Se recibe más del mismo lote → quantity incrementa
```

---

## Formas de crear lotes

### 1. Manualmente por API (OWNER)

```
POST /api/batches
{
  "batchCode": "LOTE-001",
  "productId": "cuid...",
  "branchId": "cuid...",
  "expiryDate": "2026-12-31",
  "quantity": 100,
  "costPrice": 5000
}
```

Solo OWNER puede crear lotes. Valida que no exista un lote con el mismo `batchCode + productId + branchId`.

### 2. Al recibir una orden de compra (automático)

Cuando una PurchaseOrder cambia a estado `RECEIVED`, el sistema busca información de lote en el campo `notes` de cada item de la orden.

**Formato JSON (recomendado):**

Cada item del array `items` en la orden debe tener en su campo `notes`:

```json
{
  "batchCode": "LOTE-001",
  "expiryDate": "2026-12-31"
}
```

**Formato legacy (compatible):**

```
batch:LOTE-001|expiry:2026-12-31
```

Si no hay datos de lote, el comportamiento es exactamente igual que antes — la orden se recibe, se actualiza stock y costos, **pero no se crea ningún lote**.

Si el lote ya existe (mismo batchCode + productId + branchId), se **incrementa la cantidad** del lote existente. Si no existe, se **crea uno nuevo** con `costPrice = unitCost` del item.

---

## Endpoints de lotes

| Método | Ruta | ¿Quién? | Descripción |
|--------|------|---------|-------------|
| `GET` | `/api/batches` | Cualquiera | Listar lotes con filtros por branchId, productId, expiryBefore, expiryAfter |
| `GET` | `/api/batches/expiring?days=30` | Cualquiera | Lotes próximos a vencer (stock > 0) |
| `GET` | `/api/batches/expired` | Cualquiera | Lotes vencidos (stock > 0) |
| `GET` | `/api/batches/:id` | Cualquiera | Detalle completo de un lote |
| `POST` | `/api/batches` | OWNER | Crear lote |
| `PATCH` | `/api/batches/:id` | OWNER | Actualizar cantidad, fecha, costo |
| `DELETE` | `/api/batches/:id` | OWNER | Eliminar lote |

### Filtros disponibles en GET /api/batches

| Parámetro | Tipo | Ejemplo |
|-----------|------|---------|
| `branchId` | string | `branchId=abc123` |
| `productId` | string | `productId=def456` |
| `expiryBefore` | date (YYYY-MM-DD) | `expiryBefore=2026-06-01` |
| `expiryAfter` | date (YYYY-MM-DD) | `expiryAfter=2026-01-01` |
| `page` | number | `page=1` |
| `limit` | number | `limit=50` |

---

## Alertas de vencimiento

### Endpoint `/api/batches/expiring`

Devuelve lotes con `expiryDate` entre **hoy y hoy + N días** (default 30), ordenados por fecha de vencimiento ascendente. Solo incluye lotes con `quantity > 0`.

Ejemplo:
```
GET /api/batches/expiring?days=30&branchId=abc123
```

Respuesta:
```json
[
  {
    "id": "cuid...",
    "batchCode": "LOTE-001",
    "expiryDate": "2026-05-15",
    "quantity": 50,
    "product": { "id": "...", "name": "Leche Entera 1L", "barcode": "123456" },
    "branch": { "id": "...", "name": "Sucursal Principal" }
  }
]
```

### Endpoint `/api/batches/expired`

Lotes con `expiryDate < today` y `quantity > 0`. Estos lotes tienen stock vencido que debería registrarse como merma.

El frontend muestra una alerta en el Dashboard consultando ambos endpoints.

---

## Dashboard: Alerta de próximos a vencer

En `DashboardPage.tsx` se agregó `ExpiringBatchesPanel` que:

1. Consulta `GET /api/batches/expiring?days=30` para la sucursal activa
2. Consulta `GET /api/batches/expired` para la sucursal activa
3. Muestra un contador: "X productos próximos a vencer, Y vencidos"
4. Enlace directo a la página `/inventory/batches`
5. Solo se renderiza cuando hay al menos una alerta

---

## Relación con mermas

Los lotes vencidos deberían registrarse como merma (spoilages).

**Flujo esperado:**
1. `GET /api/batches/expired` devuelve lotes vencidos con stock
2. El usuario (OWNER) registra una merma desde el formulario de mermas
3. Al crear la merma, el frontend puede sugerir decrementar `quantity` del lote
4. Si la merma es por EXPIRED, se descuenta del lote más antiguo (FIFO)

Actualmente este flujo es **semiautomático**: el backend expone los lotes vencidos y el endpoint `adjustBatchQuantity`, pero la integración con el formulario de mermas queda del lado del frontend.

---

## Lotes en el frontend

### Página de lotes (`/inventory/batches`)

- Tabla con columnas: producto, código de lote, fecha de vencimiento, cantidad, costo
- Filtros por nombre de producto y estado de vencimiento (todos / próximos a vencer / vencidos)
- Colores indicadores:
  - 🔴 Rojo: vencido
  - 🟡 Amarillo: próximos a vencer (≤30 días)
  - 🟢 Verde: vigente
- Modal para crear/editar lotes (solo OWNER)
- Confirmación para eliminar lotes (solo OWNER)

### Integración en compras

El `PurchaseEntryModal` (al crear/recibir una orden de compra) incluye campos opcionales:
- **Lote**: código de lote del proveedor
- **Vencimiento**: fecha de expiración

Estos datos se envían al backend y se procesan automáticamente al marcar la orden como RECEIVED.

---

## FIFO para futura integración con POS

El modelo de datos soporta **venta FIFO por fecha de vencimiento**, aunque actualmente el POS descuenta del `BranchInventory.stock` total sin discriminar por lote.

**Para implementar FIFO en POS habría que:**
1. Al vender, buscar los lotes del producto en la sucursal ordenados por `expiryDate ASC`
2. Descontar `quantity` del lote más próximo a vencer primero
3. Si se agota un lote, pasar al siguiente
4. Actualizar `BranchInventory.stock` agregado (stock total = suma de cantidades de lotes)

Esto requiere modificar `pos.service.ts` para descontar de lotes en vez de solo decrementar `BranchInventory.stock`.

---

## Consideraciones técnicas

- **SyncStatus**: El modelo `ProductBatch` actualmente **no tiene** `SyncStatus`. Para soporte offline habría que agregarlo.
- **Transacciones**: La creación de lotes al recibir una orden de compra ocurre dentro de una transacción de Prisma (`$transaction`). Si algo falla, todo se revierte.
- **Costos**: El `costPrice` del lote se toma del `unitCost` del item de la orden de compra al momento de recibir. Para creación manual, se pasa explícitamente.
- **Volumen**: El endpoint `GET /api/batches` tiene paginación (default 20, max 500).
