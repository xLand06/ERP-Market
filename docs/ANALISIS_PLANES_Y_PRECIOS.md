# Análisis Estratégico de Empaquetamiento y Precios: ALLMARKET (ERP-Market)
**Alineación con la Rama Pre-Tenant (`main` como Plan Básico) · Offline Universal · Tiers: $10 · $20 · $30**  
*Fecha: Septiembre 2026 | Arquitectura de Producto & SaaS Packaging*

---

## 1. Contexto de Arquitectura y Génesis de las Ramas

Al analizar el historial de Git entre la rama `main` (el ERP standalone previo a la infraestructura multi-tenant) y la rama `master` (donde se incorporó el `management-server` y la suite comercial extendida), queda en evidencia la frontera natural del producto:

1. **La rama `main` (Pre-Tenant) define la esencia del Plan BÁSICO ($10):**
   - Nació como una solución robusta y autosuficiente para un comercio individual:
     - **Punto de Venta (POS) multi-pago** con cálculo de vuelto multi-moneda (USD, VES, COP), tasa BCV automática e integración de impresoras térmicas ESC/POS (WebUSB/red).
     - **Arqueo y control de caja:** apertura de turno, movimientos de caja chica, cierres con Reporte X y Reporte Z.
     - **Inventario:** catálogo de productos, control de stock, alertas de reposición y registro de mermas.
     - **Trazabilidad de lotes:** control de fechas de vencimiento (`/inventory/batches`).
     - **Auditoría básica** de transacciones.
     - **Modo Offline con Sincronización:** el motor offline (Desktop Electron + SQLite local + cola de eventos) ya formaba parte del ADN de la app para garantizar que la caja nunca se detenga ante fallas de internet o cortes eléctricos.
2. **El Principio del Offline Universal:**
   - **El modo offline NO es un feature premium:** en el contexto comercial de Venezuela y LATAM, cobrar sin internet es un requisito de supervivencia operativa. Cobrarlo como un "add-on" o restringirlo a planes caros genera fricción innecesaria. El offline se garantiza en los tres planes ($10, $20 y $30).
3. **Lo que aportó la era Tenant y la Suite Comercial (`master`):**
   - Módulos financieros, comerciales y de expansión: **Clientes y Fiados (CxC)**, **Proveedores y Compras (CxP)**, **Toma física de inventario / conteo ciego (Stocktaking)**, **Kits y Combos**, **Catálogo Digital Web público**, **Bancos y Conciliación**, **Cotizaciones** y **Multi-sucursal**. Estos módulos son los que crean la justificación económica para los escalones de **$20 (Pro)** y **$30 (Premium)**.

---

## 2. Estructura de Tiers Definitiva

```
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│     BÁSICO ($10/mes)    │   │      PRO ($20/mes)      │   │    PREMIUM ($30/mes)    │
│  "La base de la rama    │   │  "Gestión de compras,   │   │  "Omnicanalidad, combos │
│   original (main)"      │   │   fiados y auditoría"   │   │  y finanzas bancarias"  │
├─────────────────────────┤   ├─────────────────────────┤   ├─────────────────────────┤
│ • 1 Sucursal            │   │ • Hasta 2 Sucursales    │   │ • Hasta 5 Sucursales    │
│ • 2 Usuarios            │   │ • Hasta 6 Usuarios      │   │ • Usuarios ilimitados   │
│ • Hasta 500 productos   │   │ • Productos ilimitados  │   │ • Productos ilimitados  │
│ • APP DESKTOP OFFLINE   │   │ • APP DESKTOP OFFLINE   │   │ • APP DESKTOP OFFLINE   │
│   (Sync para todos)     │   │   (Sync para todos)     │   │   (Sync para todos)     │
│ • POS Multi-moneda      │   │ • Todo lo de BÁSICO +   │   │ • Todo lo de PRO +      │
│ • Caja (Reportes X y Z) │   │ • Clientes y Fiados     │   │ • Catálogo Digital Web  │
│ • Impresión térmica     │   │   (CxC con abonos)      │   │   (pedidos WhatsApp)    │
│ • Inventario y Mermas   │   │ • Proveedores y Compras │   │ • Combos y Kits         │
│ • Lotes y Vencimientos  │   │   (CxP con costos)      │   │ • Módulo de Bancos      │
│ • Tasa BCV automática   │   │ • Toma de Inventario    │   │   (conciliación)        │
│                         │   │   (auditoría con lector)│   │ • Cotizaciones          │
│                         │   │ • Reportes avanzados    │   │ • Auditoría forense     │
│                         │   │   y exportación Excel   │   │ • Soporte Prioritario   │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

---

## 3. Detalle y Justificación de Cada Plan

### 🥉 Plan BÁSICO — $10 / mes
*El espejo fiel de la rama `main` original.*
- **Para quién es:** Bodegas de barrio, quioscos, charcuterías, panaderías o tiendas independientes de una sola sede que necesitan facturar y controlar caja de inmediato.
- **Lo que incluye:**
  - **App Desktop con Sync Offline:** si se corta internet o la luz, la caja sigue cobrando en local y sincroniza al volver la red.
  - **POS Rápido Multi-Moneda:** cobro en USD, Bolívares a tasa oficial BCV, Pago Móvil, tarjetas y efectivo, con cálculo automático de vueltos multi-divisa.
  - **Caja Completa:** apertura, arqueos, Reporte X y Reporte Z diario, soporte de impresoras térmicas USB/Red.
  - **Inventario y Mermas:** productos, stock en tiempo real, alertas de bajo stock y registro de mermas/roturas.
  - **Lotes y Vencimientos:** alertas preventivas para productos perecederos (incorporado desde la rama base).
- **Límites:** 1 sede, 2 usuarios activos, hasta 500 productos.

---

### 🥈 Plan PRO — $20 / mes (El Escuadrón Comercial y Administrativo)
*El paso a la formalización operativa con crédito y compras.*
- **Para quién es:** Minimarkets y comercios activos que compran a crédito a proveedores, venden a crédito ("fiado") a clientes de confianza y necesitan auditar stock.
- **Lo que suma sobre el Básico:**
  - **Cuentas por Cobrar / Fiados (`/customers`):** asignación de límite de crédito a clientes, registro de ventas a crédito desde el POS, abonos parciales/totales y estados de cuenta.
  - **Proveedores y Cuentas por Pagar (`/suppliers`, `/purchases`):** registro de compras formales, recepción de mercancía y programación de pagos a distribuidores.
  - **Toma Física de Inventario (`/stocktaking`):** auditoría ciega con escáner de código de barras para detectar fugas de inventario y ajustes automáticos de descuadres.
  - **Reportes Analíticos:** exportación de datos a Excel/CSV y reportes ejecutivos de márgenes y rotación.
  - **Hasta 2 Sucursales** (tienda + depósito o 2da sede) y **hasta 6 usuarios**.

---

### 🥇 Plan PREMIUM — $30 / mes (Omnicanalidad, Finanzas y Escala)
*La solución integral para cadenas y negocios de alto volumen.*
- **Para quién es:** Cadenas de bodegones (3 a 5 sedes), supermercados y distribuidores que venden por redes sociales y manejan tesorería bancaria.
- **Lo que suma sobre el Pro:**
  - **Catálogo Digital Público Standalone (`/catalogo/:slug`):** catálogo online sin login para enviar por WhatsApp e Instagram, permitiendo recibir pedidos directos sin pagar comisiones de apps externas.
  - **Combos y Kits de Productos (`KitComponent`):** creación de combos parrilleros, canastas navideñas o packs promocionales con descuento automático del inventario de los componentes.
  - **Módulo de Bancos y Conciliación (`/banks`):** control de cuentas bancarias (Banesco, Zelle, Pago Móvil, Binance), transferencias internas y conciliación de movimientos.
  - **Presupuestos y Cotizaciones (`/quotes`):** generación de presupuestos formales que se convierten en venta con un solo clic.
  - **Auditoría Forense Avanzada:** trazabilidad de cualquier cambio de precios, anulaciones sospechosas o excepciones operativas.
  - **Hasta 5 Sucursales incluidas** y **usuarios ilimitados**.

---

## 4. Configuración Técnica en el Repositorio

### A. Límites en Backend (`ERP-Market/backend/src/core/middlewares/plan.middleware.ts`)
```typescript
const DEFAULT_PLAN_LIMITS: Record<string, Record<PlanResource, number>> = {
    basic: { users: 2, branches: 1, products: 500 },
    pro: { users: 6, branches: 2, products: 99999 },
    premium: { users: 999, branches: 5, products: 99999 },
};
```

### B. Rutas Permitidas en Frontend (`ERP-Market/frontend/src/lib/planConfig.ts`)
```typescript
export type PlanType = 'BASICO' | 'PRO' | 'PREMIUM';

export const PLANS: Record<PlanType, PlanConfig> = {
    BASICO: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/products',
            '/sales',
            '/finance/cash-register',
            '/audit',
            '/merma',
            '/settings'
        ]
    },
    PRO: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/products',
            '/sales',
            '/finance/cash-register',
            '/audit',
            '/merma',
            '/customers',        // Fiados y CxC
            '/suppliers',        // Proveedores
            '/purchases',        // Compras y CxP
            '/stocktaking',      // Conteo físico
            '/reports',          // Reportes y Excel
            '/settings'
        ]
    },
    PREMIUM: {
        allowedPaths: [
            '/dashboard',
            '/pos',
            '/inventory',
            '/inventory/batches',
            '/products',
            '/products/categories',
            '/sales',
            '/finance',
            '/finance/cash-register',
            '/audit',
            '/merma',
            '/customers',
            '/suppliers',
            '/purchases',
            '/stocktaking',
            '/reports',
            '/quotes',           // Cotizaciones
            '/banks',            // Bancos y conciliación
            '/catalog',          // Catálogo Digital
            '/users',
            '/settings'
        ]
    }
};
```

### C. Precios en Management Server (`ERP-Market/management/server/src/modules/billing/billing.routes.ts`)
```typescript
const plans: Record<string, { name: string; priceCents: number; currency: string }> = {
    free: { name: 'Free', priceCents: 0, currency: 'USD' },
    basic: { name: 'Básico', priceCents: 1000, currency: 'USD' },   // $10
    pro: { name: 'Pro', priceCents: 2000, currency: 'USD' },       // $20
    premium: { name: 'Premium', priceCents: 3000, currency: 'USD' }, // $30
};
```
