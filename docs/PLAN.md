# ERP-Market - Plan de Implementación Completo

## Resumen Ejecutivo

Sistema ERP para minimarkets/bodegones con:
- **POS Dual**: Ventas + Entrada de mercancía
- **Multi-sede**: Sede A, Sede B, etc.
- **Modelo**: SQLite local + Supabase (cloud)
- **Roles**: OWNER (admin) + SELLER (cajero)
- **Auditoría**: Caja negra
- **Escalable**: Planes Basic, Pro, Premium

---

## 1. Arquitectura del Sistema

### 1.1 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind CSS 4 |
| Backend | Node.js + Express + Prisma 7.x |
| Database Cloud | Supabase (PostgreSQL) |
| Database Local | SQLite (modo offline) |
| Desktop | Electron |
| Auth | JWT + bcrypt |
| Estado | Zustand |
| API | React Query + Axios |

### 1.2 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON APP                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Frontend  │───▶│ Express :3001│───▶│ SQLite   │  │
│  │   React     │    │   Local API  │    │  Local   │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│                           │                         │
│                     Sync Worker                      │
│                     (cada 5 min)                     │
│                           │                         │
└───────────────────────────┼───────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Cloud)                     │
│                  PostgreSQL (Cloud)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Schema de Base de Datos

### 2.1 Modelo de Datos Completo

```prisma
// =============================================================================
// ERP-MARKET - SCHEMA COMPLETO (Prisma 7.x + Supabase)
// Login por username + Cédula Venezuela (V/E)
// =============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// =============================================================================
// ENUMS
// =============================================================================

enum Role {
  OWNER
  SELLER
}

enum TransactionType {
  SALE
  INVENTORY_IN
}

enum TransactionStatus {
  COMPLETED
  CANCELLED
  PENDING
}

enum CashRegisterStatus {
  OPEN
  CLOSED
}

enum PurchaseOrderStatus {
  DRAFT
  SENT
  RECEIVED
  CANCELLED
}

enum SyncStatus {
  PENDING
  SYNCED
  FAILED
}

enum CedulaType {
  V
  E
}

// =============================================================================
// USERS (AUTH)
// =============================================================================

model User {
  id         String    @id @default(cuid())
  username   String    @unique
  cedula     String
  cedulaType  CedulaType @default(V)
  nombre     String
  apellido   String?
  email      String?
  password   String
  telefono   String?
  role       Role      @default(SELLER)
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now()) @db.Timestamptz
  updatedAt  DateTime  @updatedAt    @db.Timestamptz

  transactions  Transaction[]
  cashRegisters CashRegister[]
  auditLogs     AuditLog[]

  @@index([username])
  @@index([cedula])
  @@index([role])
  @@index([isActive])
  @@map("users")
}

// =============================================================================
// BRANCHES (Sedes)
// =============================================================================

model Branch {
  id        String    @id @default(cuid())
  name      String
  address   String?
  phone     String?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt    @db.Timestamptz

  inventory     BranchInventory[]
  transactions  Transaction[]
  cashRegisters CashRegister[]

  @@index([isActive])
  @@map("branches")
}

// =============================================================================
// CATEGORIES
// =============================================================================

model Category {
  id          String    @id @default(cuid())
  name        String    @unique
  description String?
  createdAt   DateTime  @default(now()) @db.Timestamptz
  updatedAt   DateTime  @updatedAt    @db.Timestamptz

  products Product[]

  @@map("categories")
}

// =============================================================================
// PRODUCTS
// =============================================================================

model Product {
  id          String    @id @default(cuid())
  name        String
  description String?
  barcode    String?   @unique
  price       Float
  cost        Float?
  imageUrl    String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now()) @db.Timestamptz
  updatedAt   DateTime  @updatedAt     @db.Timestamptz

  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])

  inventory        BranchInventory[]
  transactionItems TransactionItem[]

  @@index([name])
  @@index([categoryId])
  @@index([isActive])
  @@index([barcode])
  @@map("products")
}

// =============================================================================
// INVENTORY BY BRANCH
// =============================================================================

model BranchInventory {
  id        String   @id @default(cuid())
  stock     Int      @default(0)
  minStock  Int      @default(0)
  updatedAt DateTime @updatedAt @db.Timestamptz

  productId String
  product  Product @relation(fields: [productId], references: [id])

  branchId String
  branch  Branch  @relation(fields: [branchId], references: [id])

  @@unique([productId, branchId])
  @@index([branchId])
  @@index([stock])
  @@index([branchId, stock])
  @@map("branch_inventory")
}

// =============================================================================
// TRANSACTIONS
// =============================================================================

model Transaction {
  id         String            @id @default(cuid())
  type       TransactionType
  status     TransactionStatus @default(COMPLETED)
  total      Float
  notes      String?
  ipAddress  String?
  syncStatus SyncStatus        @default(PENDING)
  syncedAt   DateTime?         @db.Timestamptz
  createdAt  DateTime          @default(now()) @db.Timestamptz
  updatedAt  DateTime          @updatedAt    @db.Timestamptz

  userId String
  user   User   @relation(fields: [userId], references: [id])

  branchId String
  branch   Branch @relation(fields: [branchId], references: [id])

  cashRegisterId String?
  cashRegister  CashRegister? @relation(fields: [cashRegisterId], references: [id])

  items TransactionItem[]

  @@index([branchId, createdAt])
  @@index([userId])
  @@index([type, status])
  @@index([syncStatus])
  @@index([createdAt])
  @@map("transactions")
}

model TransactionItem {
  id        String  @id @default(cuid())
  quantity  Int
  unitPrice Float
  subtotal  Float

  transactionId String
  transaction  Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  productId String
  product  Product @relation(fields: [productId], references: [id])

  @@map("transaction_items")
}

// =============================================================================
// CASH REGISTER
// =============================================================================

model CashRegister {
  id             String             @id @default(cuid())
  status         CashRegisterStatus @default(OPEN)
  openingAmount  Float
  closingAmount  Float?
  expectedAmount Float?
  difference     Float?
  notes          String?
  syncStatus     SyncStatus        @default(PENDING)
  syncedAt       DateTime?         @db.Timestamptz
  openedAt       DateTime          @default(now()) @db.Timestamptz
  closedAt       DateTime?

  userId String
  user   User @relation(fields: [userId], references: [id])

  branchId String
  branch   Branch @relation(fields: [branchId], references: [id])

  transactions Transaction[]

  @@index([branchId])
  @@index([status])
  @@index([syncStatus])
  @@map("cash_registers")
}

// =============================================================================
// AUDIT LOGS
// =============================================================================

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  module    String
  details   Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now()) @db.Timestamptz

  userId String
  user   User   @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([module])
  @@index([createdAt])
  @@map("audit_logs")
}

// =============================================================================
// SUPPLIERS
// =============================================================================

model Supplier {
  id        String   @id @default(cuid())
  name      String
  rut       String?  @unique
  email     String?
  telefono  String?
  address   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt    @db.Timestamptz

  purchaseOrders PurchaseOrder[]

  @@map("suppliers")
}

// =============================================================================
// PURCHASE ORDERS
// =============================================================================

model PurchaseOrder {
  id         String              @id @default(cuid())
  status     PurchaseOrderStatus @default(DRAFT)
  total      Float
  notes      String?
  expectedAt DateTime?
  receivedAt DateTime?
  createdAt  DateTime            @default(now()) @db.Timestamptz
  updatedAt  DateTime            @updatedAt    @db.Timestamptz

  supplierId String
  supplier   Supplier @relation(fields: [supplierId], references: [id])

  items PurchaseOrderItem[]

  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id              String  @id @default(cuid())
  quantity        Int
  quantityReceived Int   @default(0)
  unitCost        Float
  subtotal        Float

  productId String

  purchaseOrderId String
  purchaseOrder  PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@map("purchase_order_items")
}
```

### 2.2 Eliminación Lógica

| Tabla | Campo isActive | Justificación |
|------|---------------|----------------|
| User | ✅ | Usuarios activos/inactivos |
| Branch | ✅ | Sedes habilitadas/deshabilitadas |
| Product | ✅ | Productos disponibles |
| Supplier | ✅ | Proveedores activos |
| Category | ❌ | Catálogo base, no se elimina |
| BranchInventory | ❌ | Stock 0 = vacío |

---

## 3. API Endpoints

### 3.1 Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /auth/login | Login por username o cédula |
| GET | /auth/me | Datos del usuario actual |

**Request Login:**
```json
{
  "username": "admin",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "cuid...",
      "username": "admin",
      "nombre": "Juan",
      "apellido": "Pérez",
      "email": "juan@email.com",
      "telefono": "04141234567",
      "role": "OWNER"
    }
  }
}
```

### 3.2 Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /products | Listar productos (paginado) |
| GET | /products/:id | Obtener producto |
| GET | /products/barcode/:code | Buscar por código de barras |
| POST | /products | Crear producto (OWNER) |
| PATCH | /products/:id | Actualizar producto (OWNER) |
| DELETE | /products/:id | Eliminar lógicamente |

### 3.3 Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /categories | Listar categorías |
| POST | /categories | Crear categoría (OWNER) |
| DELETE | /categories/:id | Eliminar categoría |

### 3.4 Inventario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /inventory/stock/:branchId | Stock por sede |
| GET | /inventory/low-stock | Productos bajo stock |
| PUT | /inventory/stock | Actualizar stock |

### 3.5 POS

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /pos/transactions | Nueva transacción (SALE/INVENTORY_IN) |
| GET | /pos/transactions | Listar transacciones |
| POST | /pos/transactions/:id/cancel | Cancelar transacción |

### 3.6 Caja

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /cash/register/open | Apertura de caja |
| POST | /cash/register/:id/close | Cierre de caja |
| GET | /cash/register/current | Caja abierta actual |

### 3.7 Dashboard

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /dashboard/kpis | KPIs generales |
| GET | /dashboard/sales-trend | Tendencia de ventas |
| GET | /dashboard/top-products | Productos más vendidos |
| GET | /dashboard/sales-by-branch | Ventas por sede |

### 3.8 Usuarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /users | Listar usuarios (OWNER) |
| POST | /users | Crear usuario (OWNER) |
| PATCH | /users/:id | Actualizar usuario (OWNER) |

### 3.9 Sedes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /branches | Listar sedes |
| POST | /branches | Crear sede (OWNER) |
| PATCH | /branches/:id | Actualizar sede |

---

## 4. Variables de Entorno

### 4.1 Backend (.env)

```env
# Servidor
PORT=3000

# Base de datos (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres

# SQLite local (modo offline)
LOCAL_DATABASE_URL=file:./erp-market.db

# Autenticación
JWT_SECRET=tu_secret_minimo_32_caracteres

# Entorno
NODE_ENV=development
```

### 4.2 Frontend (.env)

```env
# API
VITE_API_URL=http://127.0.0.1:3001
```

---

## 5. Guía de Instalación

### 5.1 Requisitos Previos

- Node.js 18+
- pnpm 8+
- Supabase (cuenta gratuita)

### 5.2 Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd ERP-Market

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar .env con tus credenciales de Supabase

# 4. Generar Prisma Client
cd backend
pnpm prisma generate
pnpm prisma generate --schema=prisma/schema.local.prisma

# 5. Ejecutar migraciones (solo una vez)
pnpm prisma migrate dev --name init

# 6. Iniciar desarrollo
pnpm dev
```

### 5.3 Ejecutar Electron

```bash
cd desktop
pnpm run dev
```

---

## 6. Características de Seguridad

### 6.1 Autenticación

- Login por **username** o **cédula** (V-12345678 / E-12345678)
- Password con validación de fortaleza:
  - Mínimo 8 caracteres
  - 1 mayúscula
  - 1 minúscula
  - 1 número
  - 1 carácter especial
- JWT token con vencimiento 12h

### 6.2 Autorización

- **OWNER**: Acceso total (usuarios, productos, precios, reportes)
- **SELLER**: Acceso operativo (POS, inventario de consulta, ventas)
- RBAC implementado con middlewares

### 6.3 Rate Limiting

- Login: 5 intentos / 15 minutos
- API general: 100 requests / 15 minutos

### 6.4 Auditoría

- Caja negra registra todas las acciones críticas:
  - Login/logout
  - Creación/edición/eliminación de productos
  - Cambios de precios
  - Apertura/cierre de caja

---

## 7. Sincronización

### 7.1 Modo Offline

- SQLite local en la carpeta de la app
- Sync worker cada 5 minutos
- Tracking de estado con syncStatus

### 7.2 Sync Manual

```typescript
// Desde el frontend
import { syncApi } from '@/services';

await syncApi.triggerSync();
```

---

## 8. Estructura de Archivos

```
ERP-Market/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Express app
│   │   ├── config/
│   │   │   ├── env.ts             # Variables de entorno
│   │   │   └── prisma.ts          # Configuración Prisma
│   │   ├── core/
│   │   │   ├── middlewares/       # Auth, RBAC, validation
│   │   │   ├── validations/       # Zod schemas
│   │   │   ├── types/             # Tipos TypeScript
│   │   │   └── utils/             # Logger, helpers
│   │   └── modules/
│   │       ├── auth/             # Login
│   │       ├── users/            # Usuarios
│   │       ├── branches/         # Sedes
│   │       ├── categories/       # Categorías
│   │       ├── products/         # Productos
│   │       ├── inventory/       # Inventario
│   │       ├── pos/             # Transacciones
│   │       ├── cashFlow/         # Caja
│   │       ├── dashboard/       # KPIs
│   │       ├── audit/            # Auditoría
│   │       └── sync/             # Sync
│   └── prisma/
│       ├── schema.prisma         # Cloud (Supabase)
│       └── schema.local.prisma  # Local (SQLite)
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # Router, query client
│   │   ├── components/          # UI components
│   │   ├── features/            # Páginas por feature
│   │   ├── hooks/               # Custom hooks
│   │   ├── lib/                 # Utils, API config
│   │   ├── services/            # API services
│   │   └── types/               # Tipos TypeScript
│   └── package.json
│
├── desktop/
│   ├── src/
│   │   ├── main/               # Electron main
│   │   └── preload/            # Preload scripts
│   └── electron.vite.config.ts
│
└── docs/
    └── PLAN.md                  # Este documento
```

---

## 9. Planes Futuros

### 9.1 Plan Basic (Actual)

- ✅ 1 sede
- ✅ POS básico
- ✅ Inventario simple
- ✅ Reportes básicos

### 9.2 Plan Pro (Pendiente)

- Multi-sede
- Proveedores
- Órdenes de compra
- Reportes avanzados

### 9.3 Premium (Pendiente)

- Múltiples usuarios
- Permisos granulares
- API pública
- Integraciones

---

## 10. Changelog

### v2.0.0 (2026-04-11)

- ✅ Login por username/cedula (V/E)
- ✅ Modelos actualizados con campos: nombre, apellido, telefono
- ✅ Eliminación lógica en User, Branch, Product, Supplier
- ✅ Enum SyncStatus para tracking
- ✅ Prisma 7.x con adapters

---

*Documento generado automáticamente*