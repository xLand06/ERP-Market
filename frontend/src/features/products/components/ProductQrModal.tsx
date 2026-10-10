import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Printer, Copy, Check, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Product } from '../types';

interface ProductQrModalProps {
    open: boolean;
    onClose: () => void;
    product: Product | null;
    catalogSlug?: string;
}

export function ProductQrModal({ open, onClose, product, catalogSlug }: ProductQrModalProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Si hay slug de catálogo, generamos un enlace directo al producto en el catálogo online con query param ?p=... o ?q=...
    // Si no, usamos el código de barras o ID del producto como fallback identificador.
    const rawCode = product?.barcode || product?.id || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const targetUrl = catalogSlug && rawCode
        ? `${origin}/catalogo/${encodeURIComponent(catalogSlug)}?q=${encodeURIComponent(rawCode)}`
        : rawCode;

    useEffect(() => {
        if (!open || !product || !targetUrl) {
            setQrDataUrl('');
            return;
        }

        let isMounted = true;
        void QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
            errorCorrectionLevel: 'M',
        }).then((url) => {
            if (isMounted) setQrDataUrl(url);
        });

        return () => {
            isMounted = false;
        };
    }, [open, product, targetUrl]);

    if (!product) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `QR-${product.name.replace(/\s+/g, '_')}.png`;
        a.click();
    };

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR - ${product.name}</title>
                <style>
                    body {
                        font-family: system-ui, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        margin: 0;
                        text-align: center;
                    }
                    img { width: 220px; height: 220px; }
                    h2 { margin: 8px 0 4px 0; font-size: 18px; }
                    p { margin: 0; font-size: 12px; color: #64748b; }
                    .code { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 6px; color: #0f172a; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <img src="${qrDataUrl}" onload="window.print(); window.close();" />
                <h2>${product.name}</h2>
                ${product.barcode ? `<div class="code">Cod: ${product.barcode}</div>` : ''}
                <p>Escanea para consultar detalles en catálogo</p>
            </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-md p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl">
                <DialogHeader className="p-0 border-0 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black text-slate-900">
                                Código QR del Producto
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 truncate max-w-[280px]">
                                {product.name}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-2">
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-inner flex flex-col items-center">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt={`QR ${product.name}`}
                                className="w-56 h-56 object-contain rounded-lg"
                            />
                        ) : (
                            <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                                Generando código QR...
                            </div>
                        )}
                        <p className="text-xs font-mono font-semibold text-slate-600 mt-2 text-center break-all max-w-[260px]">
                            {product.barcode ? `Código: ${product.barcode}` : `ID: ${product.id}`}
                        </p>
                    </div>

                    {catalogSlug && (
                        <div className="w-full bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0 text-left">
                                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">
                                    Enlace en Catálogo Online
                                </span>
                                <span className="text-xs text-slate-600 font-mono truncate block">
                                    {targetUrl}
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="shrink-0 h-8 px-2.5 text-indigo-700 hover:bg-indigo-100/60"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDownload}
                            disabled={!qrDataUrl}
                            className="w-full h-11 rounded-xl border-slate-200 text-xs font-bold gap-2 text-slate-700 hover:bg-slate-50"
                        >
                            <Download className="w-4 h-4" />
                            Descargar PNG
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePrint}
                            disabled={!qrDataUrl}
                            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-2 shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir Etiqueta
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
