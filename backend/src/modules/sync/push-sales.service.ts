import { getCloudPrisma, getLocalPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';
import { $Enums } from '@prisma/client';

/**
 * Push completo: sube TODO desde SQLite local → Supabase cloud.
 *
 * Orden (respeta dependencias de FK):
 *   1. Groups
 *   2. SubGroups
 *   3. Products + Presentations + Barcodes
 *   4. BranchInventory (stock por sucursal)
 *   5. Users
 *   6. Branches
 *   7. ExchangeRates
 *   8. CashRegisters (solo CLOSED + PENDING)
 *   9. Transactions PENDING + sus Items
 */
export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    const cloud = getCloudPrisma();

    if (!cloud) {
        logger.warn('[Sync] Cloud no disponible — saltando push');
        return { success: false, error: 'Cloud no disponible' };
    }

    let pushedCount = 0;

    try {
        logger.info('[Sync] Iniciando Push completo hacia cloud...');

        // ─── STEP 1: GROUPS ─────────────────────────────────────────────────────
        logger.info('[Sync] Step 1: Pushing Groups...');
        const localGroups = await localPrisma.group.findMany();
        for (const group of localGroups) {
            try {
                await cloud.group.upsert({
                    where: { id: group.id },
                    update: { name: group.name, description: group.description ?? null },
                    create: { id: group.id, name: group.name, description: group.description ?? null },
                });
                pushedCount++;
            } catch (err: any) {
                if (err.code !== 'P2002') logger.error(`[Sync] Error push group ${group.name}: ${err.message}`);
            }
        }

        // ─── STEP 2: SUBGROUPS ──────────────────────────────────────────────────
        logger.info('[Sync] Step 2: Pushing SubGroups...');
        const localSubGroups = await localPrisma.subGroup.findMany();
        for (const sg of localSubGroups) {
            try {
                await cloud.subGroup.upsert({
                    where: { id: sg.id },
                    update: { name: sg.name, groupId: sg.groupId },
                    create: { id: sg.id, name: sg.name, groupId: sg.groupId },
                });
                pushedCount++;
            } catch (err: any) {
                if (err.code !== 'P2002') logger.error(`[Sync] Error push subGroup ${sg.name}: ${err.message}`);
            }
        }

        // ─── STEP 3: PRODUCTS + PRESENTATIONS + BARCODES ───────────────────────
        logger.info('[Sync] Step 3: Pushing Products...');
        const localProducts = await localPrisma.product.findMany({
            include: { presentations: true, barcodes: true },
        });
        for (const prod of localProducts) {
            try {
                await cloud.product.upsert({
                    where: { id: prod.id },
                    update: {
                        name: prod.name,
                        description: prod.description ?? null,
                        barcode: prod.barcode ?? null,
                        price: Number(prod.price),
                        cost: prod.cost != null ? Number(prod.cost) : null,
                        baseUnit: prod.baseUnit,
                        imageUrl: prod.imageUrl ?? null,
                        isActive: prod.isActive,
                        subGroupId: prod.subGroupId ?? null,
                    },
                    create: {
                        id: prod.id,
                        name: prod.name,
                        description: prod.description ?? null,
                        barcode: prod.barcode ?? null,
                        price: Number(prod.price),
                        cost: prod.cost != null ? Number(prod.cost) : null,
                        baseUnit: prod.baseUnit,
                        imageUrl: prod.imageUrl ?? null,
                        isActive: prod.isActive,
                        subGroupId: prod.subGroupId ?? null,
                    },
                });
                pushedCount++;
            } catch (err: any) {
                if (err.code !== 'P2002') logger.error(`[Sync] Error push product ${prod.name}: ${err.message}`);
                continue; // Si falla el producto, no procesar sus presentaciones
            }

            // Presentations
            for (const pres of prod.presentations) {
                try {
                    await cloud.productPresentation.upsert({
                        where: { id: pres.id },
                        update: {
                            name: pres.name,
                            multiplier: Number(pres.multiplier),
                            price: Number(pres.price),
                            barcode: pres.barcode ?? null,
                        },
                        create: {
                            id: pres.id,
                            name: pres.name,
                            multiplier: Number(pres.multiplier),
                            price: Number(pres.price),
                            barcode: pres.barcode ?? null,
                            productId: pres.productId,
                        },
                    });
                } catch (err: any) {
                    if (err.code !== 'P2002') logger.error(`[Sync] Error push presentation ${pres.id}: ${err.message}`);
                }
            }

            // Barcodes adicionales
            for (const bc of prod.barcodes) {
                try {
                    await cloud.productBarcode.upsert({
                        where: { id: bc.id },
                        update: { code: bc.code, label: bc.label ?? null },
                        create: { id: bc.id, code: bc.code, label: bc.label ?? null, productId: bc.productId },
                    });
                } catch (err: any) {
                    if (err.code !== 'P2002') logger.error(`[Sync] Error push barcode ${bc.code}: ${err.message}`);
                }
            }
        }

        // ─── STEP 4: BRANCH INVENTORY (stock) ───────────────────────────────────
        logger.info('[Sync] Step 4: Pushing BranchInventory...');
        const localInventory = await localPrisma.branchInventory.findMany();
        for (const inv of localInventory) {
            try {
                await cloud.branchInventory.upsert({
                    where: { productId_branchId: { productId: inv.productId, branchId: inv.branchId } },
                    update: {
                        stock: Number(inv.stock),
                        minStock: Number(inv.minStock),
                    },
                    create: {
                        id: inv.id,
                        productId: inv.productId,
                        branchId: inv.branchId,
                        stock: Number(inv.stock),
                        minStock: Number(inv.minStock),
                    },
                });
                pushedCount++;
            } catch (err: any) {
                logger.error(`[Sync] Error push inventory ${inv.productId}@${inv.branchId}: ${err.message}`);
            }
        }

        // ─── STEP 5: USERS ──────────────────────────────────────────────────────
        logger.info('[Sync] Step 5: Pushing Users...');
        const localUsers = await localPrisma.user.findMany({ where: { isActive: true } });
        for (const user of localUsers) {
            try {
                await cloud.user.upsert({
                    where: { id: user.id },
                    update: {
                        username: user.username,
                        cedula: user.cedula,
                        cedulaType: user.cedulaType as $Enums.CedulaType,
                        nombre: user.nombre,
                        apellido: user.apellido || '',
                        email: user.email || '',
                        password: user.password,
                        telefono: user.telefono || '',
                        role: user.role as $Enums.Role,
                        branchId: user.branchId || null,
                        isActive: user.isActive,
                    },
                    create: {
                        id: user.id,
                        username: user.username,
                        cedula: user.cedula,
                        cedulaType: user.cedulaType as $Enums.CedulaType,
                        nombre: user.nombre,
                        apellido: user.apellido || '',
                        email: user.email || '',
                        password: user.password,
                        telefono: user.telefono || '',
                        role: user.role as $Enums.Role,
                        branchId: user.branchId || null,
                        isActive: user.isActive,
                    },
                });
                pushedCount++;
            } catch (err: any) {
                if (err.code === 'P2002') {
                    logger.warn(`[Sync] User ${user.username} conflicto en cloud, saltando`);
                } else {
                    logger.error(`[Sync] Error push user ${user.username}: ${err.message}`);
                }
            }
        }

        // ─── STEP 6: BRANCHES ───────────────────────────────────────────────────
        logger.info('[Sync] Step 6: Pushing Branches...');
        const localBranches = await localPrisma.branch.findMany({ where: { isActive: true } });
        for (const branch of localBranches) {
            try {
                const branchCode = branch.code || `SEDE-${branch.id.slice(-6).toUpperCase()}`;
                await cloud.branch.upsert({
                    where: { id: branch.id },
                    update: {
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive,
                    },
                    create: {
                        id: branch.id,
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive,
                    },
                });
                pushedCount++;
            } catch (err: any) {
                logger.error(`[Sync] Error push branch ${branch.name}: ${err.message}`);
            }
        }

        // ─── STEP 7: EXCHANGE RATES ─────────────────────────────────────────────
        logger.info('[Sync] Step 7: Pushing ExchangeRates...');
        const localRates = await localPrisma.exchangeRate.findMany();
        for (const rate of localRates) {
            try {
                await cloud.exchangeRate.upsert({
                    where: { id: rate.id },
                    update: { rate: Number(rate.rate) },
                    create: { id: rate.id, code: rate.code, rate: Number(rate.rate) },
                });
                pushedCount++;
            } catch (err: any) {
                if (err.code !== 'P2002') logger.error(`[Sync] Error push rate ${rate.code}: ${err.message}`);
            }
        }

        // ─── STEP 8: CASH REGISTERS (cerrados y pendientes) ────────────────────
        logger.info('[Sync] Step 8: Pushing Cash Registers...');
        const pendingRegisters = await localPrisma.cashRegister.findMany({
            where: { syncStatus: 'PENDING', status: 'CLOSED' },
        });

        if (pendingRegisters.length === 0) {
            logger.info('[Sync] No hay cajas cerradas pendientes de sync');
        }

        for (const reg of pendingRegisters) {
            try {
                await cloud.cashRegister.upsert({
                    where: { id: reg.id },
                    update: {
                        status: reg.status as $Enums.CashRegisterStatus,
                        openingAmount: Number(reg.openingAmount),
                        closingAmount: reg.closingAmount != null ? Number(reg.closingAmount) : null,
                        expectedAmount: reg.expectedAmount != null ? Number(reg.expectedAmount) : null,
                        difference: reg.difference != null ? Number(reg.difference) : null,
                        notes: reg.notes ?? null,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt ?? null,
                        userId: reg.userId,
                        branchId: reg.branchId,
                        syncStatus: 'SYNCED',
                    },
                    create: {
                        id: reg.id,
                        status: reg.status as $Enums.CashRegisterStatus,
                        openingAmount: Number(reg.openingAmount),
                        closingAmount: reg.closingAmount != null ? Number(reg.closingAmount) : null,
                        expectedAmount: reg.expectedAmount != null ? Number(reg.expectedAmount) : null,
                        difference: reg.difference != null ? Number(reg.difference) : null,
                        notes: reg.notes ?? null,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt ?? null,
                        userId: reg.userId,
                        branchId: reg.branchId,
                        syncStatus: 'SYNCED',
                    },
                });
                await localPrisma.cashRegister.update({
                    where: { id: reg.id },
                    data: { syncStatus: 'SYNCED', syncedAt: new Date() },
                });
                logger.info(`[Sync] CashRegister subido: ${reg.id}`);
                pushedCount++;
            } catch (err: any) {
                logger.error(`[Sync] Error push cashRegister ${reg.id}: ${err.message}`);
                await localPrisma.cashRegister.update({
                    where: { id: reg.id },
                    data: { syncStatus: 'FAILED' },
                }).catch(() => {});
            }
        }

        // ─── STEP 9: TRANSACTIONS + ITEMS ───────────────────────────────────────
        logger.info('[Sync] Step 9: Pushing Transactions...');
        const pendingTxs = await localPrisma.transaction.findMany({
            where: { syncStatus: 'PENDING' },
            include: { items: true },
            orderBy: { createdAt: 'asc' },
        });

        if (pendingTxs.length === 0) {
            logger.info('[Sync] No hay transacciones pendientes de sync');
        }

        for (const tx of pendingTxs) {
            try {
                await cloud.transaction.upsert({
                    where: { id: tx.id },
                    update: {
                        type: tx.type as $Enums.TransactionType,
                        status: tx.status as $Enums.TransactionStatus,
                        total: Number(tx.total),
                        notes: tx.notes ?? null,
                        ipAddress: tx.ipAddress ?? null,
                        currency: (tx as any).currency ?? 'COP',
                        exchangeRate: (tx as any).exchangeRate != null ? Number((tx as any).exchangeRate) : null,
                        invoiceNumber: (tx as any).invoiceNumber ?? null,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId ?? null,
                        syncStatus: 'SYNCED',
                        syncedAt: new Date(),
                    },
                    create: {
                        id: tx.id,
                        type: tx.type as $Enums.TransactionType,
                        status: tx.status as $Enums.TransactionStatus,
                        total: Number(tx.total),
                        notes: tx.notes ?? null,
                        ipAddress: tx.ipAddress ?? null,
                        currency: (tx as any).currency ?? 'COP',
                        exchangeRate: (tx as any).exchangeRate != null ? Number((tx as any).exchangeRate) : null,
                        invoiceNumber: (tx as any).invoiceNumber ?? null,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId ?? null,
                        syncStatus: 'SYNCED',
                        syncedAt: new Date(),
                    },
                });

                for (const item of tx.items) {
                    try {
                        await cloud.transactionItem.upsert({
                            where: { id: item.id },
                            update: {
                                quantity: Number(item.quantity),
                                multiplierUsed: Number(item.multiplierUsed),
                                unitPrice: Number(item.unitPrice),
                                subtotal: Number(item.subtotal),
                                productId: item.productId,
                                presentationId: item.presentationId ?? null,
                            },
                            create: {
                                id: item.id,
                                transactionId: item.transactionId,
                                productId: item.productId,
                                presentationId: item.presentationId ?? null,
                                quantity: Number(item.quantity),
                                multiplierUsed: Number(item.multiplierUsed),
                                unitPrice: Number(item.unitPrice),
                                subtotal: Number(item.subtotal),
                            },
                        });
                    } catch (itemErr: any) {
                        logger.error(`[Sync] Error push item ${item.id}: ${itemErr.message}`);
                    }
                }

                await localPrisma.transaction.update({
                    where: { id: tx.id },
                    data: { syncStatus: 'SYNCED', syncedAt: new Date() },
                });
                logger.info(`[Sync] Transaction subida: ${tx.id} (${tx.items.length} items)`);
                pushedCount++;
            } catch (err: any) {
                logger.error(`[Sync] Error push transaction ${tx.id}: ${err.message}`);
                await localPrisma.transaction.update({
                    where: { id: tx.id },
                    data: { syncStatus: 'FAILED' },
                }).catch(() => {});
            }
        }

        logger.info(`[Sync] Push completado — ${pushedCount} registros subidos`);
        return { success: true, pushedItems: pushedCount };

    } catch (error: any) {
        logger.error('[Sync] Error crítico en Push:', error.message);
        return { success: false, error: error.message };
    }
}