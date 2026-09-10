# Tasks — Comercial Suite (ALL MARKET)

Basado en: `openspec/changes/comercial-suite/design.md` + specs en Engram.

## Batch 1: Límites de plan (F2) + Cotizaciones (F4) — primer corte
- [ ] F2: middleware `planEnforcement(resource)` en backend (core/middlewares/plan.middleware.ts)
- [ ] F2: aplicar en users/branches/products create (contar isActive, gate por planTier)
- [ ] F2: claves SystemSetting: planTier, planConfig (básico $15: 3 users/1 branch/250 products)
- [ ] F2: frontend `fetchPlanLimits` en planConfig.ts (backend-driven)
- [ ] F4: TransactionType.QUOTE en ambos schemas + push-schema.js
- [ ] F4: `createQuote` en pos.service.ts (sin caja/pago/stock)
- [ ] F4: `convertQuoteToSale` idempotente (metadata.quoteConvertedTo)
- [ ] F4: pos.zod.ts: quoteSchema + customerId opcional
- [ ] F4: frontend features/quotes (listar, ver, convertir)

## Batch 2: Fiados/CxC (F1)
- [ ] Schema dual: Customer, CustomerPayment
- [ ] Módulo backend customers (CRUD, cobranza, estado de cuenta)
- [ ] POS: pago parcial/crédito, validateCreditLimit
- [ ] Sync: reconcile Customer + CustomerPayment
- [ ] Frontend features/customers (List, EstadoCuenta, Cobranza) + Fiado en PaymentDialog

## Batch 3: Kits (F3)
- [ ] Schema dual: KitComponent
- [ ] ProductFormModal: editor de componentes
- [ ] POS: expandKitItems + validación stock por componente
- [ ] Sync: reconcile KitComponent

## Batch 4: Catálogo digital (F5)
- [ ] Endpoint público GET /api/catalog/:slug (auth optional)
- [ ] Settings: catalogSlug + socialLinks
- [ ] Página standalone pública /catalogo/:slug
- [ ] Link compartible en Settings

## Batch 5: CxP (F7) + Bancos (F6)
- [ ] Schema dual: SupplierPayment; PurchaseOrder +paidAmount/dueDate
- [ ] Backend purchases: registrar pago
- [ ] Frontend: panel CxP en FinancePage + registros
- [ ] Schema dual: BankAccount, BankTransaction
- [ ] Módulo backend banks
- [ ] Frontend features/banks