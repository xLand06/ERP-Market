# Comercial Suite — Technical Design (F2, F4, F1, F3, F5, F7, F6)

Diseño de implementación directa. Prosa en español neutro, identificadores en inglés.
Reglas base: routes→controller→service+zod; features/<x>/; dual schema + push-schema.js; sync offline-first vía SyncQueue.
## 1. Schema (dual)
### 1.1 schema.prisma (Postgres) — modelos nuevos y modificados

```prisma
enum BankAccountType { AHORRO CORRIENTE CAJA OTRO }
enum BankTransactionType { INGRESO EGRESO TRASLADO }
enum TransactionType { SALE INVENTORY_IN QUOTE } // + QUOTE

model Customer {
  id             String   @id @default(cuid())
  nombre         String
  cedula         String
  telefono       String?
  email          String?
  limiteCredito  Decimal  @default(0) @db.Decimal(12, 2)
  saldoPendiente Decimal  @default(0) @db.Decimal(12, 2)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz
  updatedAt      DateTime @updatedAt @db.Timestamptz
  transactions   Transaction[]
  payments       CustomerPayment[]
  @@index([nombre]) @@index([cedula]) @@index([isActive])
  @@map("customers")
}

model CustomerPayment {
  id            String       @id @default(cuid())
  monto         Decimal      @db.Decimal(12, 2)
  metodoPago    String       // 'cash' | 'transfer' | 'card' | 'other'
  referencia    String?
  createdAt     DateTime     @default(now()) @db.Timestamptz
  transactionId String?      // venta a crédito que abona (null = abono general)
  transaction   Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  customerId    String
  customer      Customer     @relation(fields: [customerId], references: [id])
  @@index([customerId]) @@index([transactionId])
  @@map("customer_payments")
}

model KitComponent {
  id                 String  @id @default(cuid())
  quantity           Decimal @db.Decimal(12, 3)
  parentProductId    String
  parentProduct      Product @relation("KitParent", fields: [parentProductId], references: [id], onDelete: Cascade)
  componentProductId String
  componentProduct   Product @relation("KitComponent", fields: [componentProductId], references: [id])
  @@unique([parentProductId, componentProductId]) @@index([componentProductId])
  @@map("kit_components")
}

model BankAccount {
  id           String           @id @default(cuid())
  nombre       String
  tipo         BankAccountType  @default(AHORRO)
  saldoInicial Decimal          @default(0) @db.Decimal(12, 2)
  saldoActual  Decimal          @default(0) @db.Decimal(12, 2)
  isActive     Boolean          @default(true)
  createdAt    DateTime         @default(now()) @db.Timestamptz
  updatedAt    DateTime         @updatedAt @db.Timestamptz
  transactions BankTransaction[]
  @@index([isActive]) @@map("bank_accounts")
}

model BankTransaction {
  id                   String             @id @default(cuid())
  tipo                 BankTransactionType
  monto                Decimal            @db.Decimal(12, 2)
  descripcion          String?
  referencia           String?
  fecha                DateTime           @default(now()) @db.Timestamptz
  createdAt            DateTime           @default(now()) @db.Timestamptz
  bankAccountId        String
  bankAccount          BankAccount        @relation(fields: [bankAccountId], references: [id])
  relatedTransactionId String?            // par del TRASLADO (egreso↔ingreso)
  relatedTransaction   BankTransaction?   @relation("BankTransferPair", fields: [relatedTransactionId], references: [id])
  @@index([bankAccountId, fecha]) @@map("bank_transactions")
}

model SupplierPayment {
  id              String         @id @default(cuid())
  monto           Decimal        @db.Decimal(12, 2)
  metodoPago      String
  referencia      String?
  createdAt       DateTime       @default(now()) @db.Timestamptz
  purchaseOrderId String
  purchaseOrder   PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id])
  supplierId      String
  supplier        Supplier       @relation(fields: [supplierId], references: [id])
  @@index([supplierId]) @@index([purchaseOrderId])
  @@map("supplier_payments")
}

// ── Modificados ──────────────────────────────────────────────
model Transaction {
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id])
  metadata   Json?     // QUOTE: { quoteConvertedTo: saleId } | SALE: { quoteSource: quoteId }
  // agregar @@index([customerId, type])
}

model Product {
  kitComponents KitComponent[] @relation("KitParent")    // como padre
  usedInKits    KitComponent[] @relation("KitComponent") // como componente
}

model PurchaseOrder {
  paidAmount Decimal    @default(0) @db.Decimal(12, 2)
  dueDate    DateTime?  @db.Timestamptz
  payments   SupplierPayment[]
}
```
### 1.2 schema.local.prisma (SQLite) — equivalencia mecánica

Mismos modelos/relaciones SIN `@db.Decimal` ni `@db.Timestamptz`; `Decimal → Float`, `Json → String`.
Espejo exacto: Customer, CustomerPayment, KitComponent, BankAccount, BankTransaction, SupplierPayment,
`TransactionType.QUOTE`, `Transaction.customerId String?` + `metadata String?`,
`Product.kitComponents/usedInKits`, `PurchaseOrder.paidAmount Float @default(0)` + `dueDate DateTime?`.
## 2. Backend — módulos nuevos
### 2.1 customers (`backend/src/modules/customers/`)
- `customers.routes.ts` (authMiddleware; OWNER en escritura): GET `/` (filtros), POST `/`, GET `/:id`, PUT `/:id`, GET `/:id/account`, POST `/:id/payments`, GET `/:id/payments`. Estáticas antes de `/:id`.
- `customers.controller.ts`: `getCustomers, createCustomer, updateCustomer, getCustomerById, getCustomerAccount, registerPayment, getCustomerPayments` (validatedData + logAudit; 422/409 según spec).
- `customers.service.ts`:
  - `createCustomer(data)` (cedula dup → P2002 → 409); `updateCustomer(id, data)` (conserva saldo); `getCustomers(filters)` (search nombre/cedula, isActive).
  - `registerPayment(customerId, { monto, metodoPago, referencia?, transactionId? })` — en `$transaction`: valida `saldo >= monto` (422 `"El abono excede el saldo pendiente"`), crea CustomerPayment, `saldoPendiente { decrement: monto }`, `enqueueOutbox('CustomerPayment', CREATE)`.
  - `getPayments(customerId, filters)`; `getAccount(customerId)` — ventas SALE con `customerId` + abonos + saldo calculado.
  - `validateCreditLimit(customerId, amount)` — `saldoPendiente + amount > limiteCredito` → throw `{ status: 422, error: "Límite de crédito excedido", limite, saldo, venta }`; cliente inactivo → 422 `"Cliente desactivado"`.
- `backend/src/core/validations/customers.zod.ts` (NUEVO): `createCustomerSchema, updateCustomerSchema, customerFiltersSchema, registerPaymentSchema`.
- `app.ts`: `app.use('/api/customers', customersRouter)`.
### 2.2 banks (`backend/src/modules/banks/`)
- `banks.routes.ts` (authMiddleware; OWNER en escritura): POST `/accounts`, GET `/accounts`, PUT `/accounts/:id`, POST `/accounts/:id/transactions`, GET `/accounts/:id/transactions`, GET `/summary`.
- `banks.service.ts`:
  - `createAccount(data) / getAccounts() / updateAccount(id, data) / getAccountById(id)`.
  - `registerTransaction(accountId, { tipo, monto, descripcion?, referencia?, fecha?, destinoId? })` — en `$transaction`: INGRESO → `saldoActual + monto`; EGRESO → valida `saldo >= monto` (422 `"Saldo insuficiente"`) y resta; TRASLADO → valida `destinoId != accountId` (422 `"No se puede trasladar a la misma cuenta"`), crea par EGRESO origen + INGRESO destino con `relatedTransactionId` cruzado; cuenta inactiva → 422 `"Cuenta desactivada"`. `enqueueOutbox` por BankTransaction.
  - `getTransactions(accountId, filters)` (orden `fecha desc`); `getSummary()` → `{ totalSaldo, porTipo, cuentas }`.
- `backend/src/core/validations/banks.zod.ts` (NUEVO): `createBankAccountSchema, updateBankAccountSchema, registerBankTransactionSchema` (destinoId requerido en TRASLADO), `bankTransactionFiltersSchema`.
- `app.ts`: `app.use('/api/banks', banksRouter)`.
### 2.3 catalog (`backend/src/modules/catalog/`) — público, SIN auth
- `catalog.routes.ts` (sin authMiddleware): GET `/api/catalog/:slug`, GET `/api/catalog/:slug/product/:id`.
- `catalog.service.ts`:
  - `getCatalogBySlug(slug)` — lee SystemSetting `catalogSlug` (`{ slug, branchId, socialLinks }`); slug inexistente → 404 `"Catálogo no encontrado"`; sucursal inactiva → 404 `"Sucursal no disponible"`; retorna `{ slug, socialLinks, products: [{ id, name, description, price, imageUrl, subGroup }] }` — NUNCA stock/cost.
  - `getCatalogProduct(slug, productId)` — detalle de producto activo.
- `backend/src/core/validations/catalog.zod.ts` (NUEVO): `slugParamSchema, catalogProductParamSchema`.
- `app.ts`: `app.use('/api/catalog', catalogRouter)`.
### 2.4 Plan enforcement (F2)
- `backend/src/core/middlewares/plan-enforcement.middleware.ts` (NUEVO):
  `export const planEnforcement = (resource: 'users' | 'branches' | 'products') => async (req: AuthRequest, res: Response, next: NextFunction)`.
- Lógica: lee `SystemSetting.planTier`; si `!== 'ALL_MARKET'` → `next()`. Lee `planConfig` JSON `{ maxUsers, maxBranches, maxProducts }` (defaults `{ 999, 99, 9999 }`). `current = await prisma[resource].count({ where: { isActive: true } })` (soft-delete no cuenta). Si `current >= limit` → 422 `{ error: "Límite de <recurso> alcanzado", limit, current }`.
- Aplicación: `users.routes.ts`, `branches.routes.ts`, `products.routes.ts` → `router.post('/', planEnforcement('<recurso>'), roleGuard('OWNER'), validate(...), ctrl.createX)`. En PUT solo cuando el body reactiva (`isActive: true` sobre registro inactivo).
- `settings.routes.ts`: `GET /api/settings/plan-config` → `{ planTier, planConfig }`.
## 3. POS (F4, F1, F3)
### 3.1 pos.zod.ts
- `createTransactionSchema.type`: `z.enum(['SALE', 'INVENTORY_IN', 'QUOTE'])`; `+ customerId: z.string().optional()`. `paymentMethodSchema` sin cambios (fiado = `paymentMethods: []` + `customerId`).
- NUEVO `createQuoteSchema`: `{ branchId, customerId?, items: transactionItemSchema.array().min(1), notes? }` (sin caja ni pagos). NUEVO `quoteFiltersSchema`: pagination + `status` (PENDING/COMPLETED) + `customerId` + `from/to` + `search`.
### 3.2 pos.service.ts
- `CreateTransactionInput` + `customerId?: string`.
- `createTransaction`: si `type === SALE && customerId` → `customersService.validateCreditLimit(customerId, total)` ANTES; al crear, `customer.update saldoPendiente { increment: total }`; omitir validación multi-pago si `paymentMethods` vacío con customerId; guardar `metadata`.
- NUEVO `expandKitItems(items, branchId)` (autoritativo, defense-in-depth): ítems cuyo producto tiene `kitComponents` se reemplazan por una línea por componente `{ productId: componente, quantity: item.quantity * comp.quantity, unitPrice: componente.price }`. Se invoca al inicio de SALE/QUOTE.
- NUEVO `createQuote(input)` — items pasan por `expandKitItems`; `status: PENDING`, `cashRegisterId: null`, `paymentMethods: null`, `metadata: null`; NO deduce stock; `enqueueOutbox('Transaction', CREATE)`.
- NUEVO `getQuotes(filters)` / `getQuoteById(id)` — include items+product+user+branch+customer.
- NUEVO `convertQuoteToSale(quoteId, { userId, branchId, cashRegisterId? })`:
  1. Idempotencia: si `quote.metadata?.quoteConvertedTo` → `{ sale: ventaExistente, alreadyConverted: true }` (200).
  2. Valida caja abierta (auto-assign como SALE) y stock por ítem; si `quote.customerId` valida límite.
  3. En `$transaction`: crea `Transaction type SALE status COMPLETED` con los mismos items (extraer helper compartido `applyStockDeltas(tx, items, branchId, deltaSign)` para reusar la deducción de `createTransaction`), `metadata: { quoteSource: quoteId }`; actualiza quote → `status: COMPLETED`, `metadata: { quoteConvertedTo: saleId }`; si customerId → `saldoPendiente + total`. `enqueueOutbox` venta + quote.
### 3.3 pos.routes.ts / pos.controller.ts
- Rutas nuevas: `POST /quotes`, `GET /quotes`, `GET /quotes/:id`, `PUT /quotes/:id/convert`. Controllers: `createQuote, getQuotes, getQuoteById, convertQuote` (mapean a 422/404 según spec).
## 4. Sync (push-sales.service.ts + outbox)
- Bloques de reconciliación nuevos, en orden (FK primero): 1. `Customer` (upsert por id). 2. `KitComponent` (upsert por `parentProductId_componentProductId`). 3. `BankAccount` → 4. `BankTransaction` (mapea `bankAccountId`, preserva `relatedTransactionId`). 5. `SupplierPayment` (requiere Supplier + PurchaseOrder). 6. `CustomerPayment` (mapea `customerId`, `transactionId`).
- Regla spec: conflicto → `updatedAt` más reciente; si no existe en destino → insert, si existe → update. Append-only (payments) → insert si falta el id.
- `TransactionType.QUOTE` se sincroniza por el bloque de transactions existente (el mapeo ya cubre type).
- Outbox: `enqueueOutbox(tx, { entityName, entityId, operation, payload })` en la misma `$transaction` en: `customers.service` (create/update/registerPayment), `banks.service` (createAccount/registerTransaction), `suppliers.service` (nuevo `registerSupplierPayment`), `products.service` (nuevo `updateKitComponents`), `pos.service` (createQuote/convertQuoteToSale).
## 5. Frontend
### 5.1 features/customers/
- `pages/CustomersPage.tsx` — lista + filtros + create/edit (`/customers`).
- `pages/CustomerAccountPage.tsx` — estado de cuenta `/customers/:id/account`: saldo, límite, barra de uso, ventas crédito + abonos, botón "Registrar abono".
- `components/CustomerFormModal.tsx`, `components/CustomerPaymentModal.tsx` (cobranza).
- `hooks/useCustomers.ts` (CRUD + `useAccount(id)` + `usePayments(id)`), `types/index.ts`.
### 5.2 features/banks/
- `pages/BanksPage.tsx` — tarjetas de cuentas + resumen (GET `/api/banks/summary`).
- `pages/BankAccountPage.tsx` — detalle: saldo, historial, nuevo movimiento.
- `components/BankAccountFormModal.tsx`, `components/BankTransactionModal.tsx` (tipo + cuenta destino en TRASLADO).
- `hooks/useBankAccounts.ts`.
### 5.3 features/quotes/
- `pages/QuotesPage.tsx` — lista (filtros fecha/cliente/estado), acción "Convertir a venta" (PUT convert), badge `alreadyConverted`.
- `components/QuoteDetailModal.tsx`, `hooks/useQuotes.ts`.
### 5.4 features/catalog/ (público, standalone)
- `pages/CatalogPage.tsx` — `/catalogo/:slug` SIN AppShell ni auth: header con socialLinks, grid productos (nombre, precio, imagen, descripción). `hooks/useCatalog.ts`.
- `app/router.tsx`: registrar `/catalogo/:slug` FUERA de `PrivateRoute` (hermano de `/login`).
### 5.5 POS / Productos
- `PaymentDialog.tsx`: selector de cliente (búsqueda nombre/cedula) + opción "Fiado" → `onConfirm({ customerId, paymentMethods: [] })`; hint visual si `saldo + total > limiteCredito`.
- `useCart.ts`: `addItem` detecta producto con `components` (GET `/api/products/:id/components`) y expande en líneas de componente con precio individual (REQ-KI-03).
- `ProductFormModal.tsx`: sección "Componentes del kit" — tabla `{ productId, quantity }` con búsqueda, validaciones (componente ≠ padre, qty > 0); batch `PUT /api/products/:id/components`; preview precio del kit.
- `router.tsx` (PrivateRoute): + `customers`, `customers/:id/account`, `banks`, `banks/:id`, `quotes`.
### 5.6 PlanGuard / planConfig
- `frontend/src/lib/planConfig.ts`: + `fetchPlanLimits()` (GET `/api/settings/plan-config`, cache en memoria) e `isNearLimit(current, limit)` = `current / limit >= 0.8`.
- Warning ≥80% (backend sigue siendo source of truth): banner en `UsersPage`, `ProductsPage` y página de sucursales. `PlanGuard` sin cambios de lógica.
## 6. Settings
- Claves `SystemSetting` nuevas (JSON en `value`): `planTier` (`'ALL_MARKET' | 'BASIC' | 'PRO'`), `planConfig` (`{ maxUsers, maxBranches, maxProducts }`), `catalogSlug` (`{ slug, branchId, socialLinks: { whatsapp?, instagram?, facebook? } }`).
- `settings.service.ts`: + `getPlanConfig()`, `savePlanConfig(data)`, `getCatalogConfig()`, `saveCatalogConfig(data)` — parse/serialize JSON con try/catch; defaults plan `{ 999, 99, 9999 }`, catalog `null`.
- `settings.routes.ts`: `GET/PUT /plan-config`, `GET/PUT /catalog` (validación zod inline).
## 7. Migración (push-schema.js)
- Nuevas tablas (`CREATE TABLE IF NOT EXISTS`, `REAL` montos, `DATETIME`): `customers`, `customer_payments`, `kit_components`, `bank_accounts`, `bank_transactions`, `supplier_payments` — columnas espejo de 1.2 con FKs.
- Alteraciones (SQLite no soporta IF NOT EXISTS en ADD COLUMN → `PRAGMA table_info` o try/catch): `transactions` + `customerId TEXT`, `metadata TEXT`; `purchase_orders` + `paidAmount REAL DEFAULT 0`, `dueDate DATETIME`.
- Orden de implementación: schemas → push-schema.js → zod → services → routes/app.ts → sync → frontend.
## Notas
- Comentarios en español, identificadores en inglés (convención del repo). Montos SIEMPRE número al cruzar el boundary (`Number()` sobre Decimal).
- Errores de negocio: throw `{ status: 422, error, ...meta }` mapeado en controller (patrón existente).
- Tests vitest+RTL: `validateCreditLimit`, `convertQuoteToSale` idempotente, expansión kit, TRASLADO, plan-enforcement (422) y componentes UI nuevos.