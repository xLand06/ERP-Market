# Plan de Implementación: Selector de Sucursal (Branch Selector)

## Resumen Ejecutivo

Sistema de selección de sucursal para el ERP-Market con lógica diferenciada por rol:
- **OWNER**: Ve todas las sucursales + opción "Todas"
- **SELLER**: Solo puede ver su sucursal asignada

---

## Estado Inicial del Proyecto

| Aspecto | Estado |
|---------|--------|
| Sucursales en BD | 2 (Sede Central, Sede Norte) |
| Modelo User | **NO** tiene campo `branchId` |
| Backend `/api/branches` | ✅ Funcionando |
| Frontend selectedBranch | ✅ Existe en authStore |
| BranchSelector | ❌ No existe |

---

## Fases de Implementación

### FASE 1: Backend - Modificar Schema de Prisma

**Archivos a modificar:**
- `backend/prisma/schema.prisma`
- `backend/prisma/schema.local.prisma`

**Cambio en modelo User:**
```prisma
model User {
  id         String    @id @default(cuid())
  // ... campos existentes ...
  
  // AGREGAR ESTE CAMPO
  branchId   String?   // FK opcional a Branch
  branch     Branch?   @relation(fields: [branchId], references: [id])
  
  // ... resto de campos ...
}
```

**Agregar al modelo Branch:**
```prisma
model Branch {
  // ... campos existentes ...
  
  // AGREGAR ESTE CAMPO
  users      User[]    // relación inversa
}
```

### FASE 2: Migración y Seed

**Scripts SQL para ejecutar manualmente:**

```sql
-- Agregar columna branchId a users
ALTER TABLE users ADD COLUMN branchId UUID REFERENCES branches(id);

-- Asignar vendedor a sede específica
UPDATE users SET branchId = 'branch-sede-a' WHERE username = 'vendedor';
```

**Seed a actualizar:**
- `backend/prisma/seed.ts` - agregar branchId al crear usuarios
- Asegurar que las 2 sucursales existan

### FASE 3: Backend - Endpoints de Sucursal

**Verificar que GET /api/branches:**
- Retorne todas las sucursales activas
- El controller no filtre por usuario (OWNER ve todas)

**Posiblemente agregar:**
- `GET /api/branches/my-branch` - retorna la sucursal del SELLER

### FASE 4: Frontend - Crear BranchSelector

**Crear archivo:** `frontend/src/components/branch/BranchSelector.tsx`

**Funcionalidad:**
```typescript
interface BranchSelectorProps {
  // Propiedades del componente
}

// Lógica:
// - Si user.role === 'OWNER': mostrar todas las sucursales + "Todas"
// - Si user.role === 'SELLER': mostrar solo su sucursal (branchId)
// - Guardar en authStore.selectedBranch
```

**Diseño UI:**
- Dropdown en TopBar, cerca del perfil de usuario
- Icono de tienda/sucursal
- Nombre de la sucursal actual
- Click abre lista de opciones

### FASE 5: Frontend - Integrar en TopBar

**Modificar:** `frontend/src/components/layout/TopBar.tsx`

**Agregar:**
- Importar BranchSelector
- Insertar antes o después del perfil de usuario
- Pasar datos del usuario y función de cambio

### FASE 6: Frontend - Lógica de Permisos por Rol

**En BranchSelector:**
```typescript
const branches = useBranches();

// OWNER: todas las sucursales + "Todas"
if (user.role === 'OWNER') {
  options = [{ id: 'all', name: 'Todas las sucursales' }, ...branches];
} 
// SELLER: solo su sucursal
else if (user.role === 'SELLER' && user.branchId) {
  options = branches.filter(b => b.id === user.branchId);
  selectedBranch = user.branchId;
}
// SELLER sin sucursal asignada
else {
  // Mostrar warning o error
}
```

### FASE 7: Frontend - Persistencia

**Ya configurado en authStore.ts:**
```typescript
// El store ya usa persist con localStorage
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // ...
      selectedBranch: null,
      // ...
    }),
    { name: 'erp-market-auth' }
  )
);
```

**Asegurar que selectedBranch se guarde correctamente.**

### FASE 8: Plan Guard - Actualizar Permisos

**Modificar:** `frontend/src/lib/planConfig.ts`

**Agregar `/sales` al plan BASICO:**
```typescript
export const PLANS: Record<PlanType, PlanConfig> = {
  BASICO: {
    allowedPaths: [
      // ... existentes ...
      '/sales',  // AGREGAR ESTA LÍNEA
    ]
  },
  // ...
};
```

---

## Módulos que Usan selectedBranch

| Módulo | Archivo | Uso |
|--------|---------|-----|
| POS | `POSPage.tsx` | Stock, transacciones |
| Inventory | `InventoryPage.tsx` | Ver stock por sucursal |
| CashRegister | `CashRegisterPage.tsx` | Caja de la sucursal |
| Dashboard | `useDashboard.ts` | KPIs filtrados |

**Verificar que todos usen correctamente `selectedBranch`.**

---

## Testing Checklist

- [ ] OWNER ve dropdown con "Todas" + 2 sucursales
- [ ] OWNER puede cambiar entre sucursales
- [ ] OWNER al seleccionar "Todas" muestra datos aggregate
- [ ] SELLER ve solo su sucursal (no puede cambiar)
- [ ] SELLER sin branchId muestra mensaje de error
- [ ] Selección persiste al recargar página
- [ ] Logout limpia selectedBranch
- [ ] POS funciona con la sucursal seleccionada
- [ ] Inventory muestra stock de la sucursal
- [ ] Dashboard filtra por sucursal

---

## Notas Adicionales

- Las 2 sucursales existentes:
  - `branch-sede-a` → "Sede A — Principal"
  - `branch-sede-b` → "Sede B — Sucursal"

- Credenciales de prueba:
  - OWNER: `admin` / `admin`
  - SELLER: `vendedor` / `admin`

---

*Documento generado automáticamente - ERP-Market*
*Fecha: 2026-04-12*