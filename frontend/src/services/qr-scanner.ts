import { registerPlugin } from '@capacitor/core';

export interface QrScannerPlugin {
    scan(): Promise<{ text: string }>;
}

export const QrScanner = registerPlugin<QrScannerPlugin>('QrScanner');

/**
 * Scans a QR code using the high-performance native CameraX + ZXing scanner on Android.
 * Returns the decoded string, or null if cancelled.
 */
export async function scanNativeQr(): Promise<string | null> {
    try {
        const res = await QrScanner.scan();
        return res?.text ? String(res.text).trim() : null;
    } catch (e: any) {
        const msg = String(e?.message || e);
        if (/cancelled|cancel/i.test(msg)) {
            return null;
        }
        throw e;
    }
}
