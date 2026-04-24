import { prismaCloud } from '../../config/prisma';
import { 
    fetchLocalUsers, 
    fetchLocalBranches, 
    fetchPendingTransactions, 
    fetchPendingCashRegisters,
    checkElectronConnection,
    ElectronUser,
    ElectronBranch,
    ElectronTransaction,
    ElectronCashRegister
} from './electron-api.client';
import { logger } from '../../core/utils/logger';
import { $Enums } from '@prisma/client';

const loggerSync = {
    info: (msg: string, meta?: any) => logger.info(msg, { module: 'sync', ...meta }),
    error: (msg: string, meta?: any) => logger.error(msg, { module: 'sync', ...meta }),
    warn: (msg: string, meta?: any) => logger.warn(msg, { module: 'sync', ...meta }),
};

export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    
    const isConnected = await checkElectronConnection();
    if (!isConnected) {
        loggerSync.warn('[Sync] Electron no conectado, saltando push...');
        return { success: false, error: 'Electron no disponible' };
    }
    
    try {
        console.log('[Sync] Starting Push Sales & Cash Registers...');
        console.log('[Sync] Mode: HTTP API → Cloud (hybrid)');
        let pushedCount = 0;

        // ============================================
        // STEP 1: Push USERS first (needed for cash_registers and transactions)
        // ============================================
        console.log('[Sync] Step 1: Pushing Users...');
        const localUsers: ElectronUser[] = await fetchLocalUsers();
        
        if (localUsers.length === 0) {
            console.log('[Sync] No users found in local (Electron)');
        }

        for (const user of localUsers) {
            if (!user.isActive) continue;
            
            try {
                const existingInCloud = await prismaCloud.user.findUnique({
                    where: { id: user.id }
                });

                if (existingInCloud) {
                    await prismaCloud.user.update({
                        where: { id: user.id },
                        data: {
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
                            isActive: user.isActive
                        }
                    });
                } else {
                    const existingByUsername = await prismaCloud.user.findUnique({
                        where: { username: user.username }
                    });

                    if (existingByUsername) {
                        console.log(`[Sync] User ${user.username} exists in cloud with different ID, skipping...`);
                        continue;
                    }

                    await prismaCloud.user.create({
                        data: {
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
                            isActive: user.isActive
                        }
                    });
                }
                console.log(`[Sync] Pushed/synced user: ${user.username}`);
                pushedCount++;
            } catch (err: any) {
                if (err.code === 'P2002') {
                    console.log(`[Sync] User ${user.username} already exists in cloud, skipping...`);
                } else {
                    console.error(`[Sync] Failed to push user ${user.id}:`, err.message);
                }
            }
        }

        // ============================================
        // STEP 2: Push BRANCHES (needed for cash_registers and transactions)
        // ============================================
        console.log('[Sync] Step 2: Pushing Branches...');
        const localBranches: ElectronBranch[] = await fetchLocalBranches();
        
        if (localBranches.length === 0) {
            console.log('[Sync] No branches found in local (Electron)');
        }

        for (const branch of localBranches) {
            if (!branch.isActive) continue;
            
            try {
                const branchCode = branch.code || `SEDE-${branch.id.slice(-6).toUpperCase()}`;
                
                await prismaCloud.branch.upsert({
                    where: { id: branch.id },
                    update: {
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive
                    },
                    create: {
                        id: branch.id,
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive
                    }
                });
                console.log(`[Sync] Pushed/synced branch: ${branch.name} (code: ${branchCode})`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push branch ${branch.id}:`, err.message);
            }
        }

        // ============================================
        // STEP 3: Push CASH REGISTERS
        // ============================================
        console.log('[Sync] Step 3: Pushing Cash Registers...');
        const pendingRegisters: ElectronCashRegister[] = await fetchPendingCashRegisters();
        
        if (pendingRegisters.length === 0) {
            console.log('[Sync] No pending cash registers to sync');
        }

        for (const reg of pendingRegisters) {
            try {
                await prismaCloud.cashRegister.upsert({
                    where: { id: reg.id },
                    update: {
                        status: reg.status as $Enums.CashRegisterStatus,
                        openingAmount: reg.openingAmount,
                        closingAmount: reg.closingAmount,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt,
                        userId: reg.userId,
                        branchId: reg.branchId
                    },
                    create: {
                        id: reg.id,
                        status: reg.status as $Enums.CashRegisterStatus,
                        openingAmount: reg.openingAmount,
                        closingAmount: reg.closingAmount,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt,
                        userId: reg.userId,
                        branchId: reg.branchId
                    }
                });
                console.log(`[Sync] Pushed cash register: ${reg.id}`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push cash register ${reg.id}:`, err.message);
            }
        }

        // ============================================
        // STEP 4: Push TRANSACTIONS
        // ============================================
        console.log('[Sync] Step 4: Pushing Transactions...');
        const pendingTxs: ElectronTransaction[] = await fetchPendingTransactions();
        
        if (pendingTxs.length === 0) {
            console.log('[Sync] No pending transactions to sync');
        }

        for (const tx of pendingTxs) {
            try {
                await prismaCloud.transaction.upsert({
                    where: { id: tx.id },
                    update: {
                        type: tx.type as $Enums.TransactionType,
                        status: tx.status as $Enums.TransactionStatus,
                        total: tx.amount,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId
                    },
                    create: {
                        id: tx.id,
                        type: tx.type as $Enums.TransactionType,
                        status: tx.status as $Enums.TransactionStatus,
                        total: tx.amount,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId
                    }
                });
                console.log(`[Sync] Pushed transaction: ${tx.id}`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push transaction ${tx.id}:`, err.message);
            }
        }

        console.log(`[Sync] Push Completed: ${pushedCount} records processed`);
        return { success: true, pushedItems: pushedCount };
    } catch (error: any) {
        console.error('[Sync] Critical Error in pushSales:', error);
        return { success: false, error: error.message };
    }
}