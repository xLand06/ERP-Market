import { prismaCloud, getLocalPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

/**
 * Descarga el catálogo y datos operativos desde Supabase (cloud) hacia SQLite (local).
 *
 * Siempre se ejecuta, tanto en Electron como en modo standalone.
 *
 * Qué se descarga:
 *   1. Groups + SubGroups (catálogo)
 *   2. Products + Presentations + Barcodes (catálogo)
 *   3. Branches (sedes)
 *   4. Users (empleados)
 *   5. ExchangeRates (tasas de cambio)
 *   6. Transactions + Items (ventas) — solo las marcadas SYNCED en cloud
 *      → Esto permite que el dueño vea ventas de TODAS las sucursales.
 */
export async function pullCatalog(): Promise<{ success: boolean; pulledItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    const cloud = prismaCloud; // lanza si no hay cloud, manejado por el llamador
    
    let pulledCount = 0;

    try {
        logger.info('[Sync] Iniciando Pull desde cloud...');

        // ─── 1. GROUPS ─────────────────────────────────────────────────────────
        const cloudGroups = await cloud.group.findMany();
        for (const group of cloudGroups) {
            try {
                await localPrisma.group.upsert({
                    where: { id: group.id },
                    update: { name: group.name, description: group.description ?? undefined },
                    create: { id: group.id, name: group.name, description: group.description ?? undefined },
                });
                pulledCount++;
            } catch { /* Ignorar conflictos individuales */ }
        }

        // ─── 2. SUBGROUPS ───────────────────────────────────────────────────────
        const cloudSubGroups = await cloud.subGroup.findMany();
        for (const sg of cloudSubGroups) {
            try {
                await localPrisma.subGroup.upsert({
                    where: { id: sg.id },
                    update: { name: sg.name, groupId: sg.groupId },
                    create: { id: sg.id, name: sg.name, groupId: sg.groupId },
                });
                pulledCount++;
            } catch { /* Ignorar conflictos individuales */ }
        }

        // ─── 3. PRODUCTS + PRESENTATIONS + BARCODES ────────────────────────────
        const cloudProducts = await cloud.product.findMany({
            include: { presentations: true, barcodes: true },
        });

        for (const prod of cloudProducts) {
            try {
                await localPrisma.product.upsert({
                    where: { id: prod.id },
                    update: {
                        name: prod.name,
                        description: prod.description ?? undefined,
                        barcode: prod.barcode ?? undefined,
                        price: Number(prod.price),
                        cost: prod.cost != null ? Number(prod.cost) : undefined,
                        baseUnit: prod.baseUnit,
                        imageUrl: prod.imageUrl ?? undefined,
                        isActive: prod.isActive,
                        subGroupId: prod.subGroupId ?? undefined,
                        expectedSpoilagePercent: prod.expectedSpoilagePercent != null ? Number(prod.expectedSpoilagePercent) : undefined,
                    },
                    create: {
                        id: prod.id,
                        name: prod.name,
                        description: prod.description ?? undefined,
                        barcode: prod.barcode ?? undefined,
                        price: Number(prod.price),
                        cost: prod.cost != null ? Number(prod.cost) : undefined,
                        baseUnit: prod.baseUnit,
                        imageUrl: prod.imageUrl ?? undefined,
                        isActive: prod.isActive,
                        subGroupId: prod.subGroupId ?? undefined,
                        expectedSpoilagePercent: prod.expectedSpoilagePercent != null ? Number(prod.expectedSpoilagePercent) : undefined,
                    },
                });
                pulledCount++;
            } catch { /* Ignorar conflictos individuales */ }

            // Presentations
            for (const pres of prod.presentations) {
                try {
                    await localPrisma.productPresentation.upsert({
                        where: { id: pres.id },
                        update: {
                            name: pres.name,
                            multiplier: Number(pres.multiplier),
                            price: Number(pres.price),
                            barcode: pres.barcode ?? undefined,
                        },
                        create: {
                            id: pres.id,
                            name: pres.name,
                            multiplier: Number(pres.multiplier),
                            price: Number(pres.price),
                            barcode: pres.barcode ?? undefined,
                            productId: pres.productId,
                        },
                    });
                } catch { /* Ignorar */ }
            }

            // Barcodes adicionales
            for (const bc of prod.barcodes) {
                try {
                    await localPrisma.productBarcode.upsert({
                        where: { id: bc.id },
                        update: { code: bc.code, label: bc.label ?? undefined },
                        create: { id: bc.id, code: bc.code, label: bc.label ?? undefined, productId: bc.productId },
                    });
                } catch { /* Ignorar */ }
            }
        }

        // ─── 4. BRANCHES ────────────────────────────────────────────────────────
        const cloudBranches = await cloud.branch.findMany();
        for (const branch of cloudBranches) {
            try {
                await localPrisma.branch.upsert({
                    where: { id: branch.id },
                    update: {
                        name: branch.name,
                        code: branch.code ?? '',
                        address: branch.address ?? undefined,
                        phone: branch.phone ?? undefined,
                        isActive: branch.isActive,
                    },
                    create: {
                        id: branch.id,
                        name: branch.name,
                        code: branch.code ?? '',
                        address: branch.address ?? undefined,
                        phone: branch.phone ?? undefined,
                        isActive: branch.isActive,
                    },
                });
                pulledCount++;
            } catch { /* Ignorar */ }
        }

        // ─── 5. USERS ───────────────────────────────────────────────────────────
        const cloudUsers = await cloud.user.findMany({ where: { isActive: true } });
        for (const user of cloudUsers) {
            try {
                const existingUser = await localPrisma.user.findFirst({
                    where: {
                        OR: [
                            { id: user.id },
                            { username: user.username }
                        ]
                    }
                });

                if (existingUser) {
                    await localPrisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            username: user.username,
                            nombre: user.nombre,
                            apellido: user.apellido ?? undefined,
                            email: user.email ?? undefined,
                            cedula: user.cedula,
                            cedulaType: user.cedulaType as any,
                            password: user.password,
                            telefono: user.telefono ?? undefined,
                            role: user.role as any,
                            isActive: user.isActive,
                            branchId: user.branchId ?? undefined,
                            canManageInventory: user.canManageInventory,
                        },
                    });
                } else {
                    await localPrisma.user.create({
                        data: {
                            id: user.id,
                            username: user.username,
                            cedula: user.cedula,
                            cedulaType: user.cedulaType as any,
                            nombre: user.nombre,
                            apellido: user.apellido ?? undefined,
                            email: user.email ?? undefined,
                            password: user.password,
                            telefono: user.telefono ?? undefined,
                            role: user.role as any,
                            isActive: user.isActive,
                            branchId: user.branchId ?? undefined,
                            canManageInventory: user.canManageInventory,
                        },
                    });
                }
                pulledCount++;
            } catch { /* Ignorar */ }
        }

        // ─── 6. EXCHANGE RATES ──────────────────────────────────────────────────
        const cloudRates = await cloud.exchangeRate.findMany();
        for (const rate of cloudRates) {
            try {
                await localPrisma.exchangeRate.upsert({
                    where: { id: rate.id },
                    update: { rate: Number(rate.rate) },
                    create: { id: rate.id, code: rate.code, rate: Number(rate.rate) },
                });
                pulledCount++;
            } catch { /* Ignorar */ }
        }

        // ─── 6.5. CASH REGISTERS ────────────────────────────────────────────────
        const cloudCashRegisters = await cloud.cashRegister.findMany();
        for (const cr of cloudCashRegisters) {
            try {
                await localPrisma.cashRegister.upsert({
                    where: { id: cr.id },
                    update: {
                        status: cr.status as any,
                        openingAmount: Number(cr.openingAmount),
                        closingAmount: cr.closingAmount != null ? Number(cr.closingAmount) : undefined,
                        expectedAmount: cr.expectedAmount != null ? Number(cr.expectedAmount) : undefined,
                        difference: cr.difference != null ? Number(cr.difference) : undefined,
                        notes: cr.notes ?? undefined,
                        syncStatus: 'SYNCED',
                        syncedAt: cr.syncedAt ?? new Date(),
                        openedAt: cr.openedAt,
                        closedAt: cr.closedAt ?? undefined,
                        userId: cr.userId,
                        branchId: cr.branchId,
                    },
                    create: {
                        id: cr.id,
                        status: cr.status as any,
                        openingAmount: Number(cr.openingAmount),
                        closingAmount: cr.closingAmount != null ? Number(cr.closingAmount) : undefined,
                        expectedAmount: cr.expectedAmount != null ? Number(cr.expectedAmount) : undefined,
                        difference: cr.difference != null ? Number(cr.difference) : undefined,
                        notes: cr.notes ?? undefined,
                        syncStatus: 'SYNCED',
                        syncedAt: cr.syncedAt ?? new Date(),
                        openedAt: cr.openedAt,
                        closedAt: cr.closedAt ?? undefined,
                        userId: cr.userId,
                        branchId: cr.branchId,
                    },
                });
                pulledCount++;
            } catch (e) {
                logger.error("[Sync] Error upsert CashRegister: " + (e as Error).message);
            }
        }

        // ─── 7. TRANSACTIONS (solo SYNCED → para vista del dueño) ──────────────
        // Pull de transacciones ya sincronizadas desde otras sucursales.
        // Esto NO sobreescribe las transacciones locales PENDING (ventas propias sin subir).
        const cloudTxs = await cloud.transaction.findMany({
            where: { syncStatus: 'SYNCED' },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            take: 500, // Últimas 500 ventas
        });

        for (const tx of cloudTxs) {
            try {
                // Solo pull si no existe localmente, o si la local ya está SYNCED
                const existing = await localPrisma.transaction.findUnique({ where: { id: tx.id } });
                if (existing && existing.syncStatus === 'PENDING') continue; // No tocar ventas locales pendientes

                await localPrisma.transaction.upsert({
                    where: { id: tx.id },
                    update: {
                        type: tx.type as any,
                        status: tx.status as any,
                        total: Number(tx.total),
                        notes: tx.notes ?? undefined,
                        currency: (tx as any).currency ?? 'COP',
                        exchangeRate: (tx as any).exchangeRate ? Number((tx as any).exchangeRate) : undefined,
                        invoiceNumber: (tx as any).invoiceNumber ?? undefined,
                        syncStatus: 'SYNCED',
                        syncedAt: tx.syncedAt ?? new Date(),
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId ?? undefined,
                    },
                    create: {
                        id: tx.id,
                        type: tx.type as any,
                        status: tx.status as any,
                        total: Number(tx.total),
                        notes: tx.notes ?? undefined,
                        ipAddress: tx.ipAddress ?? undefined,
                        currency: (tx as any).currency ?? 'COP',
                        exchangeRate: (tx as any).exchangeRate ? Number((tx as any).exchangeRate) : undefined,
                        invoiceNumber: (tx as any).invoiceNumber ?? undefined,
                        syncStatus: 'SYNCED',
                        syncedAt: tx.syncedAt ?? new Date(),
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId ?? undefined,
                    },
                });

                // Pull items de la transacción
                for (const item of tx.items) {
                    try {
                        await localPrisma.transactionItem.upsert({
                            where: { id: item.id },
                            update: {
                                quantity: Number(item.quantity),
                                multiplierUsed: Number(item.multiplierUsed),
                                unitPrice: Number(item.unitPrice),
                                subtotal: Number(item.subtotal),
                            },
                            create: {
                                id: item.id,
                                transactionId: item.transactionId,
                                productId: item.productId,
                                presentationId: item.presentationId ?? undefined,
                                quantity: Number(item.quantity),
                                multiplierUsed: Number(item.multiplierUsed),
                                unitPrice: Number(item.unitPrice),
                                subtotal: Number(item.subtotal),
                            },
                        });
                    } catch { /* Ignorar */ }
                }

                pulledCount++;
            } catch { /* Ignorar */ }
        }

        logger.info(`[Sync] Pull completado — ${pulledCount} registros actualizados`);
        return { success: true, pulledItems: pulledCount };

    } catch (error: any) {
        logger.error('[Sync] Error en Pull:', error.message);
        return { success: false, error: error.message };
    }
}