# PLAN — Móvil React Native + Expo (ALLMARKET)

> **Audience:** otro agente de implementación / orquestador.  
> **Repo:** `xLand06/ERP-Market` (monorepo).  
> **Fecha:** 2026-10-04.  
> **Estado:** plan listo — no implementado aún.  
> **Decisión del usuario:** migrar el cliente móvil de Capacitor a **React Native + Expo**. Web + Electron se mantienen.

---

## 1. Problema (por qué Capacitor falló)

La APK actual es Capacitor sobre la **misma web React** (WebView). En el campo (Huawei P40 Pro / HMS) falló de forma sistemática:

| Síntoma | Causa raíz encontrada |
|---------|----------------------|
| Cámara QR negra / solo frontal | WebView getUserMedia no renderiza rear en HMS; ZXing JourneyApps usa Camera API legacy |
| “Network Error” en todo | `VITE_API_URL=localhost` pisaba serverUrl del QR; cache serverUrl con `require()` muerto en Vite ESM; carrera `fetchSettings` vs SQLite |
| UI vieja tras reinstalar | Service worker PWA + caché WebView de Huawei; `base` absoluto de Vite rompió assets Capacitor |
| QR no conectaba | Panel genera `allmarket://connect?server=...`; cámara del sistema abría la app sin procesar deep link |
| APK “no actualizada” | UI vive **dentro** del APK; renombrar archivo en VPS no actualiza el bundle del teléfono |

**Conclusión:** el modelo WebView cuesta caro cuando el producto depende de cámara + OEM chino + red + offline. No es “Capacitor roto”; es el techo del modelo para este caso de uso.

---

## 2. Alcance

### In scope (móvil RN)

| Fase | Features |
|------|----------|
| P0 | Splash + Connect (QR/URL/default test) + Login |
| P0 | Shell tabs + POS venta + productos/búsqueda/barcode |
| P0 | Inventario consulta |
| P1 | Caja apertura/arqueo/cierre |
| P1 | Clientes / fiados |
| P2 | Reportes básicos (ventas día / por producto) |
| Release | Iconos, splash, firma APK/AAB |

### Out of scope (no migrar ahora)

- Landing (`allmarket-landing`)
- Management panel
- Catálogo público F5
- Electron desktop (se queda en web embebida)
- Thermal printer web / AI chat / backup UI complejo
- Reescribir backend

### Backend

**No se toca.** El thin client RN habla con la misma API Express/Prisma.

Referencia API (tenant test):

- Base: `https://test.allcode.site/api`
- Health: `GET /api/health` → `{ status: "ok", deployMode: "server", ... }`
- Login: `POST /auth/login` (body según `auth.service` del frontend actual)
- Sync inicial (server mode): `GET /api/sync/initial-status` → benigno `{ hasCloudData: true, isOnline: true, needsInitialSync: false }`
- En `DEPLOY_MODE=server` **no** hay sync local→Supabase; el servidor ES la nube

---

## 3. Arquitectura objetivo

```
ERP-Market/
  backend/          # intacto
  frontend/         # web + Electron (Capacitor puede quedar deprecado)
  desktop/          # Electron intacto
  management/       # intacto
  mobile/           # NUEVO — Expo RN
    app/            # Expo Router
    src/
      api/          # axios client + tipos
      features/
        auth/
        connect/
        pos/
        products/
        inventory/
        cash/
        customers/
        reports/
      lib/
        serverUrl.ts
        offlineQueue.ts
        format.ts
      ui/           # tokens de diseño Allmarket
    assets/         # logo, splash, iconos
    eas.json
```

### Stack móvil

| Capa | Elección | Notas |
|------|----------|-------|
| Runtime | Expo SDK actual (managed) | EAS Build para APK |
| Router | Expo Router | stacks + tabs |
| HTTP | axios | Mismo contrato que `frontend/src/lib/api.ts` |
| Estado | zustand | Ya usado en web |
| Persistencia serverUrl/token | `expo-secure-store` + AsyncStorage | No WebView localStorage |
| Cámara QR | `expo-camera` (o vision-camera) | Nativo — sin html5-qrcode |
| Offline ventas | `expo-sqlite` o MMKV + cola | Reusar lógica de `offline-queue.ts` |
| UI | React Native + tokens | navy `#0f1c38`, teal `#3a7d89`, mint `#4ecdc4`, cream `#faf9f6` |
| i18n | i18next (opcional Fase 4) | ES primero |

### Qué se porta de la web

| Reutilizable | Cómo |
|--------------|------|
| Tipos de API / payloads | Copiar o extraer a `shared/types` |
| `normalizeServerUrl` / `TEST_SERVER_URL` | Mismo concepto en `mobile/src/lib/serverUrl.ts` |
| Lógica cola offline POS | Adaptar de `frontend/src/lib/offline-queue.ts` |
| Formatos moneda (USD/VES/COP) | De `frontend` / `useConfigStore` rates |
| Colores de marca | De landing / Sidebar themes |

| No se porta | Motivo |
|-------------|--------|
| Componentes React DOM / Tailwind web | RN no usa DOM |
| html5-qrcode / jsQR WebView | Reemplazo nativo |
| Capacitor plugins | N/A |
| Vite PWA / service worker | N/A en RN |

---

## 4. Decisiones abiertas (confirmar antes de Fase 2)

1. **Alcance al lanzar mobile:** ¿POS+productos+inventario+caja, o también clientes/fiados día 1?
2. **Offline desde Fase 2** o primero solo online contra test y offline después?
3. **Monorepo `mobile/`** dentro de ERP-Market (recomendado) o repo aparte?
4. **UI RN desde cero** (recomendado) vs intentar portar estilos web?
5. **¿Mantener APK Capacitor de publicación en paralelo** hasta que RN esté estable?

---

## 5. Fases de implementación

### Fase 0 — Setup Expo (0.5–1 día)

**Tareas:**
- [ ] `npx create-expo-app mobile` (TypeScript, Expo Router)
- [ ] Tokens UI (colores, spacing, tipografía) en `src/ui/theme.ts`
- [ ] `src/lib/serverUrl.ts` (normalize + persist + `TEST_SERVER_URL = 'https://test.allcode.site'`)
- [ ] `src/api/client.ts` (axios, baseURL dinámico `${serverUrl}/api`, Bearer token)
- [ ] Auth store zustand + persist token/usuario
- [ ] Health check screen de smoke (`GET /api/health`)
- [ ] `eas.json` + app.json (appId `com.allmarket.app` o `com.allcode.allmarket`, nombre ALL MARKET)
- [ ] Iconos/splash (reusar `logoAllmarket` / isotipo ya generados en el repo)

**Criterio de aceptación:**
- APK de Expo instalado en P40 Pro
- Abrir app → health OK contra `https://test.allcode.site/api/health`
- Toast/estado muestra URL y status HTTP reales

### Fase 1 — Connect + Login (1–2 días)

**Tareas:**
- [ ] ConnectScreen RN: tabs QR / URL / (default test en build de prueba)
- [ ] Cámara nativa para QR `allmarket://connect?server=...` **y** URL HTTPS plana
- [ ] Validar serverUrl con health **antes** de persistir
- [ ] Persistir serverUrl (AsyncStorage/SecureStore)
- [ ] Login screen: usuario/contraseña → `POST /auth/login`
- [ ] Guardar token + user; redirect a POS o dashboard shell
- [ ] Errores legibles: sin servidor, HTTP status, timeout, TLS, credenciales
- [ ] Pantalla “Diagnosticar” (platform, serverUrl, health URL, status, duration)

**Criterio de aceptación:**
- En P40 Pro: abrir app → login de test → ingresar con credenciales de prueba → shell
- QR del panel web con cámara del sistema **o** cámara de la app conecta al tenant correcto
- Sin WebView, sin “AM” legacy, sin ConnectScreen eterno

### Fase 2 — Shell + POS mínimo (3–5 días)

**Tareas:**
- [ ] Tabs: POS | Productos | Inventario | Más
- [ ] POS: búsqueda producto (API), carrito, métodos pago, totales multi-moneda si aplica
- [ ] POST venta (`/pos/transactions` o endpoint equivalente — **verificar en backend**)
- [ ] Offline: si health falla → encola venta; al volver red → drena cola
- [ ] Pull productos/inventario (react-query o fetch + cache local)
- [ ] Barcode: `expo-camera` escaner o input manual

**Criterio de aceptación:**
- Venta online contra test
- Venta offline encola y se sincroniza al reconectar
- Búsqueda de producto funciona con datos del tenant test

### Fase 3 — Caja + clientes (2–3 días)

- [ ] Apertura/cierre/arqueo de caja
- [ ] Listado clientes, detalle fiados
- [ ] Vincular venta a cliente fiado si el POS lo soporta en API

### Fase 4 — Reportes + pulido (2–3 días)

- [ ] Ventas del día / por producto (endpoints de reports existentes)
- [ ] Branding final (splash, icono adaptive Android)
- [ ] Rate limit login, retry HTTP, modo avión
- [ ] i18n ES (EN opcional)

### Fase 5 — Release (1–2 días)

- [ ] Keystore release propio + firma
- [ ] EAS Build APK/AAB
- [ ] Distribución (APK directo a clientes / Play internal)
- [ ] Doc breve: cómo connectar QR del panel
- [ ] Marcar Capacitor mobile como deprecated en README

---

## 6. Contratos API a verificar en backend (antes de Fase 2)

Confirmar en `backend/src/modules/*` (no inventar):

| Área | Rutas probables |
|------|-----------------|
| Auth | `POST /auth/login`, `GET /auth/me` |
| POS | `POST /pos/transactions`, `GET /pos/...` |
| Productos | `GET /products` (query branch/sucursal) |
| Inventario | `GET /inventory` |
| Caja | rutas en `cashFlow` / `finance` |
| Clientes | `GET/POST /customers` |
| Health | `GET /health` o `GET /api/health` vía Caddy |

El agente **debe leer** `backend/src/modules/pos`, `auth`, `products` y mapear payloads reales al cliente RN. No copiar el frontend web ciego.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Huawei HMS sigue rompiendo cámara | Expo camera nativo + prueba en P40 Pro en Fase 1 (gate) |
| Duplicar lógica de negocio web/RN | Extraer tipos/formatos a `shared/` si crece |
| POS offline mal diseñado | Cola idéntica a `offline-queue.ts` + tests |
| API cambia y RN se rompe | Contratos TypeScript compartidos + smoke health/login en CI |
| Dos APKs (Capacitor + RN) confunden clientes | Nombre/empaquetado distinto; documentar cuál es oficial |
| Scope creep (todo el ERP en mobile) | Fases P0/P1/P2; P3+ solo si negocio lo pide |

---

## 8. Gate de decisión post-Fase 1

Si en el P40 Pro:
- Cámara QR nativa **no** funciona de forma estable, o
- Login/health sigue fallando con HTTP nativo,

**entonces** revisar opción nativa Kotlin solo para connect+QR, o investigar el stack del dispositivo — no seguir iterando WebView hacks.

Si Fase 1 pasa limpio → continuar Fase 2 sin reabrir el debate Capacitor.

---

## 9. Fuera de este plan (recordatorio)

- Corregir DNS/WHOIS de `allcode.site` si vuelve a suspenderse (registrar Namecheap)
- Secrets de GitHub Actions para deploy automático (hoy se hace SSH manual a `89.167.46.144`)
- Landing WebP/WebM y branding ya hechos — no reabrir
- Debug APK Capacitor actual: hardcodea `test.allcode.site` y salta QR — **solo para diagnóstico**, no es el release

---

## 10. Comandos útiles (entorno actual)

```bash
# Backend test health (desde máquina con acceso al VPS o público)
curl -sk https://test.allcode.site/api/health

# Deploy manual VPS (hoy)
ssh root@89.167.46.144
cd /opt/erp-market && git pull origin master
./deploy/scripts/update-all-tenants.sh

# APK Capacitor debug actual (legado)
cd frontend && CAPACITOR_BUILD=1 pnpm vite build && pnpm cap sync android
cd android && ./gradlew assembleDebug
```

Para RN: documentar EAS en Fase 0 (no inventar credenciales aquí).

---

## 11. Definition of Done (móvil v1)

- [ ] Dueño de bodega instala APK RN desde link
- [ ] Connect por QR del panel web en el P40 Pro sin pasos extra raros
- [ ] Login y venta de prueba contra tenant test
- [ ] Al menos una venta offline encolada y sincronizada
- [ ] Icono Allmarket + splash de marca
- [ ] Errores de red legibles (URL + HTTP + hint)
- [ ] Web y Electron siguen funcionando sin cambios de runtime
