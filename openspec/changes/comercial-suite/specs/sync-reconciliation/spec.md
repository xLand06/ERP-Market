# Sync-Reconciliation (Modified) Specification

## Purpose

Extiende la sincronización push para incluir los nuevos modelos de la suite comercial: Customer, KitComponent, SupplierPayment, BankAccount, BankTransaction.

## MODIFIED Requirements

### REQ-SR-01: Push sync para nuevos modelos (MODIFICADO)

`push-sales.service.ts` MUST reconciliar additionally: Customer, CustomerPayment, KitComponent, SupplierPayment, BankAccount, BankTransaction.
(Previously: Solo sincronizaba Transaction, BranchInventory, Product, User, Branch)

### REQ-SR-02: Mapeo de modelos a tablas (MODIFICADO)

Agregar mapeo: Customer→customers, CustomerPayment→customer_payments, KitComponent→kit_components, SupplierPayment→supplier_payments, BankAccount→bank_accounts, BankTransaction→bank_transactions.
(Previously: Mapeaba los 5 modelos base)

## Schema Changes

Sin cambios de schema; este spec documenta cambios en la lógica de sincronización.

## Business Rules

- Cada modelo nuevo se sincroniza de forma independiente.
- Conflictos se resuelven por `updatedAt` más reciente.
- Si la entidad no existe en destino, se inserta. Si existe, se actualiza.

## Scenarios

#### GIVEN customer creado offline WHEN sync push THEN customer se sincroniza a la nube
#### GIVEN bank-account creado en dispositivo A WHEN dispositivo B hace pull THEN bank-account aparece en B
#### GIVEN supplier-payment registrado cuando no hay conexión WHEN reconnect THEN payment se sincroniza incrementalmente

## Files to Modify

- `backend/src/modules/sync/push-sales.service.ts` — agregar modelos
- `push-schema.js` — agregar tablas nuevas
