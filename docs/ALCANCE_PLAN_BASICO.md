# Alcance Completo del Plan BÁSICO: ALLMARKET
**Auditoría Funcional de la Rama Base (`main` Pre-Tenant)**  
*Documento de Referencia Técnica y Comercial | Precio: $10 / mes*

---

## 1. Resumen de la Identidad del Plan Básico

El **Plan Básico ($10/mes)** no es una maqueta recortada ni una versión de prueba: **es exactamente el sistema ERP comercial completo y maduro que existía en la rama `main`** antes de la separación en infraestructura multi-tenant.

Fue diseñado para resolver al 100% la operatividad diaria de un comercio independiente (bodega, abasto, minimarket de 1 sede, panadería, charcutería, licorería o quiosco) en el contexto de Venezuela y América Latina, donde la estabilidad de internet y la fluctuación cambiaria son los mayores desafíos.

---

## 2. Inventario Exhaustivo Módulo por Módulo

### 🛒 1. Punto de Venta (POS) — Venta Rápida y Cobro Multi-Moneda
*Ruta: `/pos`*
- **Búsqueda y Escaneo de Productos:**
  - Búsqueda en tiempo real por nombre, código interno o código de barras.
  - Soporte de pistola lectora de código de barras USB/Bluetooth.
  - Escaneo directo mediante la cámara de smartphones o tablets (vía `html5-qrcode`).
  - Navegación táctil con cuadrícula de productos y chips de categorías.
- **Carrito de Compras y Control de Ítems:**
  - Incremento/decremento rápido de cantidades y eliminación táctil.
  - Cálculo automático de subtotal, Base Imponible gravada al 16% (estándar SENIAT) y productos exentos.
  - Atajos de teclado ergonómicos (`F2` cobrar, `F4` buscar, `Esc` cancelar).
- **Dialogo de Cobro Multi-Pago (`PaymentDialog`):**
  - **Múltiples métodos combinados en un solo ticket:** pago simultáneo con dólares en efectivo, bolívares por Pago Móvil, tarjeta de débito y vuelto en efectivo.
  - Chips táctiles de billetes rápidos configurados por divisa (Bs. 20, 50, 100, 200, 500 / $1, $5, $10, $20, $50, $100 / COP).
  - Presets de división de cuenta (50/50, partes iguales).
  - Barra de progreso visual que indica cuánto se ha cubierto y cuánto falta por pagar.
  - **Calculadora de Vuelto Multi-Moneda:** si el cliente paga con $20 una cuenta de $13, el sistema calcula el vuelto exacto en divisas ($7) o su equivalente en Bolívares a la tasa del día.
- **Emisión e Impresión de Tickets Térmicos:**
  - Driver de impresión directa ESC/POS vía WebUSB o impresora de red IP.
  - Formato legal para ticket fiscal de contingencia (Datos de la empresa, RIF, número de factura/control, desglose de impuestos, desglose de formas de pago).
  - Impresión no bloqueante con apertura automática de gaveta de dinero.
  - Reimpresión de tickets desde el historial de ventas.

---

### 💵 2. Caja Registradora, Turnos y Arqueos
*Ruta: `/finance/cash-register`*
- **Control de Turnos:**
  - Apertura obligatoria de caja con registro de fondo inicial en bolívares y dólares.
  - Registro de cajero responsable por turno.
- **Movimientos de Caja Chica:**
  - Registro de gastos menores operativos o retiros de efectivo (`ExpenseEntryModal`).
- **Arqueo y Cierre Ciego:**
  - Modal de cierre (`CashClosureModal`): el cajero ingresa el conteo físico de billetes sin ver el total del sistema para evitar manipulaciones.
  - Cálculo de sobrantes y faltantes por divisa.
- **Reportes de Turno y Cierre Diario:**
  - **Reporte X:** corte parcial a mitad de turno para auditar la caja sin cerrarla.
  - **Reporte Z:** cierre fiscal y operativo definitivo del día con resumen total de ventas, cobros por método, total de IVA recaudado y resumen de movimientos.

---

### 📦 3. Inventario y Control de Stock
*Ruta: `/inventory`*
- **Monitoreo de Existencias en Tiempo Real:**
  - Visualización del stock disponible por producto.
  - Filtros instantáneos por Grupo y Subgrupo de catálogo.
- **Ajustes de Inventario:**
  - Ajuste manual de stock (`StockAdjustmentModal`) con justificación administrativa.
  - Modal de entrada rápida de mercancía (`StockEntryModal`).
- **Alertas de Stock Mínimo:**
  - Indicadores visuales automáticos cuando un producto llega al umbral de reorden para evitar quiebres de stock.

---

### 🏷️ 4. Trazabilidad de Lotes y Fechas de Vencimiento (FEFO)
*Ruta: `/inventory/batches`*
- **Registro Detallado de Lotes:**
  - Código de lote, fecha de fabricación, fecha de caducidad y cantidad de unidades recibidas.
- **Semáforo Visual de Alertas:**
  - Verde: producto con vigencia óptima (>30 días).
  - Amarillo: producto próximo a vencer (<30 días).
  - Rojo: producto vencido.
- **Consumo Inteligente FEFO (First Expired, First Out):**
  - Despacho preferente del lote más próximo a caducar al vender en el POS.
- **Panel de Alertas en Dashboard (`ExpiringBatchesPanel`):**
  - Notificaciones visibles al iniciar sesión sobre qué productos deben rematarse o retirarse.

---

### 🗑️ 5. Gestión de Mermas y Desperdicios
*Ruta: `/merma`*
- **Registro Clasificado de Bajas (`MermaForm`):**
  - Permite dar de baja productos sin alterar los números de ventas ni falsear el costo.
  - Clasificación por motivo estandarizado (`MermaReason`):
    - `EXPIRED` (Vencido)
    - `DAMAGED` (Dañado / Roto)
    - `BAD_CONDITION` (Mal estado)
    - `SOBRANTE` (Ajuste de peso/merma natural)
    - `OTHER` (Otro motivo justificado)
- **Tablero Financiero de Mermas (`MermaCards`, `MermaTable`):**
  - Métricas acumuladas del costo total en dólares y bolívares de la mercancía perdida en el mes.

---

### 📋 6. Catálogo de Productos y Precios
*Ruta: `/products`*
- **Ficha Técnica del Producto:**
  - Nombre, descripción, código SKU interno.
  - Precio de venta referencial en USD y costo base.
  - Soporte de múltiples códigos de barra alternativos por producto (`ProductBarcode`).
  - Soporte de múltiples presentaciones (`ProductPresentation`): venta por unidad suelta, six-pack, paquete o bulto cerrado con factores de conversión de stock automáticos.
  - Clasificación jerárquica: Grupos y Subgrupos.
  - Flag de tratamiento tributario: Gravado al 16% o Exento.
- **Herramientas de Exportación e Impresión:**
  - Exportación de la base de datos de productos a formato Excel / CSV.
  - Generador e impresor de etiquetas adhesivas con código de barras y precio para colocar en estantes y góndolas.

---

### 📊 7. Dashboard Ejecutivo y Reportes
*Ruta: `/dashboard`*
- **Métricas Clave del Negocio (KPIs):**
  - Total facturado en el día (en USD y Bs.).
  - Cantidad de transacciones y ticket promedio.
  - Cantidad de productos con stock en nivel crítico.
  - Conteo de lotes vencidos o por vencer.
- **Visualización Gráfica:**
  - Gráfico de tendencia de ventas diarias y semanales (`SalesTrendChart`).
  - Ranking de los productos con mayor rotación y margen (`TopProductsChart`).

---

### 🧾 8. Historial de Ventas
*Ruta: `/sales`*
- Listado histórico de todas las transacciones realizadas.
- Filtros por fecha, cajero o número de comprobante.
- Visor de detalle de venta (`SaleDetailModal`): desglose de cada producto vendido, cantidades, tasa de cambio aplicada en ese momento exacto, métodos de pago recibidos y vuelto emitido.

---

### 🛡️ 9. Seguridad y Bitácora de Auditoría
*Ruta: `/audit`*
- **Registro Inmutable de Eventos:**
  - Bitácora que registra cada acción con marca de tiempo, usuario y dirección IP/equipo.
  - Eventos redactados en lenguaje natural: *"El cajero Juan abrió caja con $50"*, *"Se anuló la venta #1042"*, *"Se modificó el precio de Harina PAN"*.
- **Enlace Directo:**
  - Botón interactivo para abrir y verificar el comprobante de venta directamente desde la línea del log de auditoría.

---

### 👥 10. Gestión de Usuarios y Permisos de Caja
*Ruta: `/users`*
- Directorio de empleados con soporte de Cédula Venezolana (V/E).
- Roles nativos:
  - **OWNER (Dueño / Administrador):** acceso total a configuración, costos, márgenes y reportes.
  - **SELLER (Cajero / Vendedor):** interfaz limpia enfocada en venta rápida, arqueo de caja y consulta de inventario.
- Permisos granulares: activación/desactivación de permiso para cerrar turno anticipadamente, actualizar tasas de cambio o modificar inventario.

---

### ⚙️ 11. Configuración Global y Hardware
*Ruta: `/settings`*
- **Datos Fiscales del Negocio:**
  - Nombre comercial, RIF, dirección física, teléfonos de contacto y logotipo para recibos.
- **Gestión Multi-Moneda y Tasa de Cambio:**
  - Selección de moneda principal de operación (USD, VES o COP).
  - Integración automática con API cambiaria (tasa oficial del BCV, tasa Paralelo o Euro) con actualización en tiempo real.
  - Opción de sobreescritura manual de la tasa por parte del dueño.
  - Soporte de más de 80 monedas internacionales ISO 4217.
- **Configuración de Hardware e Impresoras Térmicas:**
  - Auto-detección de impresoras conectadas por USB (WebUSB).
  - Configuración de impresoras térmicas de red IP con ping de diagnóstico.
  - Selector de ancho de papel (58mm / 80mm).
  - Vista previa en vivo idéntica al ticket físico que se imprimirá.
- **Personalización Visual (Temas):**
  - 5 paletas de color con activación en 1 clic: Emerald ERP, Indigo Royal, Espresso & Amber, Rose Boutique y Cyber Dark.
  - Modo Oscuro de alto contraste (>4.5:1 WCAG AA) diseñado para evitar el cansancio visual en jornadas largas de caja.
- **Respaldo de Datos (Backups):**
  - Panel de generación y descarga de copias de seguridad de la base de datos local.

---

### ⚡ 12. Motor Desktop Offline y Sincronización
*Ruta: Base de la aplicación Desktop (Electron / Capacitor)*
- **Operación Sin Dependencia de Internet:**
  - Base de datos local embebida (SQLite / PostgreSQL local).
  - Toda la lógica del POS, inventario, precios y arqueo corre en local en la computadora o punto de venta.
  - Si se cae Cantv, Inter o la fibra óptica, o si hay fluctuaciones eléctricas, **el negocio sigue facturando y cobrando sin interrupción**.
- **Arquitectura de Sincronización (Outbox Pattern):**
  - Los eventos generados en offline se almacenan en una cola persistente.
  - En cuanto la aplicación detecta reconexión a internet, sincroniza bidireccionalmente contra el servidor en la nube sin pérdida de datos ni duplicación de tickets.

---

## 3. Matriz de Límites del Plan BÁSICO ($10)

| Parámetro | Límite en Plan Básico | Justificación Técnica / Negocio |
| :--- | :--- | :--- |
| **Sucursales** | **1 Sucursal** | Ideal para negocios locales de una sola tienda. |
| **Usuarios simultáneos** | **Hasta 2 Usuarios** | Típicamente: 1 Dueño/Encargado + 1 Cajero por turno. |
| **Catálogo de productos** | **Hasta 500 productos activos** | Cubre holgadamente el inventario de una bodega o tienda especializada. |
| **Modo Desktop Offline** | **Incluido 100%** | Garantía de que nunca se detiene la caja registradora. |
| **Tickets y Ventas** | **Ilimitadas** | No penaliza el éxito en ventas del comerciante. |

---

## 4. Qué NO está en Básico (Frontera hacia Pro y Premium)

Para que el cliente entienda con total claridad cuándo debe dar el salto:

- **Hacia el Plan PRO ($20):**
  - No incluye **Cuentas por Cobrar / Fiados a clientes** con control de abonos.
  - No incluye **Gestión formal de Proveedores y Cuentas por Pagar (CxP)**.
  - No incluye **Toma física de inventario con escáner ciego (Stocktaking)**.
  - Limitado a 1 sede y 2 usuarios (Pro permite 2 sedes y 6 usuarios con productos ilimitados).
- **Hacia el Plan PREMIUM ($30):**
  - No incluye **Catálogo Digital Web público (`/catalogo/:slug`)** para vender por WhatsApp.
  - No incluye **Combos y Kits de productos**.
  - No incluye **Módulo de Bancos y Conciliación multi-cuenta**.
  - No incluye **Cotizaciones formales** ni **Auditoría forense completa**.
