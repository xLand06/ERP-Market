import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
    QrCode,
    Download,
    Printer,
    Copy,
    Check,
    Tag,
    Sliders,
    Layers,
    Plus,
    Minus,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConfigStore } from '@/hooks/useConfigStore';
import type { Product } from '../types';

export type LabelPrinterType = 'thermal' | 'standard';
export type ThermalSize = '50x30' | '58x40' | '80x50';

const THERMAL_DIMENSIONS: Record<ThermalSize, { widthMm: number; heightMm: number; label: string; qrSizeMm: number; titlePt: number; scanPt: number }> = {
    '50x30': { widthMm: 50, heightMm: 30, label: '50 x 30 mm (Góndola pequeña)', qrSizeMm: 14, titlePt: 8, scanPt: 7 },
    '58x40': { widthMm: 58, heightMm: 40, label: '58 x 40 mm (Estándar 2")', qrSizeMm: 19, titlePt: 9.5, scanPt: 8 },
    '80x50': { widthMm: 80, heightMm: 50, label: '80 x 50 mm (Grande 3")', qrSizeMm: 24, titlePt: 11, scanPt: 9.5 },
};

interface ProductQrModalProps {
    open: boolean;
    onClose: () => void;
    product: Product | null;
    catalogSlug?: string;
}

export function ProductQrModal({ open, onClose, product, catalogSlug }: ProductQrModalProps) {
    const { fmtCOP } = useConfigStore();
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [copied, setCopied] = useState(false);

    // Ajustes de impresión
    const [printerType, setPrinterType] = useState<LabelPrinterType>('thermal');
    const [thermalSize, setThermalSize] = useState<ThermalSize>('50x30');
    const [copies, setCopies] = useState<number>(1);
    const [showPrice, setShowPrice] = useState<boolean>(true);
    const [showBarcode, setShowBarcode] = useState<boolean>(true);

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
            width: 400,
            margin: 1,
            color: {
                dark: '#000000',
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

    const formattedPrice = product.price ? fmtCOP(Number(product.price)) : null;

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

        // Crear un iframe oculto para una impresión limpia sin interferencias de estilos ni bloqueos de popups
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(iframe);
            return;
        }

        const count = Math.max(1, Math.min(copies, 200));
        const dim = THERMAL_DIMENSIONS[thermalSize];

        // Construir contenido de cada etiqueta (Nombre ARRIBA -> QR en MEDIO -> "¡ESCANÉAME!" ABAJO)
        const renderLabelHtml = (isCard = false) => `
            <div class="${isCard ? 'sticker-card' : 'sticker-thermal'}">
                <div class="prod-title">${escapeHtml(product.name)}</div>
                <img class="prod-qr" src="${qrDataUrl}" alt="QR" />
                <div class="prod-bottom">
                    <div class="scan-me">¡ESCANÉAME!</div>
                    ${showPrice && formattedPrice ? `<div class="prod-price">${formattedPrice}</div>` : ''}
                    ${showBarcode && rawCode ? `<div class="prod-code">${escapeHtml(rawCode)}</div>` : ''}
                </div>
            </div>
        `;

        let bodyHtml = '';
        let styleHtml = '';

        if (printerType === 'thermal') {
            // Estilo Térmico (rollo de stickers)
            styleHtml = `
                @page {
                    size: ${dim.widthMm}mm ${dim.heightMm}mm;
                    margin: 0;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                html, body {
                    width: ${dim.widthMm}mm;
                    height: ${dim.heightMm}mm;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .sticker-thermal {
                    width: ${dim.widthMm}mm;
                    height: ${dim.heightMm}mm;
                    max-width: ${dim.widthMm}mm;
                    max-height: ${dim.heightMm}mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    text-align: center;
                    padding: 1.5mm 1.5mm 1.2mm 1.5mm;
                    page-break-after: always;
                    break-after: page;
                    overflow: hidden;
                }
                .sticker-thermal:last-child {
                    page-break-after: auto;
                    break-after: auto;
                }
                .prod-title {
                    font-size: ${dim.titlePt}pt;
                    font-weight: 800;
                    line-height: 1.1;
                    color: #000;
                    max-height: 2.2em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    width: 100%;
                    text-transform: uppercase;
                }
                .prod-qr {
                    width: ${dim.qrSizeMm}mm;
                    height: ${dim.qrSizeMm}mm;
                    image-rendering: pixelated;
                    margin: auto 0;
                    display: block;
                }
                .prod-bottom {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.3mm;
                }
                .scan-me {
                    font-size: ${dim.scanPt}pt;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    color: #000;
                    text-transform: uppercase;
                    line-height: 1;
                }
                .prod-price {
                    font-size: ${dim.scanPt + 0.5}pt;
                    font-weight: 800;
                    color: #000;
                    line-height: 1.1;
                }
                .prod-code {
                    font-size: ${Math.max(6, dim.scanPt - 1)}pt;
                    font-family: monospace;
                    font-weight: 700;
                    color: #222;
                    line-height: 1;
                }
            `;

            let items = '';
            for (let i = 0; i < count; i++) {
                items += renderLabelHtml(false);
            }
            bodyHtml = items;
        } else {
            // Estilo Impresora Convencional (Hoja A4 / Carta con grilla de corte punteada)
            styleHtml = `
                @page {
                    size: A4 portrait;
                    margin: 8mm;
                }
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .sheet-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 3.5mm;
                    width: 100%;
                }
                .sticker-card {
                    border: 1px dashed #64748b;
                    border-radius: 4px;
                    height: 38mm;
                    padding: 1.8mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    text-align: center;
                    overflow: hidden;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    background: #fff;
                }
                .prod-title {
                    font-size: 8.5pt;
                    font-weight: 800;
                    line-height: 1.1;
                    color: #000;
                    max-height: 2.2em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    width: 100%;
                    text-transform: uppercase;
                }
                .prod-qr {
                    width: 18mm;
                    height: 18mm;
                    image-rendering: pixelated;
                    margin: auto 0;
                    display: block;
                }
                .prod-bottom {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.3mm;
                }
                .scan-me {
                    font-size: 7.5pt;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    color: #000;
                    text-transform: uppercase;
                    line-height: 1;
                }
                .prod-price {
                    font-size: 8pt;
                    font-weight: 800;
                    color: #000;
                    line-height: 1.1;
                }
                .prod-code {
                    font-size: 6.5pt;
                    font-family: monospace;
                    font-weight: 700;
                    color: #222;
                    line-height: 1;
                }
            `;

            let items = '';
            for (let i = 0; i < count; i++) {
                items += renderLabelHtml(true);
            }
            bodyHtml = `<div class="sheet-grid">${items}</div>`;
        }

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Etiquetas - ${escapeHtml(product.name)}</title>
                <style>${styleHtml}</style>
            </head>
            <body>
                ${bodyHtml}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.focus();
                            window.print();
                        }, 150);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();

        // Limpieza del iframe tras imprimir
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 3000);
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-xl p-5 sm:p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-y-auto max-h-[92vh]">
                <DialogHeader className="p-0 border-0 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-lg font-black text-slate-900 truncate">
                                Impresión de Stickers y QR
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 truncate max-w-sm">
                                {product.name}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Panel de Vista Previa de la Etiqueta */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                            Vista Previa de la Etiqueta
                        </span>

                        <div className="w-52 min-h-[170px] bg-white border border-slate-300 rounded-lg p-2.5 shadow-sm flex flex-col items-center justify-between text-center select-none">
                            {/* ARRIBA: Nombre del producto */}
                            <p className="text-[11px] font-black uppercase text-slate-900 leading-tight line-clamp-2 w-full">
                                {product.name}
                            </p>

                            {/* CENTRO: Código QR */}
                            <div className="my-1.5 flex items-center justify-center">
                                {qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt={`QR ${product.name}`}
                                        className="w-24 h-24 object-contain"
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                ) : (
                                    <div className="w-24 h-24 flex items-center justify-center text-xs text-slate-400">
                                        Generando...
                                    </div>
                                )}
                            </div>

                            {/* ABAJO: ¡ESCANÉAME! + Datos */}
                            <div className="w-full flex flex-col items-center gap-0.5">
                                <span className="text-[10px] font-black text-indigo-600 tracking-wider">
                                    ¡ESCANÉAME!
                                </span>
                                {showPrice && formattedPrice && (
                                    <span className="text-[11px] font-extrabold text-slate-900 leading-none">
                                        {formattedPrice}
                                    </span>
                                )}
                                {showBarcode && rawCode && (
                                    <span className="text-[9px] font-mono font-bold text-slate-500 leading-none truncate max-w-[170px]">
                                        {rawCode}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controles de Configuración de Impresión */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3.5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <Sliders className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Ajustes de Impresión
                            </span>
                        </div>

                        {/* Tipo de Impresora */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                Tipo de Impresora
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPrinterType('thermal')}
                                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-0.5 ${
                                        printerType === 'thermal'
                                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-extrabold">Térmica (Stickers/Rollo)</span>
                                    <span className="text-[10px] font-medium text-slate-500">
                                        Etiquetas adhesivas individuales
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrinterType('standard')}
                                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-0.5 ${
                                        printerType === 'standard'
                                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-extrabold">Normal (A4 / Carta)</span>
                                    <span className="text-[10px] font-medium text-slate-500">
                                        Hoja completa con guías de corte
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Medida si es Térmica */}
                        {printerType === 'thermal' && (
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                    Medida del Sticker
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(THERMAL_DIMENSIONS) as ThermalSize[]).map((sizeKey) => {
                                        const opt = THERMAL_DIMENSIONS[sizeKey];
                                        return (
                                            <button
                                                key={sizeKey}
                                                type="button"
                                                onClick={() => setThermalSize(sizeKey)}
                                                className={`py-1.5 px-2 rounded-xl border text-xs font-bold text-center transition-all ${
                                                    thermalSize === sizeKey
                                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>{sizeKey} mm</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cantidad de Copias */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <div>
                                <span className="text-xs font-bold text-slate-700 block">
                                    Cantidad de Etiquetas
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {printerType === 'thermal'
                                        ? 'Copias a imprimir en el rollo'
                                        : 'Etiquetas a ubicar en la hoja'}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCopies((c) => Math.max(1, c - 1))}
                                    className="h-8 w-8 p-0 rounded-lg text-slate-600"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={copies}
                                    onChange={(e) => setCopies(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                                    className="w-14 h-8 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCopies((c) => Math.min(200, c + 1))}
                                    className="h-8 w-8 p-0 rounded-lg text-slate-600"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </Button>

                                <div className="flex gap-1 ml-1">
                                    {[1, 5, 10, 20].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setCopies(preset)}
                                            className={`text-[10px] font-bold px-1.5 py-1 rounded-md border ${
                                                copies === preset
                                                    ? 'bg-slate-800 text-white border-slate-800'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Toggles de Contenido */}
                        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-100 text-xs">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-semibold select-none">
                                <input
                                    type="checkbox"
                                    checked={showPrice}
                                    onChange={(e) => setShowPrice(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>Mostrar Precio</span>
                            </label>

                            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-semibold select-none">
                                <input
                                    type="checkbox"
                                    checked={showBarcode}
                                    onChange={(e) => setShowBarcode(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>Mostrar Código</span>
                            </label>
                        </div>
                    </div>

                    {/* Enlace al Catálogo si existe */}
                    {catalogSlug && (
                        <div className="w-full bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between gap-2">
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

                    {/* Botones de Acción */}
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
                            Imprimir {copies > 1 ? `(${copies})` : 'Etiqueta'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
