import { prismaCloud, getLocalPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

// =============================================================================
// PULL — Supabase Cloud (Hub) → Local SQLite
//
// Orden topológico (respeta FKs de SQLite local):
//   1. Branches         (sin deps)
//   2. Groups           (sin deps)
//   3. SubGroups        (→ Groups)
//   4. Products         (→ SubGroups)
//   5. Presentations    (→ Products)    — reconciliar por barcode
//   6. Barcodes         (→ Products)    — reconciliar por code
//   7. Users            (→ Branches)    — reconciliar por username
//   8. ExchangeRates    (sin deps)      — reconciliar por code
//   9. CashRegisters    (→ Users, Branches)
//  10. Transactions     (→ Users, Branches, CashRegisters) — solo SYNCED
//  11. TransactionItems (→ Transactions, Products, Presentations)
// =============================================================================

export async function pullCatalog(): Promise<{ success: boolean; pulledItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    const cloud = prismaCloud; // lanza si no hay cloud, manejado por el llamador

    let pulledCount = 0;

    try {
        logger.info('[Sync] Iniciando Pull desde cloud...');

        // ─── STEP 1: BRANCHES (antes de Users — Users referencia branchId) ────
        logger.info('[Sync] Pull Step 1: Branches...');
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
            } catch (err: any) {
                logger.warn(`[Sync] Pull Branch ${branch.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 2: GROUPS ────────────────────────────────────────────────────
        logger.info('[Sync] Pull Step 2: Groups...');
        const cloudGroups = await cloud.group.findMany();
        for (const group of cloudGroups) {
            try {
                // Reconciliar por name (unique)
                const existingByName = await localPrisma.group.findFirst({ where: { name: group.name } });
                if (existingByName) {
                    await localPrisma.group.update({
                        where: { id: existingByName.id },
                        data: { name: group.name, description: group.description ?? undefined },
                    });
                } else {
                    await localPrisma.group.create({
                        data: { id: group.id, name: group.name, description: group.description ?? undefined },
                    });
                }
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Group ${group.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 3: SUBGROUPS ─────────────────────────────────────────────────
        logger.info('[Sync] Pull Step 3: SubGroups...');
        const cloudSubGroups = await cloud.subGroup.findMany();
        for (const sg of cloudSubGroups) {
            try {
                // Reconciliar por compound unique [name, groupId]
                const existingBySg = await localPrisma.subGroup.findFirst({
                    where: { name: sg.name, groupId: sg.groupId },
                });
                if (existingBySg) {
                    await localPrisma.subGroup.update({
                        where: { id: existingBySg.id },
                        data: { name: sg.name, groupId: sg.groupId },
                    });
                } else {
                    // Verificar FK
                    const groupExists = await localPrisma.group.findUnique({
                        where: { id: sg.groupId }, select: { id: true },
                    });
                    if (!groupExists) continue;

                    await localPrisma.subGroup.create({
                        data: { id: sg.id, name: sg.name, groupId: sg.groupId },
                    });
                }
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull SubGroup ${sg.name} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 4: PRODUCTS ──────────────────────────────────────────────────
        logger.info('[Sync] Pull Step 4: Products + Presentations + Barcodes...');
        const cloudProducts = await cloud.product.findMany({
            include: { presentations: true, barcodes: true },
        });

        for (const prod of cloudProducts) {
            try {
                // Producto: reconciliar por barcode si existe
                let existingProd = prod.barcode
                    ? await localPrisma.product.findFirst({ where: { barcode: prod.barcode } })
                    : await localPrisma.product.findUnique({ where: { id: prod.id } });

                const prodData = {
                    name: prod.name,
                    description: prod.description ?? undefined,
                    barcode: prod.barcode ?? undefined,
                    price: Number(prod.price),
                    cost: prod.cost != null ? Number(prod.cost) : undefined,
                    baseUnit: prod.baseUnit,
                    imageUrl: prod.imageUrl ?? undefined,
                    isActive: prod.isActive,
                    subGroupId: prod.subGroupId ?? undefined,
                    expectedSpoilagePercent: prod.expectedSpoilagePercent != null
                        ? Number(prod.expectedSpoilagePercent) : undefined,
                };

                if (existingProd) {
                    await localPrisma.product.update({
                        where: { id: existingProd.id },
                        data: prodData,
                    });
                } else {
                    await localPrisma.product.create({
                        data: { id: prod.id, ...prodData },
                    });
                }
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Product ${prod.name} skip: ${err.message?.slice(0, 100)}`);
            }

            // ── Step 5: Presentations ──────────────────────────────────────────
            for (const pres of prod.presentations) {
                try {
                    // Reconciliar por barcode si tiene
                    let existingPres = pres.barcode
                        ? await localPrisma.productPresentation.findFirst({ where: { barcode: pres.barcode } })
                        : await localPrisma.productPresentation.findUnique({ where: { id: pres.id } });

                    if (existingPres) {
                        await localPrisma.productPresentation.update({
                            where: { id: existingPres.id },
                            data: {
                                name: pres.name,
                                multiplier: Number(pres.multiplier),
                                price: Number(pres.price),
                                barcode: pres.barcode ?? undefined,
                            },
                        });
                    } else {
                        await localPrisma.productPresentation.create({
                            data: {
                                id: pres.id,
                                name: pres.name,
                                multiplier: Number(pres.multiplier),
                                price: Number(pres.price),
                                barcode: pres.barcode ?? undefined,
                                productId: pres.productId,
                            },
                        });
                    }
                } catch (err: any) {
                    logger.warn(`[Sync] Pull Presentation ${pres.name} skip: ${err.message?.slice(0, 100)}`);
                }
            }

            // ── Step 6: Barcodes ───────────────────────────────────────────────
            for (const bc of prod.barcodes) {
                try {
                    const existingBc = await localPrisma.productBarcode.findFirst({ where: { code: bc.code } });
                    if (existingBc) {
                        await localPrisma.productBarcode.update({
                            where: { id: existingBc.id },
                            data: { code: bc.code, label: bc.label ?? undefined },
                        });
                    } else {
                        await localPrisma.productBarcode.create({
                            data: { id: bc.id, code: bc.code, label: bc.label ?? undefined, productId: bc.productId },
                        });
                    }
                } catch (err: any) {
                    logger.warn(`[Sync] Pull Barcode ${bc.code} skip: ${err.message?.slice(0, 100)}`);
                }
            }
        }

        // ─── STEP 7: USERS ────────────────────────────────────────────────────
        // Pull TODOS los usuarios (activos e inactivos) para mantener FKs válidas.
        logger.info('[Sync] Pull Step 7: Users...');
        const cloudUsers = await cloud.user.findMany();
        for (const user of cloudUsers) {
            try {
                // 1. Verificar si el usuario existe por ID (Paridad perfecta)
                let existingUser = await localPrisma.user.findUnique({
                    where: { id: user.id },
                });

                // 2. Si no existe por ID, ver si hay choque de username
                if (!existingUser) {
                    const byUsername = await localPrisma.user.findFirst({
                        where: { username: user.username }
                    });

                    if (byUsername) {
                        logger.info(`[Sync] Resolving collision for ${user.username}: renaming old ID ${byUsername.id} and remapping to new ID ${user.id}`);
                        
                        // Renombrar temporalmente para liberar el username y permitir crear el nuevo ID
                        const tempUsername = `old_${Date.now()}_${byUsername.username}`;
                        await localPrisma.user.update({
                            where: { id: byUsername.id },
                            data: { username: tempUsername }
                        });

                        // Crear el nuevo usuario con el ID correcto de la nube
                        await localPrisma.user.create({
                            data: { 
                                id: user.id,
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
                            }
                        });

                        // Remapear relaciones del viejo al nuevo
                        await localPrisma.$transaction([
                            localPrisma.transaction.updateMany({ where: { userId: byUsername.id }, data: { userId: user.id } }),
                            localPrisma.cashRegister.updateMany({ where: { userId: byUsername.id }, data: { userId: user.id } }),
                            localPrisma.auditLog.updateMany({ where: { userId: byUsername.id }, data: { userId: user.id } }),
                            localPrisma.merma.updateMany({ where: { createdById: byUsername.id }, data: { createdById: user.id } }),
                            localPrisma.stockCount.updateMany({ where: { createdById: byUsername.id }, data: { createdById: user.id } }),
                        ]);

                        // Ahora sí borrar el viejo (ya no tiene FKs activas)
                        await localPrisma.user.delete({ where: { id: byUsername.id } });
                        pulledCount++;
                        continue; // Ya terminamos con este usuario
                    }
                }

                // 3. Flujo normal (Actualizar o Crear si no hubo colisión)
                const userData = {
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
                };

                if (existingUser) {
                    await localPrisma.user.update({
                        where: { id: existingUser.id },
                        data: userData,
                    });
                } else {
                    await localPrisma.user.create({
                        data: { id: user.id, ...userData },
                    });
                }
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull User ${user.username} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── BUILD ID MAPS (cloudId → localId) ─────────────────────────────────
        // El seed local genera CUIDs distintos a cloud. Las transacciones en cloud
        // referencian IDs de cloud, pero localmente el user/branch tiene otro ID.
        // Construimos un mapa para traducir al hacer pull de datos operativos.
        const userIdMap = new Map<string, string>(); // cloudUserId → localUserId
        for (const cloudUser of cloudUsers) {
            const localUser = await localPrisma.user.findFirst({
                where: { username: cloudUser.username }, select: { id: true },
            });
            if (localUser && localUser.id !== cloudUser.id) {
                userIdMap.set(cloudUser.id, localUser.id);
            }
        }

        const branchIdMap = new Map<string, string>(); // cloudBranchId → localBranchId
        for (const cloudBranch of cloudBranches) {
            const localBranch = await localPrisma.branch.findFirst({
                where: { name: cloudBranch.name }, select: { id: true },
            });
            if (localBranch && localBranch.id !== cloudBranch.id) {
                branchIdMap.set(cloudBranch.id, localBranch.id);
            }
        }

        if (userIdMap.size > 0 || branchIdMap.size > 0) {
            logger.info(`[Sync] ID maps: ${userIdMap.size} users, ${branchIdMap.size} branches requieren traducción`);
        }

        // Helper para traducir IDs
        const mapUserId = (cloudId: string) => userIdMap.get(cloudId) || cloudId;
        const mapBranchId = (cloudId: string) => branchIdMap.get(cloudId) || cloudId;

        // ─── STEP 8: EXCHANGE RATES ────────────────────────────────────────────
        logger.info('[Sync] Pull Step 8: ExchangeRates...');
        const cloudRates = await cloud.exchangeRate.findMany();
        for (const rate of cloudRates) {
            try {
                const existingRate = await localPrisma.exchangeRate.findFirst({ where: { code: rate.code } });
                if (existingRate) {
                    await localPrisma.exchangeRate.update({
                        where: { id: existingRate.id },
                        data: { rate: Number(rate.rate) },
                    });
                } else {
                    await localPrisma.exchangeRate.create({
                        data: { id: rate.id, code: rate.code, rate: Number(rate.rate) },
                    });
                }
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Rate ${rate.code} skip: ${err.message?.slice(0, 100)}`);
            }
        }

        // ─── STEP 9: CASH REGISTERS ───────────────────────────────────────────
        logger.info('[Sync] Pull Step 9: CashRegisters...');
        const cloudCashRegisters = await cloud.cashRegister.findMany();
        let skippedCashRegs = 0;
        for (const cr of cloudCashRegisters) {
            try {
                // Traducir IDs de cloud a IDs locales
                const localUserId = mapUserId(cr.userId);
                const localBranchId = mapBranchId(cr.branchId);

                // Verificar FKs locales con IDs traducidos
                const [userExists, branchExists] = await Promise.all([
                    localPrisma.user.findUnique({ where: { id: localUserId }, select: { id: true } }),
                    localPrisma.branch.findUnique({ where: { id: localBranchId }, select: { id: true } }),
                ]);
                if (!userExists || !branchExists) {
                    skippedCashRegs++;
                    continue;
                }

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
                        userId: localUserId,
                        branchId: localBranchId,
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
                        userId: localUserId,
                        branchId: localBranchId,
                    },
                });
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull CashRegister ${cr.id} skip: ${err.message?.slice(0, 100)}`);
            }
        }
        if (skippedCashRegs > 0) {
            logger.warn(`[Sync] ${skippedCashRegs} CashRegisters omitidos por FKs faltantes`);
        }

        // ─── STEP 10: TRANSACTIONS (solo SYNCED → para vista del dueño) ──────
        logger.info('[Sync] Pull Step 10: Transactions...');
        const cloudTxs = await cloud.transaction.findMany({
            where: { syncStatus: 'SYNCED' },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        let skippedFks = 0;
        for (const tx of cloudTxs) {
            try {
                const existing = await localPrisma.transaction.findUnique({ where: { id: tx.id } });
                if (existing && existing.syncStatus === 'PENDING') continue;

                // Traducir IDs de cloud a IDs locales
                const localUserId = mapUserId(tx.userId);
                const localBranchId = mapBranchId(tx.branchId);

                // Verificar TODAS las FKs con IDs traducidos
                const [userExists, branchExists, cashRegisterExists] = await Promise.all([
                    localPrisma.user.findUnique({ where: { id: localUserId }, select: { id: true } }),
                    localPrisma.branch.findUnique({ where: { id: localBranchId }, select: { id: true } }),
                    tx.cashRegisterId
                        ? localPrisma.cashRegister.findUnique({ where: { id: tx.cashRegisterId }, select: { id: true } })
                        : Promise.resolve(true),
                ]);
                if (!userExists || !branchExists || !cashRegisterExists) {
                    skippedFks++;
                    continue;
                }

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
                        userId: localUserId,
                        branchId: localBranchId,
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
                        userId: localUserId,
                        branchId: localBranchId,
                        cashRegisterId: tx.cashRegisterId ?? undefined,
                    },
                });

                // ── Step 11: Transaction Items ─────────────────────────────────
                for (const item of tx.items) {
                    try {
                        // Verificar FK de producto
                        const productExists = await localPrisma.product.findUnique({
                            where: { id: item.productId }, select: { id: true },
                        });
                        if (!productExists) continue;

                        // Verificar presentación si tiene
                        let presentationId = item.presentationId ?? undefined;
                        if (item.presentationId) {
                            const presExists = await localPrisma.productPresentation.findUnique({
                                where: { id: item.presentationId }, select: { id: true },
                            });
                            if (!presExists) presentationId = undefined; // Degradar sin romper
                        }

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
                                presentationId,
                                quantity: Number(item.quantity),
                                multiplierUsed: Number(item.multiplierUsed),
                                unitPrice: Number(item.unitPrice),
                                subtotal: Number(item.subtotal),
                            },
                        });
                    } catch (err: any) {
                        logger.warn(`[Sync] Pull TxItem ${item.id} skip: ${err.message?.slice(0, 80)}`);
                    }
                }

                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Tx ${tx.id} skip: ${err.message?.slice(0, 80)}`);
            }
        }

        // ─── STEP 11: PRODUCT BATCHES (LOTES) ───────────────────────────────────
        logger.info('[Sync] Pull Step 11: Product Batches...');
        const cloudBatches = await cloud.productBatch.findMany();
        for (const b of cloudBatches) {
            try {
                await localPrisma.productBatch.upsert({
                    where: { id: b.id },
                    update: {
                        batchCode: b.batchCode,
                        quantity: Number(b.quantity),
                        costPrice: b.costPrice ? Number(b.costPrice) : null,
                        expiryDate: b.expiryDate,
                    },
                    create: {
                        id: b.id,
                        batchCode: b.batchCode,
                        productId: b.productId,
                        branchId: b.branchId,
                        quantity: Number(b.quantity),
                        costPrice: b.costPrice ? Number(b.costPrice) : null,
                        expiryDate: b.expiryDate,
                    },
                });
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Batch ${b.id} skip: ${err.message?.slice(0, 80)}`);
            }
        }

        // ─── STEP 12: MERMA (SHRINKAGE) ─────────────────────────────────────────
        logger.info('[Sync] Pull Step 12: Merma Records...');
        const cloudMermas = await cloud.merma.findMany();
        for (const m of cloudMermas) {
            try {
                await localPrisma.merma.upsert({
                    where: { id: m.id },
                    update: {
                        quantity: Number(m.quantity),
                        reason: m.reason,
                        description: (m as any).description ?? null,
                        syncStatus: 'SYNCED',
                    },
                    create: {
                        id: m.id,
                        productId: m.productId,
                        branchId: m.branchId,
                        createdById: m.createdById,
                        quantity: Number(m.quantity),
                        reason: m.reason,
                        description: (m as any).description ?? null,
                        createdAt: m.createdAt,
                        syncStatus: 'SYNCED',
                    },
                });
                pulledCount++;
            } catch (err: any) {
                logger.warn(`[Sync] Pull Merma ${m.id} skip: ${err.message?.slice(0, 80)}`);
            }
        }

        if (skippedFks > 0) {
            logger.warn(`[Sync] ${skippedFks} transacciones omitidas por FKs faltantes`);
        }

        logger.info(`[Sync] Pull completado — ${pulledCount} registros actualizados`);
        return { success: true, pulledItems: pulledCount };

    } catch (error: any) {
        logger.error('[Sync] Error en Pull:', error.message);
        return { success: false, error: error.message };
    }
}