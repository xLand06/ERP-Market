// =============================================================================
// BACKUP ROUTES — ERP-MARKET
// Todos los endpoints requieren rol OWNER.
//
// POST   /api/backup/export          → Genera backup .json.gz desde SQLite
// GET    /api/backup/list            → Lista backups disponibles en disco
// GET    /api/backup/download/:name  → Descarga el archivo .json.gz
// DELETE /api/backup/:name           → Borra un backup del disco
// POST   /api/backup/purge-cloud     → Purga registros SYNCED de Supabase
// GET    /api/backup/cloud-stats     → Estadísticas de uso en Supabase
// =============================================================================

import express, { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import {
    exportLocalBackup,
    listBackups,
    deleteBackup,
    getCloudStats,
    purgeCloudTransactional,
    restoreLocalBackup,
    getSupabaseStorageSize,
} from './backup.service';

const router = Router();

// Todos los endpoints de backup son exclusivos del OWNER
router.use(authMiddleware);
router.use(roleGuard('OWNER'));

// ─── GET /api/backup/list ─────────────────────────────────────────────────────
// Lista los backups existentes en disco
router.get('/list', async (_req, res: Response) => {
    try {
        const backups = listBackups();
        res.json({ success: true, data: backups });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/backup/cloud-stats ─────────────────────────────────────────────
// Estadísticas de cuántos registros se eliminarían según el parámetro de días
router.get('/cloud-stats', async (req, res: Response) => {
    try {
        const olderThanDays = parseInt(req.query.days as string) || 30;
        const stats = await getCloudStats(olderThanDays);
        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/backup/cloud-storage ───────────────────────────────────────────
// Obtiene el tamaño total utilizado en la base de datos de Supabase
router.get('/cloud-storage', async (_req, res: Response) => {
    try {
        const storageStats = await getSupabaseStorageSize();
        res.json({ success: true, data: storageStats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── POST /api/backup/export ──────────────────────────────────────────────────
// Genera un backup .json.gz del SQLite local
router.post('/export', async (req: AuthRequest, res: Response) => {
    try {
        const meta = await exportLocalBackup();

        await logAudit({
            action: 'SYSTEM_PURGE', // reutilizamos tipo existente
            module: 'backup',
            details: {
                action: 'BACKUP_EXPORT',
                filename: meta.filename,
                sizeBytes: meta.sizeBytes,
                tablesIncluded: meta.tablesIncluded,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({
            success: true,
            data: {
                filename: meta.filename,
                sizeBytes: meta.sizeBytes,
                createdAt: meta.createdAt,
                tablesIncluded: meta.tablesIncluded,
                // TODO (Google Drive): Este campo se llenará con el fileId de Drive
                // cuando se integre OAuth2: driveFileId: null
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/backup/download/:filename ──────────────────────────────────────
// Descarga el archivo .json.gz al cliente
router.get('/download/:filename', (req, res: Response) => {
    try {
        const { filename } = req.params;

        // Validar nombre seguro
        if (!/^[\w\-.]+\.json\.gz$/.test(filename)) {
            res.status(400).json({ success: false, error: 'Nombre de archivo no válido' });
            return;
        }

        const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
        const filePath = path.join(BACKUP_DIR, filename);

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ success: false, error: 'Backup no encontrado' });
            return;
        }

        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', fs.statSync(filePath).size);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── DELETE /api/backup/:filename ────────────────────────────────────────────
// Elimina un backup del disco
router.delete('/:filename', async (req: AuthRequest, res: Response) => {
    try {
        const { filename } = req.params;
        deleteBackup(filename);

        await logAudit({
            action: 'SYSTEM_PURGE',
            module: 'backup',
            details: { action: 'BACKUP_DELETE', filename },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, message: 'Backup eliminado' });
    } catch (error: any) {
        const status = error.message === 'Backup no encontrado' ? 404 : 400;
        res.status(status).json({ success: false, error: error.message });
    }
});

// ─── POST /api/backup/purge-cloud ────────────────────────────────────────────
// Purga registros SYNCED de Supabase. El SQLite local NO se toca.
router.post('/purge-cloud', async (req: AuthRequest, res: Response) => {
    try {
        const olderThanDays = parseInt(req.body.olderThanDays) || 30;
        const logRetentionDays = parseInt(req.body.logRetentionDays) || 90;

        if (olderThanDays < 7) {
            res.status(400).json({
                success: false,
                error: 'No se puede purgar registros de menos de 7 días para evitar pérdida de datos activos.',
            });
            return;
        }

        const results = await purgeCloudTransactional(olderThanDays, logRetentionDays);
        const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

        await logAudit({
            action: 'SYSTEM_PURGE',
            module: 'backup',
            details: {
                action: 'CLOUD_PURGE',
                olderThanDays,
                logRetentionDays,
                results,
                totalDeleted,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({
            success: true,
            data: {
                results,
                totalDeleted,
                message: `Se eliminaron ${totalDeleted} registros de Supabase. Los datos locales permanecen intactos.`,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── POST /api/backup/restore/:filename ───────────────────────────────────────
// Restaura un backup existente en el servidor en el SQLite local
router.post('/restore/:filename', async (req: AuthRequest, res: Response) => {
    try {
        const { filename } = req.params;
        await restoreLocalBackup(filename);

        await logAudit({
            action: 'SYSTEM_PURGE',
            module: 'backup',
            details: { action: 'BACKUP_RESTORE_LOCAL', filename },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({
            success: true,
            message: 'Base de datos restaurada correctamente desde el backup.',
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── POST /api/backup/upload-restore ──────────────────────────────────────────
// Sube un archivo .json.gz y lo restaura inmediatamente en el SQLite local
router.post(
    '/upload-restore',
    express.raw({ type: '*/*', limit: '50mb' }),
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.body || req.body.length === 0) {
                res.status(400).json({ success: false, error: 'No se recibió ningún archivo.' });
                return;
            }

            const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
            if (!fs.existsSync(BACKUP_DIR)) {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
            }

            // Guardar temporalmente
            const filename = `erp-upload-${Date.now()}.json.gz`;
            const filePath = path.join(BACKUP_DIR, filename);
            fs.writeFileSync(filePath, req.body);

            // Ejecutar restauración
            await restoreLocalBackup(filename);

            await logAudit({
                action: 'SYSTEM_PURGE',
                module: 'backup',
                details: { action: 'BACKUP_UPLOAD_RESTORE', filename },
                userId: req.user!.id,
                ipAddress: extractIp(req),
            });

            res.json({
                success: true,
                message: 'Archivo subido y base de datos restaurada exitosamente.',
            });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;
