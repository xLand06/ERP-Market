# Feature: Pagos — Recibir y verificar Pago Móvil (Incoming Payments)

## Objetivo
Recibir reclamos de Pago Móvil de los clientes de la tienda (por webhook/SMS o entrada manual),
verificarlos en una cola de pendientes y acreditarlos como abono de CxC solo cuando un
responsable los aprueba — sin comisiones de pasarela y sin intermediar dinero.

## Por qué
- Consulta del usuario (2026-10-12): adaptar a ALL MARKET el recibir y verificar pagos
  automatizados en Venezuela (análisis previo: APIs bancarias vs pasarelas vs Gateway Android).
- Hoy TODO es manual: `CustomerPayment` se crea al instante y descuenta saldo sin verificación
  (`customers.service.ts:230-293`), no hay estados, no hay idempotencia, no hay webhook.
- El teléfono de la caja de la tienda ya está afiliado a la línea receptora del Pago Móvil;
  el APK de ALL MARKET podrá alimentar el webhook futuro (fuera de alcance v1: solo endpoint).

## Decisiones de diseño (arquitecto — veto del usuario abierto hasta T2)
1. **Aditivo, no invasivo**: los abonos manuales existentes (cash/card/transfer) siguen
   instantáneos como hoy. La verificación aplica a los reclamos entrantes (webhook/cola).
   No se gatea el flujo actual.
2. **Modelo nuevo `IncomingPayment`** con enum `IncomingPaymentStatus`
   (`PENDING → APPLIED | REJECTED`), NO se toca el modelo `CustomerPayment` (el sync
   `push-sales.service.ts:669-696` lo upsertea; campo nuevo = riesgo de romper sync).
3. **Acreditar = reutilizar la lógica de `recordPayment`** dentro de `prisma.$transaction`:
   `customerPayment.create` + `customer.balance decrement` + `IncomingPayment.status=APPLIED`
   + link `appliedPaymentId`. Guardas idénticas (cliente activo, monto ≤ saldo).
4. **Moneda**: el Pago Móvil llega en Bs; base USD. Persistir `amountVes`, `exchangeRate`
   (al momento de verificar) y `amountBase`. El abono se acredita en moneda base como hoy.
5. **Webhook público** `POST /api/payments/incoming/webhook` con header `x-webhook-secret`
   (env `PAYMENTS_WEBHOOK_SECRET`, patrón `billing.routes.ts:15`). El servidor parsea el SMS
   crudo (parser por banco: BDV 2662, Banesco 2846, Mercantil 24024) — el parseo vive en el
   backend, no en el cliente. Dedupe por `reference` (misma referencia no se procesa dos veces).
6. **Sugerencia de cliente**: match por `customer.phone` vs teléfono emisor; si no hay match,
   el gestor elige cliente al verificar.
7. **UI**: tab "Pagos por verificar" en `CustomersPage` (patrón de tabs de `CashRegisterPage`)
   + badge en el campana de `TopBar` (nuevo type `pago_pendiente` en `notifications.service`).
8. **Auditoría**: `AuditActionType` += `PAYMENT_INCOMING_RECEIVED | PAYMENT_VERIFIED |
   PAYMENT_REJECTED`; el webhook audita con `userId: null` (ya es nullable).

## Alcance por tarea
- [x] T1: Esquema — `IncomingPayment` + `IncomingPaymentStatus` en **AMBOS** schemas
      (`backend/prisma/schema.prisma` cloud/Postgres Y `schema.local.prisma` SQLite — divergencia
      histórica de `groupId` enseña a no repetirlo) + índices + `db:push:local` + prisma generate.
      - Archivos: `backend/prisma/schema.prisma`, `backend/prisma/schema.local.prisma`
      - Ruta: inline (cambio mecánico con diseño ya cerrado; 2 archivos espejo).
- [x] T2: Backend — módulo `incoming-payments` (routes/service/controller/zod):
      webhook público + parser SMS (unit test colocado `sms-parser.test.ts`) + cola GET +
      verify/reject + auditoría.
      - Archivos: `backend/src/modules/incoming-payments/*` (nuevo: zod, sms-parser,
        sms-parser.test, service, controller, routes),
        `backend/src/core/middlewares/audit.middleware.ts` (+3 AuditActionType),
        `backend/src/app.ts` (mount `/api/incoming-payments`)
      - Ruta: delegada (writer, trigger 4+ archivos no triviales).
      - Nota: verify usa updateMany condicional PENDING→APPLIED con count-check
        (idempotencia ante doble-verificación concurrente). Dedupe de webhook por
        `findFirst` reference (sin unique en DB: schema intocable en T2).
- [x] T3: Frontend — tab de cola en `CustomersPage`, botones verificar/rechazar (con selector
      de cliente si no hubo match), badge en `TopBar`, types + service + hooks React Query
      (invalidate `['customer-statement', id]` + `['customers']`).
      - Archivos: `frontend/src/features/customers/pages/CustomersPage.tsx`,
        `frontend/src/features/customers/components/IncomingPaymentsPanel.tsx` (nuevo),
        `frontend/src/features/customers/hooks/useIncomingPayments.ts` (nuevo),
        `frontend/src/services/incoming-payments.service.ts` (nuevo),
        `frontend/src/services/notifications.service.ts`, `frontend/src/components/layout/TopBar.tsx`,
        `backend/src/modules/notifications/notifications.service.ts` (type `pago_pendiente`)
      - Ruta: delegada (writer, trigger 4+ archivos no triviales).

## Resultados de verificación — T3 (2026-10-14)
- Writer: frontend `pnpm build` → ✓ built (exit 0); backend `tsc --noEmit` → limpio;
  frontend `tsc --noEmit` → 218 errores = BASELINE preexistente (verificado con
  `git stash -u` contra HEAD limpio: idénticos 218; 0 errores nuevos de este cambio).
- Spot check orquestador: `pnpm build` → dist generado OK; `git status` → solo los
  7 archivos declarados ✓.
- Riesgos registrados: badge TopBar depende del polling de 60s (invalidate de notifications
  es no-op hoy, comentado en código); USD display-only hasta verificar; gate de acciones
  OWNER/MANAGER en UI (la autoridad real es el roleGuard del backend).
- [x] T4: Verificación integral — `tests/incoming-payments.test.ts` (supertest: webhook happy
      path + secret inválido 401 + dedupe + verify aplica saldo + reject no aplica),
      `pnpm test` backend, `tsc --noEmit` backend+frontend, build frontend, docs de operación
      (cómo configurar PAYMENTS_WEBHOOK_SECRET y el formato del payload).
      - Archivos: `backend/tests/incoming-payments.test.ts` (nuevo, 15 tests),
        `docs/pagos-webhook.md` (nuevo, ops doc ES)
      - Ruta: delegada (writer, 2 archivos no triviales).

## Resultados de verificación — T4 (2026-10-14)
- Writer: `npx vitest run tests/incoming-payments.test.ts` → 15/15; `tsc --noEmit` → limpio;
  `pnpm test` full → **9 failed | 102 passed | 1 skipped** — los 9 son EXACTAMENTE el baseline
  preexistente (auth ×5 timeouts con rechazo `DEPLOY_MODE=server pero DATABASE_URL...`,
  products ×2, purchases ×1, pos ×1); cero rotos nuevos.
- Spot check orquestador: 15/15 ✓; status solo con los 2 archivos nuevos ✓.
- Cobertura: secret correcto/incorrecto, dedupe, no-parseable sin fila, cola PENDING, verify
  con delta de saldo ±0.01, 422 sin cambios, doble-verify 409 sin doble crédito, reject
  intacto, 403 SELLER, auto-match por teléfono vs requerir customerId, y regresión del abono
  manual instantáneo.
- Litter de backups del suite restaurado (`git checkout -- backend/backups/` + rm del creado).
  ⚠️ Cada `pnpm test` completo repite este efecto: limpiar igual tras cada run.

## Criterios de aceptación / Verificación
- Webhook con secret válido + SMS BDV parseado → `IncomingPayment` PENDING con monto Bs + USD.
- SMS duplicado (misma referencia) → NO crea segundo registro.
- `POST /:id/verify` → en una transacción: abono creado, saldo del cliente bajado, estado
  APPLIED, audit log con actor; monto > saldo → 422 y estado intacto.
- `POST /:id/reject` → REJECTED, saldo intacto, audit log.
- Abono manual existente (cash/transfer) → comportamiento SIN cambios (test de regresión).
- Webhook sin/incorrecto `x-webhook-secret` → rechazado.
- `pnpm test` (vitest) verde; `tsc --noEmit` backend y frontend sin errores.

## Ruta declarada
- Delegada (writer único por tarea): triggers — T2 y T3 tocan 4+ archivos no triviales cada uno
  (writer trigger) y la lectura de preparación va junto con el writer. Mapeo inicial delegado
  (explore, 8 archivos: completado, sesión `ses_ecd4525f5ffeBwEgJ3vozKY1dj`).
- TDD: sin config strict TDD en sesión/proyecto → checks funcionales ordinarios + tests nuevos
  primero en T2/T4 (parser: RED/GREEN natural).

## Forecast de líneas (heurística ~400/tarea)
- T1 ~80 · T2 ~450 · T3 ~400 · T4 ~300 → **~1.230 líneas** (suma > 400 → estrategia de
  entrega aplica; ver Cadena abajo).

## Cadena / estrategia de entrega
- `delivery_strategy`: `ask-on-risk` (default ODD, sin preflight SDD en sesión).
- `chain_strategy`: `stacked-to-main` — elegido por el usuario (2026-10-12) vía question.
  Los work-unit commits aterrizan en main en orden; push al usuario.

## Restricciones / estado del repo
- Repo en `main` tras merge de `9bf47bf` (fix ai-chat). Feature en rama nueva primero.
- `mobile/` sin trackear: NO se incluye en staging (el review nativo ya lo excluye con
  `--untracked-scope=exclude`).
- Deploy VPS ROTO: GitHub Actions sin secrets (`missing server host`) — push a main NO
  despliega; el feature llega a producción cuando el usuario restaure los secrets.
- RDD: ON (global). Tras cada work-unit commit → `gentle-ai review assess --committed-only`.

## Resultados de verificación — T2 (2026-10-14)
- Writer: `npx vitest run src/modules/incoming-payments/sms-parser.test.ts` → 12/12 (RED→GREEN);
  `npx tsc --noEmit` → sin errores; ai-chat tests → 29 passed (ver nota abajo).
- Spot check del orquestador (re-ejecución): parser tests → 12/12 ✓; `git status` → solo los
  3 artefactos declarados ✓.
- Riesgos registrados del writer: (1) secret del webhook con fallback de dev (patrón de casa —
  T4 docs debe cubrir PAYMENTS_WEBHOOK_SECRET en producción); (2) dedupe sin unique en DB;
  (3) montos se normalizan a number → T3 debe tipar numbers.
- Corrección de doc: el guard de ai-chat tiene 29 tests, no 24 — hay 3 commits de una sesión
  concurrente en la rama (`491d035`, `bf4644b` ai-chat; `66ebf5c` catalog) que sumaron 5 tests
  después de mi `9bf47bf`.
- Review nativo T1/T2: `unavailable` (transport `immutable_review_transport_unsupported`,
  retry_safe:false; causa raíz upstream = probe de runtime sin memoizar, fix publicado en
  gentle-ai v4.1.1 — build instalado 3.7.0 → acción: actualizar y reproducir, sin comentario
  en #4984 aún).

## Progreso
- [x] Exploración delegada (mapa completo de abonos/POS/banks/frontend/auditoría)
- [x] Feature doc creado (este documento)
- [x] Cadena decidida (`stacked-to-main`, usuario 2026-10-12)
- [x] T1 (esquema) — commit 67a85dc
- [x] T2 (backend) — commit 705f800
- [x] T3 (frontend) — commit 547ac2a
- [x] T4 (verificación integral) — commit T4 (este commit)

## Resultados de verificación — T1 (2026-10-12)
- `prisma validate` AMBOS schemas → válidos.
- `db:generate` (cloud) + `db:generate:local` + `db:push:local` → OK (tabla `incoming_payments` creada).
- `tsc --noEmit` backend → sin errores.
- **Baseline de tests (IMPORTANTE)**: `pnpm test` tiene 9 fallos PREEXISTENTES en la base
  `9bf47bf`, idénticos con y sin este cambio (verificado con stash): auth integration (5 ×
  timeout 30s, sospecha rate-limit/bcrypt), products (2), purchases (1), pos multi-pago (1).
  Cualquier run futuro se compara contra este baseline — no se les sube el TDD.

## Commits (rama feat/incoming-payments, stacked-to-main, orden de aterrizaje)
- `67a85dc` feat(payments): add IncomingPayment schema for Pago Movil verification
- `705f800` feat(payments): add incoming Pago Movil webhook and verification backend
- `547ac2a` feat(payments): add payment verification queue UI
- T4: feat(payments): add incoming payment integration tests and webhook docs (este commit)
- Pendiente de aterrizaje: merge a main + push (decisión del usuario; push = deploy vía Actions)
