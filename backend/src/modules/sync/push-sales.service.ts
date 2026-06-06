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

        // ─── MAPAS DE TRADUCCIÓN DE IDs (localId -> cloudId) ───────────────────
        const cloudUsers = await cloud.user.findMany({ select: { id: true, username: true } });
        const localUsersForMap = await localPrisma.user.findMany({ select: { id: true, username: true } });
        const userMap = new Map<string, string>(); // localUserId -> cloudUserId
        for (const lu of localUsersForMap) {
            const cu = cloudUsers.find(u => u.username === lu.username);
            if (cu) userMap.set(lu.id, cu.id);
        }

        const cloudBranches = await cloud.branch.findMany({ select: { id: true, code: true, name: true } });
        const localBranchesForMap = await localPrisma.branch.findMany({ select: { id: true, code: true, name: true } });
        const branchMap = new Map<string, string>(); // localBranchId -> cloudBranchId
        for (const lb of localBranchesForMap) {
            const cb = cloudBranches.find(b => b.code === lb.code || b.name === lb.name);
            if (cb) branchMap.set(lb.id, cb.id);
        }

        // ─── STEP 1: BRANCHES (batch por code) ──────────────────────────────────
        logger.info('[Sync] Step 1: Pushing Branches...');
        const localBranches = await localPrisma.branch.findMany({ where: { isActive: true } });
        const branchCodes = localBranches.map(b => b.code || `SEDE-${b.id.slice(-6).toUpperCase()}`);
        const cloudBranchesByCode = new Map(
            branchCodes.length > 0
                ? (await cloud.branch.findMany({ where: { code: { in: branchCodes } } })).map(b => [b.code, b])
                : []
        );
        for (const branch of localBranches) {
            try {
                const branchCode = branch.code || `SEDE-${branch.id.slice(-6).toUpperCase()}`;
                const existingByCode = cloudBranchesByCode.get(branchCode) || null;

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

        // ─── STEP 2: GROUPS (batch por name) ────────────────────────────────────
        logger.info('[Sync] Step 2: Pushing Groups...');
        const localGroups = await localPrisma.group.findMany();
        const cloudGroupsByName = new Map(
            localGroups.length > 0
                ? (await cloud.group.findMany({ where: { name: { in: localGroups.map(g => g.name) } } })).map(g => [g.name, g])
                : []
        );
        for (const group of localGroups) {
            try {
                const existingByName = cloudGroupsByName.get(group.name) || null;
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

        // ─── STEP 3: SUBGROUPS (batch por compound key name+groupId) ────────────
        logger.info('[Sync] Step 3: Pushing SubGroups...');
        const localSubGroups = await localPrisma.subGroup.findMany();
        // Batch fetch: necesitamos traer todos los subgrupos que coincidan (name, groupId)
        const cloudSubGroupsByKey = new Map<string, any>();
        if (localSubGroups.length > 0) {
            // Traer todos los subgrupos del grupo y filtrar en memoria por name
            const groupIds = [...new Set(localSubGroups.map(sg => sg.groupId))];
            const allCloudSgs = await cloud.subGroup.findMany({ where: { groupId: { in: groupIds } } });
            for (const csg of allCloudSgs) {
                cloudSubGroupsByKey.set(`${csg.name}::${csg.groupId}`, csg);
            }
        }
        for (const sg of localSubGroups) {
            try {
                const key = `${sg.name}::${sg.groupId}`;
                const existingBySg = cloudSubGroupsByKey.get(key) || null;
                if (existingBySg) {
                    await cloud.subGroup.update({
                        where: { id: existingBySg.id },
                        data: { name: sg.name, groupId: sg.groupId },
                    });
                } else {
                    const groupExists = cloudGroupsByName.get(sg.groupId) // ya batch-eamos groups
                        ?? await cloud.group.findUnique({ where: { id: sg.groupId }, select: { id: true } });
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

        // ─── STEP 4: PRODUCTS (batch por barcode + id) ─────────────────────────
        logger.info('[Sync] Step 4: Pushing Products...');
        const localProducts = await localPrisma.product.findMany({
            include: { presentations: true, barcodes: true },
        });

        // Batch 1: reconciliar productos con barcode
        const prodByBarcode = new Map<string, any>();
        const prodById = new Map<string, any>();
        const barcodes = localProducts.map(p => p.barcode).filter(Boolean) as string[];
        if (barcodes.length > 0) {
            const cloudProds = await cloud.product.findMany({ where: { barcode: { in: barcodes } } });
            for (const cp of cloudProds) {
                if (cp.barcode) prodByBarcode.set(cp.barcode, cp);
            }
        }
        // Batch 2: productos restantes (sin barcode o no encontrados) por id
        const idsToFetch = localProducts
            .filter(p => !p.barcode || !prodByBarcode.has(p.barcode))
            .map(p => p.id);
        if (idsToFetch.length > 0) {
            const cloudProds = await cloud.product.findMany({ where: { id: { in: idsToFetch } } });
            for (const cp of cloudProds) prodById.set(cp.id, cp);
        }

        // Batch: presentations y barcodes de cloud para lookup rápido
        let cloudPresByBarcode = new Map<string, any>();
        let cloudPresById = new Map<string, any>();
        const allPresBarcodes = localProducts.flatMap(p => p.presentations.map(pr => pr.barcode).filter(Boolean)) as string[];
        if (allPresBarcodes.length > 0) {
            const cloudPres = await cloud.productPresentation.findMany({ where: { barcode: { in: allPresBarcodes } } });
            for (const cp of cloudPres) {
                if (cp.barcode) cloudPresByBarcode.set(cp.barcode, cp);
                cloudPresById.set(cp.id, cp);
            }
        }
        // Si quedan presentations sin barcode, traerlas por id
        const presIdsToFetch = localProducts
            .flatMap(p => p.presentations)
            .filter(pr => !pr.barcode && !cloudPresById.has(pr.id))
            .map(pr => pr.id);
        if (presIdsToFetch.length > 0) {
            const cloudPres = await cloud.productPresentation.findMany({ where: { id: { in: presIdsToFetch } } });
            for (const cp of cloudPres) cloudPresById.set(cp.id, cp);
            // Reemplazar el map combinado para lookup eficiente
        }

        const cloudBcByCode = new Map<string, any>();
        const allBcCodes = localProducts.flatMap(p => p.barcodes.map(b => b.code));
        if (allBcCodes.length > 0) {
            const cloudBcs = await cloud.productBarcode.findMany({ where: { code: { in: allBcCodes } } });
            for (const cb of cloudBcs) cloudBcByCode.set(cb.code, cb);
        }

        for (const prod of localProducts) {
            try {
                const existingProd = prod.barcode
                    ? (prodByBarcode.get(prod.barcode) ?? null)
                    : (prodById.get(prod.id) ?? null);

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
                continue;
            }

            // ── Step 5: Presentations (batch lookup) ──────────────────────────
            for (const pres of prod.presentations) {
                try {
                    const existingPres = pres.barcode
                        ? (cloudPresByBarcode.get(pres.barcode) ?? cloudPresById.get(pres.id) ?? null)
                        : (cloudPresById.get(pres.id) ?? null);

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

            // ── Step 6: Barcodes (batch lookup) ───────────────────────────────
            for (const bc of prod.barcodes) {
                try {
                    const existingBc = cloudBcByCode.get(bc.code) ?? null;
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

        // ─── STEP 7: USERS (batch por username) ────────────────────────────────
        logger.info('[Sync] Step 7: Pushing Users...');
        const localUsers = await localPrisma.user.findMany({ where: { isActive: true } });
        const cloudUsersByUsername = new Map(
            cloudUsers.length > 0
                ? (await cloud.user.findMany({ where: { username: { in: localUsers.map(u => u.username) } } })).map(u => [u.username, u])
                : []
        );
        for (const user of localUsers) {
            try {
                const existingUser = cloudUsersByUsername.get(user.username) ?? null;
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
                    branchId: user.branchId ? branchMap.get(user.branchId) : null,
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

        // ─── STEP 8: EXCHANGE RATES (batch por code) ────────────────────────────
        logger.info('[Sync] Step 8: Pushing ExchangeRates...');
        const localRates = await localPrisma.exchangeRate.findMany();
        const cloudRatesByCode = new Map(
            localRates.length > 0
                ? (await cloud.exchangeRate.findMany({ where: { code: { in: localRates.map(r => r.code) } } })).map(r => [r.code, r])
                : []
        );
        for (const rate of localRates) {
            try {
                const existingRate = cloudRatesByCode.get(rate.code) ?? null;
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
                const cloudBranchId = branchMap.get(inv.branchId);
                if (!cloudBranchId) continue;

                await cloud.branchInventory.upsert({
                    where: { productId_branchId: { productId: inv.productId, branchId: cloudBranchId } },
                    update: {
                        stock: Number(inv.stock),
                        minStock: Number(inv.minStock),
                    },
                    create: {
                        id: inv.id,
                        productId: inv.productId,
                        branchId: cloudBranchId,
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
                // Traducir IDs de local a cloud
                const cloudUserId = userMap.get(reg.userId);
                const cloudBranchId = branchMap.get(reg.branchId);
                if (!cloudUserId || !cloudBranchId) {
                    logger.warn(`[Sync] CashRegister ${reg.id} skip: FK translation failed (user=${!!cloudUserId}, branch=${!!cloudBranchId})`);
                    continue;
                }

                // Verificar FKs en cloud antes de push
                const [userInCloud, branchInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: cloudUserId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: cloudBranchId }, select: { id: true } }),
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
                        userId: cloudUserId,
                        branchId: cloudBranchId,
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
                        userId: cloudUserId,
                        branchId: cloudBranchId,
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
                // Traducir IDs de local a cloud
                const cloudUserId = userMap.get(tx.userId);
                const cloudBranchId = branchMap.get(tx.branchId);
                if (!cloudUserId || !cloudBranchId) {
                    logger.warn(`[Sync] Tx ${tx.id} skip: FK translation failed (user=${!!cloudUserId}, branch=${!!cloudBranchId})`);
                    continue;
                }

                // Verificar FKs en cloud
                const [userInCloud, branchInCloud, cashRegInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: cloudUserId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: cloudBranchId }, select: { id: true } }),
                    tx.cashRegisterId
                        ? cloud.cashRegister.findUnique({ where: { id: tx.cashRegisterId }, select: { id: true } })
                        : Promise.resolve(true),
                ]);
                if (!userInCloud || !branchInCloud || !cashRegInCloud) {
                    logger.warn(`[Sync] Tx ${tx.id} skip: FK faltante en cloud (user=${!!userInCloud}, branch=${!!branchInCloud}, cashReg=${!!cashRegInCloud})`);
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
                        paymentMethods: (tx as any).paymentMethods ?? null,
                        createdAt: tx.createdAt,
                        userId: cloudUserId,
                        branchId: cloudBranchId,
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
                        paymentMethods: (tx as any).paymentMethods ?? null,
                        createdAt: tx.createdAt,
                        userId: cloudUserId,
                        branchId: cloudBranchId,
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
                // Traducir IDs de local a cloud
                const cloudUserId = userMap.get(merma.createdById);
                const cloudBranchId = branchMap.get(merma.branchId);
                if (!cloudUserId || !cloudBranchId) {
                    logger.warn(`[Sync] Merma ${merma.id} skip: FK translation failed (user=${!!cloudUserId}, branch=${!!cloudBranchId})`);
                    continue;
                }

                // Verificar FKs en cloud
                const [userInCloud, branchInCloud, productInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: cloudUserId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: cloudBranchId }, select: { id: true } }),
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
                        branchId: cloudBranchId,
                        productId: merma.productId,
                        createdById: cloudUserId,
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
                // Traducir IDs de local a cloud
                const cloudUserId = userMap.get(count.createdById);
                const cloudBranchId = branchMap.get(count.branchId);
                if (!cloudUserId || !cloudBranchId) {
                    logger.warn(`[Sync] StockCount ${count.id} skip: FK translation failed (user=${!!cloudUserId}, branch=${!!cloudBranchId})`);
                    continue;
                }

                // Verificar FKs
                const [userInCloud, branchInCloud] = await Promise.all([
                    cloud.user.findFirst({ where: { id: cloudUserId }, select: { id: true } }),
                    cloud.branch.findFirst({ where: { id: cloudBranchId }, select: { id: true } }),
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
                        branchId: cloudBranchId,
                        createdById: cloudUserId,
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
                // Traducir IDs locales a cloud
                const cloudBranchId = branchMap.get(batch.branchId);
                if (!cloudBranchId) continue;

                // Verificar FKs
                const [productInCloud, branchInCloud] = await Promise.all([
                    cloud.product.findUnique({ where: { id: batch.productId }, select: { id: true } }),
                    cloud.branch.findUnique({ where: { id: cloudBranchId }, select: { id: true } }),
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
                        branchId: cloudBranchId,
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