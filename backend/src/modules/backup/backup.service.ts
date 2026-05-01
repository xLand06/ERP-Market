// =============================================================================
// BACKUP SERVICE — ERP-MARKET
// Genera backups comprimidos desde SQLite local y purga registros antiguos
// de Supabase. El SQLite LOCAL nunca se modifica.
//
// Diseñado para escalar a Google Drive OAuth2 en el futuro:
//   - exportLocalBackup() devuelve filePath + metadata listos para upload.
//   - En una versión futura, se añade uploadToDrive(filePath, driveToken).
// =============================================================================

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { getLocalPrisma, getCloudPrisma } from '../../config/prisma';
import logger from '../../core/utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Directorio donde se guardan los backups (relativo al proceso del backend)
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const CONFIG_FILE = path.join(BACKUP_DIR, 'config.json');

// ── Tablas purgables (datos transaccionales diarios) ─────────────────────────
// Estas son las tablas que crecen diariamente y se pueden purgar de Supabase.
// Las tablas de catálogo (products, branches, users, etc.) NUNCA se purgan.
export const PURGEABLE_TABLES = [
    'transactionItems', // items de ventas
    'transactions',     // ventas / entradas de inventario
    'cashRegisters',    // sesiones de caja
    'auditLogs',        // logs de auditoría (retención: 90 días por defecto)
] as const;

export type PurgeableTable = typeof PURGEABLE_TABLES[number];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BackupMeta {
    filename: string;
    sizeBytes: number;
    createdAt: string; // ISO string
    tablesIncluded: string[];
}

export interface CloudStats {
    table: string;
    count: number;
    totalCount: number;
    oldestRecord: string | null;
}

export interface PurgeResult {
    table: string;
    deletedCount: number;
}

export interface CloudStorageStats {
    usedBytes: number;
    totalBytes: number;
    percentUsed: number;
}

// =============================================================================
// EXPORT — Genera backup comprimido desde SQLite
// =============================================================================

/**
 * Exporta todos los datos del SQLite local a un archivo .json.gz comprimido.
 * No toca ni modifica el SQLite en ningún momento.
 *
 * @returns metadata del archivo creado (path, tamaño, timestamp)
 *
 * TODO (Google Drive): Al añadir integración con Drive, llamar aquí:
 *   const driveFileId = await uploadToDrive(meta.filePath, driveAccessToken);
 */
export async function exportLocalBackup(): Promise<BackupMeta & { filePath: string }> {
    const local = getLocalPrisma();

    // Asegurar que exista el directorio de backups
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    logger.info('[Backup] Iniciando exportación desde SQLite...');

    // Exportar todas las tablas en paralelo
    const [
        users,
        branches,
        groups,
        subGroups,
        products,
        productBarcodes,
        productPresentations,
        branchInventory,
        suppliers,
        purchaseOrders,
        purchaseOrderItems,
        transactions,
        transactionItems,
        cashRegisters,
        exchangeRates,
        auditLogs,
    ] = await Promise.all([
        local.user.findMany(),
        local.branch.findMany(),
        local.group.findMany(),
        local.subGroup.findMany(),
        local.product.findMany(),
        local.productBarcode.findMany(),
        local.productPresentation.findMany(),
        local.branchInventory.findMany(),
        local.supplier.findMany(),
        local.purchaseOrder.findMany(),
        local.purchaseOrderItem.findMany(),
        local.transaction.findMany(),
        local.transactionItem.findMany(),
        local.cashRegister.findMany(),
        local.exchangeRate.findMany(),
        local.auditLog.findMany(),
    ]);

    const tablesIncluded = [
        'users', 'branches', 'groups', 'subGroups', 'products', 'productBarcodes',
        'productPresentations', 'branchInventory', 'suppliers', 'purchaseOrders',
        'purchaseOrderItems', 'transactions', 'transactionItems', 'cashRegisters',
        'exchangeRates', 'auditLogs',
    ];

    const payload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        system: 'ERP-Market',
        tablesIncluded,
        data: {
            users,
            branches,
            groups,
            subGroups,
            products,
            productBarcodes,
            productPresentations,
            branchInventory,
            suppliers,
            purchaseOrders,
            purchaseOrderItems,
            transactions,
            transactionItems,
            cashRegisters,
            exchangeRates,
            auditLogs,
        },
    };

    // Comprimir con gzip
    const jsonBuffer = Buffer.from(JSON.stringify(payload));
    const compressed = await gzip(jsonBuffer);

    // Nombre del archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `erp-backup-${timestamp}.json.gz`;
    const filePath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filePath, compressed);

    const sizeBytes = fs.statSync(filePath).size;
    logger.info('[Backup] Exportación completada', { filename, sizeBytes });

    return {
        filename,
        filePath,
        sizeBytes,
        createdAt: new Date().toISOString(),
        tablesIncluded,
    };
}

// =============================================================================
// LIST — Lista los backups disponibles en disco
// =============================================================================

export function listBackups(): BackupMeta[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    return fs
        .readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json.gz'))
        .map(filename => {
            const filePath = path.join(BACKUP_DIR, filename);
            const stat = fs.statSync(filePath);
            return {
                filename,
                sizeBytes: stat.size,
                createdAt: stat.birthtime.toISOString(),
                tablesIncluded: [], // no parseamos el gz para el listado
            };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// =============================================================================
// DELETE — Elimina un backup del disco
// =============================================================================

export function deleteBackup(filename: string): void {
    // Validar que el nombre sea seguro (solo caracteres alfanuméricos, guiones, puntos)
    if (!/^[\w\-.]+\.json\.gz$/.test(filename)) {
        throw new Error('Nombre de archivo no válido');
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup no encontrado');
    }
    fs.unlinkSync(filePath);
}

// =============================================================================
// CLOUD STATS — Estadísticas de uso en Supabase por tabla
// =============================================================================

export async function getCloudStats(olderThanDays: number = 30): Promise<CloudStats[]> {
    const cloud = getCloudPrisma();
    if (!cloud) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const [
        txCount, txTotal,
        itemsCount, itemsTotal,
        crCount, crTotal,
        auditCount, auditTotal
    ] = await Promise.all([
        cloud.transaction.count({ where: { createdAt: { lt: cutoffDate } } }),
        cloud.transaction.count(),
        
        cloud.transactionItem.count({ where: { transaction: { createdAt: { lt: cutoffDate } } } }),
        cloud.transactionItem.count(),

        cloud.cashRegister.count({ where: { openedAt: { lt: cutoffDate } } }),
        cloud.cashRegister.count(),

        cloud.auditLog.count({ where: { createdAt: { lt: cutoffDate } } }),
        cloud.auditLog.count(),
    ]);

    // Obtener el registro más antiguo de cada tabla
    const [oldestTx, oldestCr, oldestAudit] = await Promise.all([
        cloud.transaction.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        cloud.cashRegister.findFirst({
            orderBy: { openedAt: 'asc' },
            select: { openedAt: true },
        }),
        cloud.auditLog.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
    ]);

    return [
        {
            table: 'transactions',
            count: txCount,
            totalCount: txTotal,
            oldestRecord: oldestTx?.createdAt?.toISOString() ?? null,
        },
        {
            table: 'transactionItems',
            count: itemsCount,
            totalCount: itemsTotal,
            oldestRecord: oldestTx?.createdAt?.toISOString() ?? null,
        },
        {
            table: 'cashRegisters',
            count: crCount,
            totalCount: crTotal,
            oldestRecord: oldestCr?.openedAt?.toISOString() ?? null,
        },
        {
            table: 'auditLogs',
            count: auditCount,
            totalCount: auditTotal,
            oldestRecord: oldestAudit?.createdAt?.toISOString() ?? null,
        },
    ];
}

// =============================================================================
// CLOUD STORAGE — Tamaño de la base de datos en Supabase
// =============================================================================

export async function getSupabaseStorageSize(): Promise<CloudStorageStats> {
    const cloud = getCloudPrisma();
    if (!cloud) {
        return { usedBytes: 0, totalBytes: 500 * 1024 * 1024, percentUsed: 0 };
    }

    try {
        const result: any = await cloud.$queryRawUnsafe(
            `SELECT pg_database_size(current_database()) as size_bytes;`
        );

        const usedBytes = Number(result?.[0]?.size_bytes) || 0;
        const totalBytes = 500 * 1024 * 1024; // 500 MB limit
        const percentUsed = Math.min(100, parseFloat(((usedBytes / totalBytes) * 100).toFixed(2)));

        return {
            usedBytes,
            totalBytes,
            percentUsed,
        };
    } catch (error) {
        logger.error('[Backup] Error obteniendo tamaño de Supabase: ' + String(error));
        return { usedBytes: 0, totalBytes: 500 * 1024 * 1024, percentUsed: 0 };
    }
}

/**
 * Guarda la configuración de backup en un archivo local
 */
export async function saveBackupConfig(config: { purgeRetentionDays: number; purgeLogRetentionDays: number }) {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    logger.info('[Backup] Configuración guardada en disco', config);
}

/**
 * Lee la configuración de backup desde el disco
 */
export function loadBackupConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch (e) {
            return { purgeRetentionDays: 30, purgeLogRetentionDays: 90 };
        }
    }
    return { purgeRetentionDays: 30, purgeLogRetentionDays: 90 };
}

/**
 * Verifica si el espacio en Supabase supera el 70% y gatilla una purga automática.
 * Esta función puede ser llamada periódicamente o después de un ciclo de sync.
 */
export async function checkAndAutoPurge() {
    try {
        const stats = await getSupabaseStorageSize();
        
        if (stats.percentUsed >= 70) {
            logger.warn(`[Backup] Supabase al ${stats.percentUsed}%. Iniciando respaldo preventivo y purga automática...`);
            
            // 1. Respaldo preventivo antes de purgar
            try {
                await exportLocalBackup();
                logger.info('[Backup] Respaldo preventivo completado exitosamente.');
            } catch (backupError) {
                logger.error('[Backup] Error creando respaldo preventivo, procediendo con purga por espacio crítico: ' + String(backupError));
            }

            // 2. Cargamos la configuración persistente
            const config = loadBackupConfig();
            
            // 3. Purgamos según la configuración (o defaults)
            const results = await purgeCloudTransactional(
                config.purgeRetentionDays || 15, 
                config.purgeLogRetentionDays || 60
            );
            
            const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
            logger.info(`[Backup] Purga automática completada. ${totalDeleted} registros eliminados.`);
            
            return {
                triggered: true,
                percentUsed: stats.percentUsed,
                totalDeleted,
                results
            };
        }
        
        return { triggered: false, percentUsed: stats.percentUsed };
    } catch (error) {
        logger.error('[Backup] Error en purga automática: ' + String(error));
        return { triggered: false, error: String(error) };
    }
}


// =============================================================================
// PURGE CLOUD — Borra registros SYNCED antiguos SOLO en Supabase
// El SQLite local NO se toca en ningún momento.
//
// REGLAS DE SEGURIDAD:
//   1. Solo registros con syncStatus = 'SYNCED' (ya están en Supabase)
//   2. Solo registros con fecha < (hoy - olderThanDays)
//   3. Los transactionItems se borran en cascada al borrar transactions
//   4. Los auditLogs no tienen syncStatus — se purgan por fecha únicamente
// =============================================================================

export async function purgeCloudTransactional(
    olderThanDays: number = 30,
    logRetentionDays: number = 90,
): Promise<PurgeResult[]> {
    const cloud = getCloudPrisma();
    if (!cloud) {
        throw new Error('Conexión a Supabase no disponible. Verifica tu conexión a internet.');
    }

    const txCutoff = new Date();
    txCutoff.setDate(txCutoff.getDate() - olderThanDays);

    const logCutoff = new Date();
    logCutoff.setDate(logCutoff.getDate() - logRetentionDays);

    logger.warn('[Backup] Iniciando purga en Supabase', {
        olderThanDays,
        logRetentionDays,
        txCutoff: txCutoff.toISOString(),
        logCutoff: logCutoff.toISOString(),
    });

    const results: PurgeResult[] = [];

    // 1. Obtener IDs de transactions a borrar
    const txsToPurge = await cloud.transaction.findMany({
        where: {
            createdAt: { lt: txCutoff },
        },
        select: { id: true },
    });
    const txIds = txsToPurge.map(t => t.id);

    // 2. Borrar TransactionItems primero (FK constraint)
    if (txIds.length > 0) {
        const itemsDeleted = await cloud.transactionItem.deleteMany({
            where: { transactionId: { in: txIds } },
        });
        results.push({ table: 'transactionItems', deletedCount: itemsDeleted.count });

        // 3. Borrar Transactions
        const txDeleted = await cloud.transaction.deleteMany({
            where: { id: { in: txIds } },
        });
        results.push({ table: 'transactions', deletedCount: txDeleted.count });
    } else {
        results.push({ table: 'transactionItems', deletedCount: 0 });
        results.push({ table: 'transactions', deletedCount: 0 });
    }

    // 4. Obtener IDs de CashRegisters a borrar
    // Solo registros CERRADOS (status CLOSED) y ya sincronizados
    const crsToPurge = await cloud.cashRegister.findMany({
        where: {
            status: 'CLOSED',
            openedAt: { lt: txCutoff },
        },
        select: { id: true },
    });
    const crIds = crsToPurge.map(c => c.id);

    if (crIds.length > 0) {
        const crDeleted = await cloud.cashRegister.deleteMany({
            where: { id: { in: crIds } },
        });
        results.push({ table: 'cashRegisters', deletedCount: crDeleted.count });
    } else {
        results.push({ table: 'cashRegisters', deletedCount: 0 });
    }

    // 5. Purgar AuditLogs (con retención independiente de 90 días por defecto)
    const auditDeleted = await cloud.auditLog.deleteMany({
        where: { createdAt: { lt: logCutoff } },
    });
    results.push({ table: 'auditLogs', deletedCount: auditDeleted.count });

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
    logger.info('[Backup] Purga completada en Supabase', { results, totalDeleted });

    return results;
}

// =============================================================================
// RESTORE — Restaura backup desde archivo local (.json.gz)
// Borra TODO lo que esté en SQLite y carga el contenido del backup.
// =============================================================================

export async function restoreLocalBackup(filename: string): Promise<void> {
    if (!/^[\w\-.]+\.json\.gz$/.test(filename)) {
        throw new Error('Nombre de archivo no válido');
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup no encontrado');
    }

    logger.warn('[Backup] Iniciando proceso de RESTAURACIÓN local...', { filename });

    let payload: any;
    try {
        const compressed = fs.readFileSync(filePath);
        const jsonBuffer = await gunzip(compressed);
        payload = JSON.parse(jsonBuffer.toString());
    } catch (err: any) {
        throw new Error(`No se pudo leer o descomprimir el backup: ${err.message}`);
    }

    if (!payload || !payload.data) {
        throw new Error('El archivo de backup no tiene el formato esperado.');
    }

    const local = getLocalPrisma();

    // ── 1. Generar backup preventivo antes de destruir nada ──────────────────
    try {
        await exportLocalBackup();
    } catch (e) {
        logger.error('[Backup] No se pudo crear el backup preventivo, cancelando restauración.');
        throw new Error('Fallo al crear respaldo preventivo. Restauración abortada por seguridad.');
    }

    const d = payload.data;

    try {
        // ── 2. Desactivar llaves foráneas en SQLite ───────────────────────────
        await local.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

        // ── 3. Vaciar todas las tablas ─────────────────────────────────────────
        await local.$transaction([
            local.transactionItem.deleteMany(),
            local.transaction.deleteMany(),
            local.cashRegister.deleteMany(),
            local.branchInventory.deleteMany(),
            local.productPresentation.deleteMany(),
            local.productBarcode.deleteMany(),
            local.product.deleteMany(),
            local.subGroup.deleteMany(),
            local.group.deleteMany(),
            local.supplier.deleteMany(),
            local.purchaseOrderItem.deleteMany(),
            local.purchaseOrder.deleteMany(),
            local.branch.deleteMany(),
            local.user.deleteMany(),
            local.exchangeRate.deleteMany(),
            local.auditLog.deleteMany(),
        ]);

        // ── 4. Insertar datos en bloques ───────────────────────────────────────
        await local.$transaction([
            local.user.createMany({ data: d.users || [] }),
            local.branch.createMany({ data: d.branches || [] }),
            local.group.createMany({ data: d.groups || [] }),
            local.subGroup.createMany({ data: d.subGroups || [] }),
            local.product.createMany({ data: d.products || [] }),
            local.productBarcode.createMany({ data: d.productBarcodes || [] }),
            local.productPresentation.createMany({ data: d.productPresentations || [] }),
            local.branchInventory.createMany({ data: d.branchInventory || [] }),
            local.supplier.createMany({ data: d.suppliers || [] }),
            local.purchaseOrder.createMany({ data: d.purchaseOrders || [] }),
            local.purchaseOrderItem.createMany({ data: d.purchaseOrderItems || [] }),
            local.transaction.createMany({ data: d.transactions || [] }),
            local.transactionItem.createMany({ data: d.transactionItems || [] }),
            local.cashRegister.createMany({ data: d.cashRegisters || [] }),
            local.exchangeRate.createMany({ data: d.exchangeRates || [] }),
            local.auditLog.createMany({ data: d.auditLogs || [] }),
        ]);

        logger.info('[Backup] Restauración local completada exitosamente.');
    } catch (error: any) {
        logger.error('[Backup] Error fatal restaurando datos:', error);
        throw new Error(`Error al insertar datos: ${error.message}`);
    } finally {
        // ── 5. Reactivar llaves foráneas ──────────────────────────────────────
        await local.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    }
}

