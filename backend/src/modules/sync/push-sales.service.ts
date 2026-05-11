import { getCloudPrisma, getLocalPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';
import { $Enums } from '@prisma/client';

// =============================================================================
// PUSH — Local SQLite → Supabase Cloud (Hub)
//
// Orden topológico (respeta FKs de cloud):
//   1. Branches         (sin deps)
//   2. Groups           (sin deps)
//   3. SubGroups        (→ Groups)
//   4. Products         (→ SubGroups)
//   5. Presentations    (→ Products)    — reconciliar por barcode
//   6. Barcodes         (→ Products)    — reconciliar por code
//   7. Users            (→ Branches)    — reconciliar por username
//   8. ExchangeRates    (sin deps)      — reconciliar por code
//   9. BranchInventory  (→ Products, Branches)
//  10. CashRegisters    (→ Users, Branches) — solo PENDING
//  11. Transactions     (→ Users, Branches, CashRegisters) — solo PENDING
//  12. Mermas           (→ Users, Branches, Products) — solo PENDING
//  13. StockCounts      (→ Users, Branches) — solo PENDING
// =============================================================================

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

        // ─── STEP 1: BRANCHES ──────────────────────────────────────────────────
        logger.info('[Sync] Step 1: Pushing Branches...');
        const localBranches = await localPrisma.branch.findMany({ where: { isActive: true } });
        for (const branch of localBranches) {
            try {
                const branchCode = branch.code || `SEDE-${branch.id.slice(-6).toUpperCase()}`;
                // Reconciliar por code (unique en cloud)
                const existingByCode = branchCode
                    ? await cloud.branch.findFirst({ where: { code: branchCode } })
                    : null;

                if (existingByCode) {
                    await cloud.branch.update({
                        where: { id: existingByCode.id },
                        data: {
                            name: branch.name,
                            code: branchCode,
                            address: branch.address || '',
                            phone: branch.phone || '',
                            isActive: branch.isActive,
                        },
                    });
                } else {
                    await cloud.branch.create({
                        data: {
                            id: branch.id,
                            name: branch.name,
                            code: branchCode,
                            address: branch.address || '',
                            phone: branch.phone || '',
                            isActive: branch.isActive,
                        },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Branch ${branch.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 2: GROUPS ────────────────────────────────────────────────────
        logger.info('[Sync] Step 2: Pushing Groups...');
        const localGroups = await localPrisma.group.findMany();
        for (const group of localGroups) {
            try {
                // Reconciliar por name (unique)
                const existingByName = await cloud.group.findFirst({ where: { name: group.name } });
                if (existingByName) {
                    await cloud.group.update({
                        where: { id: existingByName.id },
                        data: { name: group.name, description: group.description ?? null },
                    });
                } else {
                    await cloud.group.create({
                        data: { id: group.id, name: group.name, description: group.description ?? null },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Group ${group.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 3: SUBGROUPS ─────────────────────────────────────────────────
        logger.info('[Sync] Step 3: Pushing SubGroups...');
        const localSubGroups = await localPrisma.subGroup.findMany();
        for (const sg of localSubGroups) {
            try {
                // Reconciliar por compound unique [name, groupId]
                const existingBySg = await cloud.subGroup.findFirst({
                    where: { name: sg.name, groupId: sg.groupId },
                });
                if (existingBySg) {
                    await cloud.subGroup.update({
                        where: { id: existingBySg.id },
                        data: { name: sg.name, groupId: sg.groupId },
                    });
                } else {
                    // Verificar que el grupo existe en cloud antes de crear
                    const groupExists = await cloud.group.findUnique({
                        where: { id: sg.groupId }, select: { id: true },
                    });
                    if (!groupExists) continue;

                    await cloud.subGroup.create({
                        data: { id: sg.id, name: sg.name, groupId: sg.groupId },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] SubGroup ${sg.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 4: PRODUCTS ──────────────────────────────────────────────────
        logger.info('[Sync] Step 4: Pushing Products...');
        const localProducts = await localPrisma.product.findMany({
            include: { presentations: true, barcodes: true },
        });
        for (const prod of localProducts) {
            try {
                // Producto: reconciliar por barcode si existe, sino por id
                let existingProd = prod.barcode
                    ? await cloud.product.findFirst({ where: { barcode: prod.barcode } })
                    : await cloud.product.findUnique({ where: { id: prod.id } });

                const prodData = {
                    name: prod.name,
                    description: prod.description ?? null,
                    barcode: prod.barcode ?? null,
                    price: Number(prod.price),
                    cost: prod.cost != null ? Number(prod.cost) : null,
                    baseUnit: prod.baseUnit,
                    imageUrl: prod.imageUrl ?? null,
                    isActive: prod.isActive,
                    subGroupId: prod.subGroupId ?? null,
                    expectedSpoilagePercent: prod.expectedSpoilagePercent != null
                        ? Number(prod.expectedSpoilagePercent) : null,
                };

                if (existingProd) {
                    await cloud.product.update({
                        where: { id: existingProd.id },
                        data: prodData,
                    });
                } else {
                    await cloud.product.create({
                        data: { id: prod.id, ...prodData },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Product ${prod.name} skip: ${err.message?.slice(0, 100)}`);
                continue; // Si falla el producto, no procesar sus presentaciones
            }

            // ── Step 5: Presentations ──────────────────────────────────────────
            for (const pres of prod.presentations) {
                try {
                    // Reconciliar por barcode si tiene, sino por id
                    let existingPres = pres.barcode
                        ? await cloud.productPresentation.findFirst({ where: { barcode: pres.barcode } })
                        : await cloud.productPresentation.findUnique({ where: { id: pres.id } });

                    if (existingPres) {
                        await cloud.productPresentation.update({
                            where: { id: existingPres.id },
                            data: {
                                name: pres.name,
                                multiplier: Number(pres.multiplier),
                                price: Number(pres.price),
                                barcode: pres.barcode ?? null,
                            },
                        });
                    } else {
                        await cloud.productPresentation.create({
                            data: {
                                id: pres.id,
                                name: pres.name,
                                multiplier: Number(pres.multiplier),
                                price: Number(pres.price),
                                barcode: pres.barcode ?? null,
                                productId: pres.productId,
                            },
                        });
                    }
                } catch (err: any) {
                    logger.warn(`[Sync] Presentation ${pres.name} skip: ${err.message?.slice(0, 100)}`);
                }
            }

            // ── Step 6: Barcodes ───────────────────────────────────────────────
            for (const bc of prod.barcodes) {
                try {
                    // Reconciliar por code (unique)
                    const existingBc = await cloud.productBarcode.findFirst({ where: { code: bc.code } });
                    if (existingBc) {
                        await cloud.productBarcode.update({
                            where: { id: existingBc.id },
                            data: { code: bc.code, label: bc.label ?? null },
                        });
                    } else {
                        await cloud.productBarcode.create({
                            data: { id: bc.id, code: bc.code, label: bc.label ?? null, productId: bc.productId },
                        });
                    }
                } catch (err: any) {
                    logger.warn(`[Sync] Barcode ${bc.code} skip: ${err.message?.slice(0, 100)}`);
                }
            }
        }

        // ─── STEP 7: USERS ────────────────────────────────────────────────────
        logger.info('[Sync] Step 7: Pushing Users...');
        const localUsers = await localPrisma.user.findMany({ where: { isActive: true } });
        for (const user of localUsers) {
            try {
                // Reconciliar por username (unique)
                const existingUser = await cloud.user.findFirst({ where: { username: user.username } });
                const userData = {
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
                    canManageInventory: user.canManageInventory,
                };

                if (existingUser) {
                    await cloud.user.update({
                        where: { id: existingUser.id },
                        data: userData,
                    });
                } else {
                    await cloud.user.create({
                        data: { id: user.id, ...userData },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] User ${user.username} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 8: EXCHANGE RATES ────────────────────────────────────────────
        logger.info('[Sync] Step 8: Pushing ExchangeRates...');
        const localRates = await localPrisma.exchangeRate.findMany();
        for (const rate of localRates) {
            try {
                // Reconciliar por code (unique)
                const existingRate = await cloud.exchangeRate.findFirst({ where: { code: rate.code } });
                if (existingRate) {
                    await cloud.exchangeRate.update({
                        where: { id: existingRate.id },
                        data: { rate: Number(rate.rate) },
                    });
                } else {
                    await cloud.exchangeRate.create({
                        data: { id: rate.id, code: rate.code, rate: Number(rate.rate) },
                    });
                }
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Rate ${rate.code} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 9: BRANCH INVENTORY ──────────────────────────────────────────
        logger.info('[Sync] Step 9: Pushing BranchInventory...');
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
                logger.warn(`[Sync] Inventory ${inv.productId}@${inv.branchId} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 10: CASH REGISTERS (cerrados y pendientes) ───────────────────
        logger.info('[Sync] Step 10: Pushing CashRegisters...');
        const pendingRegisters = await localPrisma.cashRegister.findMany({
            where: { syncStatus: 'PENDING', status: 'CLOSED' },
        });

        if (pendingRegisters.length === 0) {
            logger.info('[Sync] No hay cajas cerradas pendientes de sync');
        }

        for (const reg of pendingRegisters) {
            try {
                // Verificar FKs en cloud antes de push
                const [userInCloud, branchInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: reg.userId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: reg.branchId }, select: { id: true } }),
                ]);
                if (!userInCloud || !branchInCloud) {
                    logger.warn(`[Sync] CashRegister ${reg.id} skip: FK faltante en cloud (user=${!!userInCloud}, branch=${!!branchInCloud})`);
                    continue;
                }

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
                logger.error(`[Sync] Error push cashRegister ${reg.id}: ${err.message?.slice(0, 120)}`);
                await localPrisma.cashRegister.update({
                    where: { id: reg.id },
                    data: { syncStatus: 'FAILED' },
                }).catch(() => {});
            }
        }

        // ─── STEP 11: TRANSACTIONS + ITEMS ─────────────────────────────────────
        logger.info('[Sync] Step 11: Pushing Transactions...');
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
                // Verificar FKs en cloud
                const [userInCloud, branchInCloud, cashRegInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: tx.userId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: tx.branchId }, select: { id: true } }),
                    tx.cashRegisterId
                        ? cloud.cashRegister.findUnique({ where: { id: tx.cashRegisterId }, select: { id: true } })
                        : Promise.resolve(true),
                ]);
                if (!userInCloud || !branchInCloud || !cashRegInCloud) {
                    logger.warn(`[Sync] Tx ${tx.id} skip: FK faltante en cloud`);
                    continue;
                }

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
                        logger.warn(`[Sync] TxItem ${item.id} skip: ${(itemErr as Error).message?.slice(0, 80)}`);
                    }
                }

                await localPrisma.transaction.update({
                    where: { id: tx.id },
                    data: { syncStatus: 'SYNCED', syncedAt: new Date() },
                });
                logger.info(`[Sync] Transaction subida: ${tx.id} (${tx.items.length} items)`);
                pushedCount++;
            } catch (err: any) {
                logger.error(`[Sync] Error push transaction ${tx.id}: ${err.message?.slice(0, 120)}`);
                await localPrisma.transaction.update({
                    where: { id: tx.id },
                    data: { syncStatus: 'FAILED' },
                }).catch(() => {});
            }
        }

        // ─── STEP 12: MERMAS ───────────────────────────────────────────────────
        logger.info('[Sync] Step 12: Pushing Mermas...');
        const pendingMermas = await localPrisma.merma.findMany({
            where: { syncStatus: 'PENDING' },
        });

        if (pendingMermas.length === 0) {
            logger.info('[Sync] No hay mermas pendientes de sync');
        }

        for (const merma of pendingMermas) {
            try {
                // Verificar FKs en cloud
                const [userInCloud, branchInCloud, productInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: merma.createdById }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: merma.branchId }, select: { id: true } }),
                    cloud.product.findFirst({ where: { id: merma.productId }, select: { id: true } }),
                ]);
                if (!userInCloud || !branchInCloud || !productInCloud) {
                    logger.warn(`[Sync] Merma ${merma.id} skip: FK faltante en cloud`);
                    continue;
                }

                await cloud.merma.upsert({
                    where: { id: merma.id },
                    update: {
                        quantity: Number(merma.quantity),
                        reason: merma.reason as $Enums.MermaReason,
                        description: merma.description ?? null,
                        syncStatus: 'SYNCED',
                    },
                    create: {
                        id: merma.id,
                        branchId: merma.branchId,
                        productId: merma.productId,
                        createdById: merma.createdById,
                        quantity: Number(merma.quantity),
                        reason: merma.reason as $Enums.MermaReason,
                        description: merma.description ?? null,
                        createdAt: merma.createdAt,
                        syncStatus: 'SYNCED',
                    },
                });
                await localPrisma.merma.update({
                    where: { id: merma.id },
                    data: { syncStatus: 'SYNCED' },
                });
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Merma ${merma.id} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 13: STOCK COUNTS ─────────────────────────────────────────────
        logger.info('[Sync] Step 13: Pushing StockCounts...');
        const pendingCounts = await localPrisma.stockCount.findMany({
            where: { syncStatus: 'PENDING', status: 'COMPLETED' },
            include: { items: true },
        });

        if (pendingCounts.length === 0) {
            logger.info('[Sync] No hay conteos pendientes de sync');
        }

        for (const count of pendingCounts) {
            try {
                // Verificar FKs
                const [userInCloud, branchInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: count.createdById }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: count.branchId }, select: { id: true } }),
                ]);
                if (!userInCloud || !branchInCloud) {
                    logger.warn(`[Sync] StockCount ${count.id} skip: FK faltante en cloud`);
                    continue;
                }

                await cloud.stockCount.upsert({
                    where: { id: count.id },
                    update: {
                        status: count.status as $Enums.StockCountStatus,
                        notes: count.notes ?? null,
                        completedAt: count.completedAt ?? null,
                        syncStatus: 'SYNCED',
                    },
                    create: {
                        id: count.id,
                        branchId: count.branchId,
                        createdById: count.createdById,
                        status: count.status as $Enums.StockCountStatus,
                        notes: count.notes ?? null,
                        createdAt: count.createdAt,
                        completedAt: count.completedAt ?? null,
                        syncStatus: 'SYNCED',
                    },
                });

                for (const item of count.items) {
                    try {
                        await cloud.stockCountItem.upsert({
                            where: { id: item.id },
                            update: {
                                expectedStock: Number(item.expectedStock),
                                countedStock: Number(item.countedStock),
                                difference: Number(item.difference),
                            },
                            create: {
                                id: item.id,
                                stockCountId: item.stockCountId,
                                productId: item.productId,
                                expectedStock: Number(item.expectedStock),
                                countedStock: Number(item.countedStock),
                                difference: Number(item.difference),
                            },
                        });
                    } catch (err: any) {
                        logger.warn(`[Sync] StockCountItem ${item.id} skip: ${err.message?.slice(0, 80)}`);
                    }
                }

                await localPrisma.stockCount.update({
                    where: { id: count.id },
                    data: { syncStatus: 'SYNCED' },
                });
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] StockCount ${count.id} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 14: PRODUCT BATCHES (LOTES) ───────────────────────────────────
        logger.info('[Sync] Step 14: Pushing Product Batches...');
        const allBatches = await localPrisma.productBatch.findMany();

        for (const batch of allBatches) {
            try {
                // Verificar FKs
                const [productInCloud, branchInCloud] = await Promise.all([
                    cloud.product.findUnique({ where: { id: batch.productId }, select: { id: true } }),
                    cloud.branch.findUnique({ where: { id: batch.branchId }, select: { id: true } }),
                ]);
                if (!productInCloud || !branchInCloud) continue;

                await cloud.productBatch.upsert({
                    where: { id: batch.id },
                    update: {
                        batchCode: batch.batchCode,
                        quantity: Number(batch.quantity),
                        costPrice: batch.costPrice ? Number(batch.costPrice) : null,
                        expiryDate: batch.expiryDate,
                    },
                    create: {
                        id: batch.id,
                        batchCode: batch.batchCode,
                        productId: batch.productId,
                        branchId: batch.branchId,
                        quantity: Number(batch.quantity),
                        costPrice: batch.costPrice ? Number(batch.costPrice) : null,
                        expiryDate: batch.expiryDate,
                    },
                });
                pushedCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Batch ${batch.id} skip: ${err.message?.slice(0, 80)}`);
            }
        }

        logger.info(`[Sync] Push completado — ${pushedCount} registros subidos`);
        return { success: true, pushedItems: pushedCount };

    } catch (error: any) {
        logger.error('[Sync] Error crítico en Push:', error.message);
        return { success: false, error: error.message };
    }
}