// =============================================================================
// UPLOAD ROUTES — ERP-MARKET
// Upload de imágenes de productos (solo plan PREMIUM)
// Todas las imágenes se convierten a WebP automáticamente.
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { planGuard } from '../../core/middlewares/plan.middleware';

const router = Router();

// ─── Storage config — temp dir, sharp reescribe a WebP ──────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'products');
const TEMP_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'temp');

// Asegurar que los directorios existen
async function ensureDirs() {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
}
ensureDirs();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (_req, _file, cb) => {
        const name = crypto.randomBytes(12).toString('hex');
        cb(null, name);
    },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1,
    },
});

/**
 * POST /api/upload/product-image
 * Sube imagen → convierte a WebP → guarda en uploads/products/
 * Solo plan PREMIUM.
 */
router.post(
    '/product-image',
    authMiddleware,
    planGuard('premium'),
    (req, res, next) => {
        upload.single('image')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, error: 'La imagen no puede superar 5MB.' });
                }
                return res.status(400).json({ success: false, error: err.message });
            }
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }
            next();
        });
    },
    async (req, res) => {
        const tempFile = req.file?.path ?? '';
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No se envió ninguna imagen.' });
            }

            const outputFilename = `${crypto.randomBytes(12).toString('hex')}.webp`;
            const outputPath = path.join(UPLOAD_DIR, outputFilename);

            // Convertir a WebP con sharp (calidad 82, buen balance calidad/tamaño)
            await sharp(tempFile)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .webp({ quality: 82 })
                .toFile(outputPath);

            // Limpiar temp file
            if (tempFile) await fs.unlink(tempFile).catch(() => {});

            const url = `/uploads/products/${outputFilename}`;
            const stats = await fs.stat(outputPath);

            res.json({
                success: true,
                url,
                filename: outputFilename,
                size: stats.size,
                mimetype: 'image/webp',
                format: 'webp',
            });
        } catch (error: any) {
            console.error('[upload] Error:', error.message);
            // Limpiar temp file en caso de error
            if (tempFile) await fs.unlink(tempFile).catch(() => {});
            res.status(500).json({ success: false, error: 'Error al procesar imagen.' });
        }
    }
);

export default router;
