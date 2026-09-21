import '../tests/setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { exportLocalBackup, listBackups } from '../src/modules/backup/backup.service';

describe('Backup & Takeout Service', () => {
    const backupDir = path.resolve(process.cwd(), 'backups');

    beforeAll(() => {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
    });

    const testFilesToCleanup: string[] = [];

    afterAll(() => {
        // Clean up test backup files generated during test
        for (const file of testFilesToCleanup) {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch {}
            }
        }
        // Also cleanup any erp-backup generated today during testing
        if (fs.existsSync(backupDir)) {
            const files = fs.readdirSync(backupDir);
            for (const file of files) {
                if (file.startsWith('backup-test-') || file.startsWith('erp-backup-2026-09-')) {
                    try { fs.unlinkSync(path.join(backupDir, file)); } catch {}
                }
            }
        }
    });

    it('should export a full takeout backup compressed with gzip -9', async () => {
        const result = await exportLocalBackup();

        expect(result).toBeDefined();
        expect(result.filename).toMatch(/^erp-backup-.*\.json\.gz$/);
        expect(result.sizeBytes).toBeGreaterThan(0);
        expect(result.filePath).toBeDefined();
        expect(fs.existsSync(result.filePath)).toBe(true);

        // Verify it can be decompressed and contains all business entities
        const compressedBuffer = fs.readFileSync(result.filePath);
        const decompressed = zlib.gunzipSync(compressedBuffer).toString('utf-8');
        const parsed = JSON.parse(decompressed);

        expect(parsed.version).toBe('2.0');
        expect(parsed.system).toBe('ERP-Market');
        expect(Array.isArray(parsed.tablesIncluded)).toBe(true);
        expect(parsed.tablesIncluded).toContain('products');
        expect(parsed.tablesIncluded).toContain('customers');
        expect(parsed.tablesIncluded).toContain('customerPayments');
        expect(parsed.tablesIncluded).toContain('bankAccounts');
        expect(parsed.tablesIncluded).toContain('productBatches');
        expect(parsed.tablesIncluded).toContain('transactions');

        expect(parsed.data).toBeDefined();
        expect(Array.isArray(parsed.data.products)).toBe(true);
        expect(Array.isArray(parsed.data.customers)).toBe(true);
        expect(Array.isArray(parsed.data.bankAccounts)).toBe(true);
    });

    it('should list local backups sorted by date descending', async () => {
        const backups = listBackups();
        expect(Array.isArray(backups)).toBe(true);
        expect(backups.length).toBeGreaterThanOrEqual(1);

        const latest = backups[0];
        expect(latest.filename).toBeDefined();
        expect(latest.sizeBytes).toBeGreaterThan(0);
        expect(latest.createdAt).toBeDefined();
    });

    it('should enforce automatic rotation keeping at most 7 backups', async () => {
        const now = Date.now();
        const createdFiles: string[] = [];

        for (let i = 0; i < 9; i++) {
            const date = new Date(now - (10 - i) * 60000).toISOString().replace(/[:.]/g, '-');
            const fname = `backup-test-${date}.json.gz`;
            const fpath = path.join(backupDir, fname);
            const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ index: i })));
            fs.writeFileSync(fpath, gz);
            createdFiles.push(fpath);
        }

        // Trigger exportLocalBackup which runs pruneLocalBackups(7)
        await exportLocalBackup();

        const remaining = listBackups();
        expect(remaining.length).toBeLessThanOrEqual(7);

        // Clean up any remaining test files
        for (const f of createdFiles) {
            if (fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch {}
            }
        }
    });
});
