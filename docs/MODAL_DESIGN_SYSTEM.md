# Standardized Modal Design System — ERP-Market

This document defines the authoritative UX/UI rules for all modal dialogs across **ERP-Market** (POS, Finance, Cash Register, Inventory, Settings).

---

## 🎨 1. Principles & Visual Anatomy

Every modal MUST follow a unified 3-part layout structure: **Header**, **Body (Scrollable)**, and **Footer (Actions)**.

```
┌────────────────────────────────────────────────────────┐
│ [Icon] Modal Title                    [Status Badge]   │ ← Header (Sticky/Fixed)
│ Subtitle / Contextual Description                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Scrollable Body Content                                │ ← Body (Max 85-90vh)
│ Inputs, Cards, Data Grids, Totals                      │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Secondary Action / Cancel]   [Primary Action / Confirm]│ ← Footer (Action Bar)
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ 2. TailWind Utility Specs & Theme Parity

All modal components MUST support both **Light Mode** and **Dark Mode** seamlessly.

### A. Backdrop & Dialog Container
- **Backdrop Overlay**: `bg-slate-950/65 backdrop-blur-md animate-in fade-in-0 duration-200`
- **Dialog Container**:
  - Light Mode: `bg-white border-slate-200 shadow-2xl text-slate-900`
  - Dark Mode: `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`
  - Shape & Sizing: `rounded-2xl border max-h-[90vh] flex flex-col overflow-hidden`

### B. Header Component
- **Container**: `p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0`
- **Icon Badge**: `w-10 h-10 rounded-xl flex items-center justify-center border shadow-2xs`
  - *Indigo Theme*: `bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900/60`
  - *Emerald Theme*: `bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60`
  - *Rose Theme*: `bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60`
- **Title**: `text-lg font-black tracking-tight text-slate-900 dark:text-slate-100`
- **Subtitle**: `text-xs text-slate-500 dark:text-slate-400 mt-1`
- **Status Badge (Optional)**: `text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border`

### C. Body Area (Scrollable)
- **Container**: `flex-1 overflow-y-auto p-4 sm:p-6 space-y-4`
- **Input Fields**:
  - `bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 rounded-xl font-bold h-11`

### D. Footer Action Bar
- **Container**: `p-4 sm:px-6 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800/80 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2.5`
- **Cancel Button**: `variant="ghost"` or `variant="outline"` (`border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold h-11 px-5 rounded-xl`)
- **Primary Button**: `bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold h-11 px-5 rounded-xl shadow-sm active:scale-[0.98] transition-all`

---

## ⌨️ 3. Accessibility & Keyboard Standard

1. **Escape Key (`ESC`)**: Closes modal automatically unless a critical mutation is pending (`isSubmitting: true`).
2. **AutoFocus**: Main input or primary action receives automatic focus upon opening.
3. **Tab Loop Focus Trap**: Focus must not leak to background elements behind the modal backdrop.
4. **Touch Friendly**: Action buttons must have a minimum target height of `44px` (`h-11`) for smooth mobile/tablet usage.

---

## 📦 4. Application Across Features

This design system applies to:
- `ReportXModal.tsx` (Arqueo Parcial de Caja)
- `ReportZModal.tsx` (Cierre Definitivo de Caja)
- `PaymentDialog.tsx` (Cobro de Venta POS)
- `TransactionSummary.tsx` (Resumen de Cobro y Facturación)
- `CashClosureModal.tsx` (Cierre de Turno Finance)
- `ProductFormModal.tsx` (Creación/Edición de Productos)
- `StockEntryModal.tsx` (Entrada de Inventario)
