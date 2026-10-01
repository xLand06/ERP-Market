# Feature: Legal P0 — Consentimiento evidente en registro de trials

## Objetivo
Capturar evidencia de aceptación de Términos y Política de Privacidad en el flujo de registro
de prueba (landing → management API), como primer bloque de cumplimiento legal venezolano (P0).

## Por qué
- Análisis legal (2026-09-29): no existe registro de consentimiento en ningún endpoint público.
  Sin evidencia (versión + timestamp + IP), las cláusulas de los T&C son fácilmente impugnables
  (Decreto-Ley de Mensajes de Datos y Firmas Electrónicas: consentimiento electrónico debe ser
  atribuible y probable).
- P0 acordado con el usuario: (1) consentimiento con evidencia, (2) identificación del proveedor,
  (3) homologación SENIAT, (4) IVA/IGTF en facturación.

## Alcance de esta tarea (T1)
- [x] T1: Checkbox "Acepto Términos y Privacidad" (required) en el formulario de trial de la landing
      + envío `acceptTerms` al POST /api/trials.
      - Archivo: `/home/adrianvergel/Trabajo/allmarket-landing/src/components/FinalCTA.astro`
- [x] T1: Validación server-side `acceptTerms === true` (400 ACCEPT_TERMS_REQUIRED) + persistencia
      de evidencia: `acceptedTerms`, `termsVersion` ('2026-09'), `acceptedAt`, `consentIp`.
      - Archivos: `management/server/prisma/schema.prisma` (model TrialRegistration),
        `management/server/src/modules/trials/trials.service.ts`,
        `management/server/src/modules/trials/trials.controller.ts`
- [ ] T2: Reescritura de `TERMS_AND_CONDITIONS.md` + `TermsPage.tsx`: identificación del proveedor,
      ley aplicable/jurisdicción, mecanismo de reclamos, cláusula de modificación con aviso,
      corrección de contradicciones (SLA 99.5 vs 99.9; retención 45 vs 90 días), precios en BCV,
      declaración de IVA. **BLOCKED**: faltan datos legales del proveedor (razón social/RIF/
      domicilio) y decisión de negocio sobre IVA en suscripciones.
- [ ] T3 (fuera de repo): homologación SENIAT (Providencia SNAT/2024/000121) — trámite
      administrativo, no código.

## Restricciones / estado del repo
- Ambos repos en `master` al iniciar → ramas feature primero (`feat/legal-consent-p0`).
- `ERP-Market` tiene cambios sin commitear de sesión anterior (billingSecret en schema.prisma,
  billing.routes.ts, deploy/, scripts/e2e-test.sh). NO se committean aquí; solo se stagean
  archivos de este feature. El cambio de `billingSecret` en schema.prisma se preserva intacto.
- Orden de despliegue: landing ANTES (o junto) a management/server, si no el form viejo recibe 400.

## Criterios de aceptación / Verificación
- `management/server`: `pnpm build` (tsc) pasa.
- Landing: `pnpm build` (astro build) pasa.
- Sin runner de tests en management/server → TDD no aplica en este feature (verificado en
  package.json: solo dev/build/start). Backend (vitest) no se modifica.
- Registro POST /api/trials sin `acceptTerms: true` → 400; con `true` → persiste evidencia.

## Ruta declarada
- Delegada (writer único): trigger de escritor (4+ archivos en 2 repos) + preparación de lectura.
- Mapeo inline previo (búsquedas acotadas de formularios/endpoints de registro).

## Progreso
- [x] Exploración y análisis legal (previo)
- [x] Feature doc creado
- [x] T1 implementado y commiteado
- [ ] T2 (esperando datos del usuario)

## Commits
- Landing (allmarket-landing, `feat/legal-consent-p0`): `7ab4bff`
  feat(legal): require terms acceptance checkbox on trial form
- ERP-Market (`feat/legal-consent-p0`): `feat(legal): capture T&C consent evidence on trial registration`
  (este commit — ver `git log` para el hash exacto; un commit no puede contener su propio hash)

## Orden de despliegue (requisito)
- La landing debe desplegarse ANTES (o junto) al management server: el form viejo no envía
  `acceptTerms` y recibiría 400 `ACCEPT_TERMS_REQUIRED` del endpoint nuevo.
