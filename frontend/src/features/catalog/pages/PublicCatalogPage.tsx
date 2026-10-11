// =============================================================================
// PUBLIC CATALOG PAGE — Catálogo digital público con Multi-moneda,
// Escáner QR de Cámara y Modal Detalle de Producto.
// =============================================================================

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
    Loader2, PackageX, Search, Store, QrCode, Coins, X, 
    Sparkles, ArrowRight, Layers, Tag, Check, Info, Clock, MapPin,
    Sun, Moon, ShoppingBag, Eye, Share2, PhoneCall
} from 'lucide-react';
import { catalogApi } from '@/services/catalog.service';
import type { CatalogGroup, CatalogProduct, CatalogPresentation, SocialLinks } from '@/services/catalog.service';
import { CameraBarcodeScannerModal } from '@/components/scanner/CameraBarcodeScannerModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

// ─── Conversión y Formato de Precios ──────────────────────────────────────────
const convertCatalogPrice = (
    basePrice: number,
    baseCurrency: string,
    targetCurrency: string,
    rates: Record<string, number> = {}
): number => {
    if (baseCurrency === targetCurrency) return basePrice;
    
    const getRate = (code: string) => {
        if (code === baseCurrency) return 1;
        if (baseCurrency === 'USD') {
            if (code === 'VES') return rates['VES'] || 5.5;
            if (code === 'COP') return rates['USD'] || rates['COP'] || 3600;
        }
        return rates[code] || 1;
    };

    let amountInBase = basePrice;
    if (baseCurrency !== 'USD' && targetCurrency === 'USD') {
        const rFrom = getRate(baseCurrency);
        amountInBase = rFrom > 0 ? basePrice / rFrom : basePrice;
        return amountInBase;
    }

    const rate = getRate(targetCurrency);
    return basePrice * rate;
};

const formatCurrencyPrice = (value: number, currency: string): string => {
    try {
        const locale = currency === 'VES' ? 'es-VE' : currency === 'COP' ? 'es-CO' : 'en-US';
        const decimals = currency === 'COP' ? 0 : 2;
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    } catch {
        return `${currency} ${value.toFixed(2)}`;
    }
};

// ─── Iconos sociales SVG ──────────────────────────────────────────────────────
const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const InstagramIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
);

const FacebookIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const toExternalUrl = (value: string, kind: 'whatsapp' | 'instagram' | 'facebook'): string => {
    if (/^https?:\/\//i.test(value)) return value;
    if (kind === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
    return `https://${value}`;
};

// ─── Modal Detalle de Producto ────────────────────────────────────────────────
interface ProductDetailModalProps {
    open: boolean;
    onClose: () => void;
    product: CatalogProduct | null;
    currency: string;
    baseCurrency: string;
    rates: Record<string, number>;
    isDark: boolean;
    whatsappNumber?: string;
}

function ProductDetailModal({ open, onClose, product, currency, baseCurrency, rates, isDark, whatsappNumber }: ProductDetailModalProps) {
    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    if (!product) return null;

    const hasPresentations = product.presentations.length > 0;
    const activePresentation = hasPresentations
        ? product.presentations.find(p => p.id === selectedPresId) ?? product.presentations[0]
        : null;

    const rawPrice = activePresentation ? activePresentation.price : product.price;
    const finalPrice = convertCatalogPrice(rawPrice, baseCurrency, currency, rates);
    const showImage = !!product.imageUrl && !imgError;

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: product.name,
                text: `Mira ${product.name} en el catálogo: ${formatCurrencyPrice(finalPrice, currency)}`,
                url: window.location.href,
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Enlace copiado al portapapeles');
        }
    };

    const handleWhatsAppConsult = () => {
        if (!whatsappNumber) return;
        const phone = whatsappNumber.replace(/\D/g, '');
        const message = `¡Hola! Me interesa este producto de su catálogo:%0A*${product.name}*%0A${activePresentation ? `Presentación: ${activePresentation.name}%0A` : ''}Precio: ${formatCurrencyPrice(finalPrice, currency)}`;
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className={`max-w-lg p-0 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] transition-colors border ${
                isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-100' 
                    : 'bg-white border-slate-200 text-slate-900'
            }`}>
                <div className={`relative aspect-video sm:aspect-4/3 flex items-center justify-center overflow-hidden shrink-0 group ${
                    isDark ? 'bg-slate-950' : 'bg-slate-100'
                }`}>
                    {showImage ? (
                        <img
                            src={product.imageUrl!}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className={`flex flex-col items-center justify-center gap-2 ${
                            isDark ? 'text-slate-600' : 'text-slate-300'
                        }`}>
                            <Store className="w-16 h-16" />
                            <span className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                Sin imagen disponible
                            </span>
                        </div>
                    )}
                    
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow border border-white/10">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{product.barcode ? `Cód: ${product.barcode}` : 'Disponible'}</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleShare}
                        aria-label="Compartir producto"
                        className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 p-2 rounded-full shadow-md backdrop-blur hover:scale-110 active:scale-95 transition-all cursor-pointer"
                        title="Compartir enlace"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <div className="flex items-start justify-between gap-2">
                            <h2 className={`text-xl sm:text-2xl font-black leading-snug tracking-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                            }`}>
                                {product.name}
                            </h2>
                        </div>
                        {product.description ? (
                            <p className={`text-sm mt-2 leading-relaxed whitespace-pre-line ${
                                isDark ? 'text-slate-300' : 'text-slate-600'
                            }`}>
                                {product.description}
                            </p>
                        ) : (
                            <p className={`text-xs italic mt-1 ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                                Sin descripción adicional
                            </p>
                        )}
                    </div>

                    {/* Presentaciones */}
                    {hasPresentations && (
                        <div className={`rounded-2xl p-4 space-y-2.5 border ${
                            isDark 
                                ? 'bg-slate-950/60 border-slate-800' 
                                : 'bg-slate-50 border-slate-200/80'
                        }`}>
                            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                Presentaciones Disponibles:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {product.presentations.map(pres => {
                                    const isSelected = activePresentation?.id === pres.id;
                                    const presConverted = convertCatalogPrice(pres.price, baseCurrency, currency, rates);
                                    return (
                                        <button
                                            key={pres.id}
                                            type="button"
                                            onClick={() => setSelectedPresId(pres.id)}
                                            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                    : isDark
                                                        ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-indigo-400 hover:bg-slate-750'
                                                        : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate">{pres.name}</p>
                                                <p className={`text-[11px] ${
                                                    isSelected 
                                                        ? 'text-indigo-100' 
                                                        : isDark ? 'text-slate-400' : 'text-slate-500'
                                                }`}>
                                                    x{pres.multiplier} unid.
                                                </p>
                                            </div>
                                            <span className="text-xs font-black tabular-nums shrink-0">
                                                {formatCurrencyPrice(presConverted, currency)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Precio y Botón de Consulta WhatsApp */}
                    <div className="space-y-3 mt-auto pt-2">
                        <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl flex items-center justify-between shadow-lg border border-slate-800">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Precio {activePresentation ? `(${activePresentation.name})` : ''}
                                </span>
                                <p className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">
                                    {formatCurrencyPrice(finalPrice, currency)}
                                </p>
                            </div>
                            <span className="text-xs font-black px-3 py-1.5 bg-white/10 text-white rounded-xl border border-white/10">
                                {currency}
                            </span>
                        </div>

                        {whatsappNumber && (
                            <button
                                type="button"
                                onClick={handleWhatsAppConsult}
                                className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-sm"
                            >
                                <WhatsAppIcon className="w-5 h-5" />
                                <span>Consultar o Pedir por WhatsApp</span>
                            </button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Tarjeta de producto en catálogo ──────────────────────────────────────────
function ProductCard({
    product,
    currency,
    baseCurrency,
    rates,
    isDark,
    onSelect,
}: {
    product: CatalogProduct;
    currency: string;
    baseCurrency: string;
    rates: Record<string, number>;
    isDark: boolean;
    onSelect: () => void;
}) {
    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    const hasPresentations = product.presentations.length > 0;
    const activePresentation = hasPresentations
        ? product.presentations.find(p => p.id === selectedPresId) ?? product.presentations[0]
        : null;

    const rawPrice = activePresentation ? activePresentation.price : product.price;
    const convertedPrice = convertCatalogPrice(rawPrice, baseCurrency, currency, rates);
    const showImage = !!product.imageUrl && !imgError;

    return (
        <div 
            onClick={onSelect}
            className={`catalog-card-glow group rounded-3xl border overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] ${
                isDark 
                    ? 'bg-slate-900/90 border-slate-800/80 hover:border-indigo-500/50' 
                    : 'bg-white border-slate-200/80 hover:border-indigo-300'
            }`}
        >
            {/* Imagen del Producto */}
            <div className={`aspect-square flex items-center justify-center overflow-hidden relative ${
                isDark ? 'bg-slate-950' : 'bg-slate-100/80'
            }`}>
                {showImage ? (
                    <img
                        src={product.imageUrl!}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                        isDark ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                        <Store className="w-10 h-10 group-hover:text-indigo-400 group-hover:scale-110 transition-all" />
                        <span className="text-[10px] font-semibold opacity-60">Sin foto</span>
                    </div>
                )}

                {/* Badges superiores */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    {product.barcode ? (
                        <span className="bg-slate-950/75 backdrop-blur text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border border-white/10 shadow-sm">
                            {product.barcode}
                        </span>
                    ) : <span />}

                    {hasPresentations && (
                        <span className="bg-indigo-600/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                            {product.presentations.length} var.
                        </span>
                    )}
                </div>

                {/* Botón flotante para ver detalle al pasar el mouse */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-bold py-1.5 px-3 rounded-full shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                        Ver detalles
                    </span>
                </div>
            </div>

            {/* Contenido de la Tarjeta */}
            <div className="p-3.5 sm:p-4 flex flex-col gap-2 flex-1">
                <div>
                    <h3 className={`text-sm sm:text-base font-extrabold leading-snug line-clamp-2 transition-colors ${
                        isDark 
                            ? 'text-slate-100 group-hover:text-indigo-400' 
                            : 'text-slate-900 group-hover:text-indigo-600'
                    }`}>
                        {product.name}
                    </h3>

                    {product.description ? (
                        <p className={`text-xs line-clamp-2 mt-1 leading-relaxed ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                            {product.description}
                        </p>
                    ) : null}
                </div>

                {/* Presentaciones en píldoras */}
                {hasPresentations ? (
                    <div 
                        className={`flex flex-wrap gap-1 pt-1.5 mt-auto border-t ${
                            isDark ? 'border-slate-800' : 'border-slate-100'
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        {product.presentations.map(pres => {
                            const isSelected = activePresentation?.id === pres.id;
                            return (
                                <button
                                    key={pres.id}
                                    type="button"
                                    onClick={() => setSelectedPresId(pres.id)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : isDark
                                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {pres.name}
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                {/* Precios */}
                <div className="pt-2 flex items-baseline justify-between gap-1 border-t border-dashed border-slate-200 dark:border-slate-800">
                    <div>
                        <p className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${
                            isDark ? 'text-emerald-400' : 'text-slate-950'
                        }`}>
                            {formatCurrencyPrice(convertedPrice, currency)}
                        </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {currency}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal de Catálogo ─────────────────────────────────────────────
export default function PublicCatalogPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryParamQ = searchParams.get('q') || '';

    // Manejo exclusivo de Modo Claro / Oscuro para el catálogo
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('catalog_theme_mode');
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const isDark = themeMode === 'dark';

    // Aislar la página de los estilos agresivos globales `html.theme-dark` del ERP
    useEffect(() => {
        const root = document.documentElement;
        const prevClasses = root.className;
        const prevDataTheme = root.getAttribute('data-theme');

        root.className = isDark ? 'catalog-view dark' : 'catalog-view';
        root.setAttribute('data-theme', isDark ? 'catalog-dark' : 'catalog-light');

        return () => {
            root.className = prevClasses;
            if (prevDataTheme) {
                root.setAttribute('data-theme', prevDataTheme);
            } else {
                root.removeAttribute('data-theme');
            }
        };
    }, [isDark]);

    const toggleTheme = () => {
        const nextMode = themeMode === 'light' ? 'dark' : 'light';
        setThemeMode(nextMode);
        localStorage.setItem('catalog_theme_mode', nextMode);
    };

    const [search, setSearch] = useState(queryParamQ);
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [detailProduct, setDetailProduct] = useState<CatalogProduct | null>(null);

    const { data, isPending, isError } = useQuery({
        queryKey: ['public-catalog', slug],
        queryFn: () => catalogApi.getBySlug(slug!),
        enabled: !!slug,
        retry: false,
    });

    // Moneda base del backend y lista de monedas activas
    const baseCurrency = data?.mainCurrency || 'USD';
    const activeCurrencies = data?.activeCurrencies && data?.activeCurrencies.length > 0
        ? data?.activeCurrencies
        : ['USD', 'VES', 'COP'];
    const rates = data?.exchangeRates || {};

    // Sincronizar moneda por defecto si la base está presente
    useEffect(() => {
        if (data?.mainCurrency && !selectedCurrency) {
            setSelectedCurrency(data.mainCurrency);
        }
    }, [data?.mainCurrency]);

    // Si viene con query param ?q=... en la URL, auto-seleccionar si coincide exactamente con un producto
    useEffect(() => {
        if (!data || !queryParamQ) return;
        const normalized = queryParamQ.trim().toLowerCase();
        for (const g of data.groups) {
            for (const p of g.products) {
                if (
                    p.barcode?.toLowerCase() === normalized ||
                    p.id.toLowerCase() === normalized ||
                    p.presentations.some(pr => pr.barcode?.toLowerCase() === normalized)
                ) {
                    setDetailProduct(p);
                    return;
                }
            }
        }
    }, [data, queryParamQ]);

    // Conteo total de productos
    const totalProductsCount = useMemo(() => {
        if (!data) return 0;
        return data.groups.reduce((acc, g) => acc + g.products.length, 0);
    }, [data]);

    // Filtro por término y categoría seleccionada
    const filteredGroups = useMemo<CatalogGroup[]>(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        
        let groups = data.groups;
        if (selectedCategory !== 'all') {
            groups = groups.filter(g => g.id === selectedCategory);
        }

        if (!term) return groups;

        return groups
            .map(group => ({
                ...group,
                products: group.products.filter(p =>
                    p.name.toLowerCase().includes(term) ||
                    (p.barcode && p.barcode.toLowerCase().includes(term)) ||
                    (p.description && p.description.toLowerCase().includes(term)) ||
                    p.presentations.some(pres => 
                        pres.name.toLowerCase().includes(term) ||
                        (pres.barcode && pres.barcode.toLowerCase().includes(term))
                    )
                ),
            }))
            .filter(group => group.products.length > 0);
    }, [data, search, selectedCategory]);

    // Manejar escaneo desde cámara QR / Barras
    const handleScan = (scannedCode: string) => {
        setScannerOpen(false);
        const code = scannedCode.trim();
        setSearch(code);

        if (data) {
            const normalized = code.toLowerCase();
            for (const g of data.groups) {
                for (const p of g.products) {
                    if (
                        p.barcode?.toLowerCase() === normalized ||
                        p.id.toLowerCase() === normalized ||
                        p.name.toLowerCase().includes(normalized) ||
                        p.presentations.some(pr => pr.barcode?.toLowerCase() === normalized)
                    ) {
                        setDetailProduct(p);
                        return;
                    }
                }
            }
        }
    };

    const renderSocialLinks = (social: SocialLinks) => {
        const links: Array<{ href: string; label: string; icon: React.ReactNode; color: string }> = [];
        if (social.whatsapp) {
            links.push({ href: toExternalUrl(social.whatsapp, 'whatsapp'), label: 'WhatsApp', icon: <WhatsAppIcon />, color: 'bg-[#25D366]' });
        }
        if (social.instagram) {
            links.push({ href: toExternalUrl(social.instagram, 'instagram'), label: 'Instagram', icon: <InstagramIcon />, color: 'bg-[#E4405F]' });
        }
        if (social.facebook) {
            links.push({ href: toExternalUrl(social.facebook, 'facebook'), label: 'Facebook', icon: <FacebookIcon />, color: 'bg-[#1877F2]' });
        }
        if (links.length === 0) return null;
        return (
            <div className="flex items-center gap-2">
                {links.map(link => (
                    <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        className={`${link.color} text-white p-2.5 rounded-full shadow-md hover:scale-110 active:scale-95 transition-all`}
                    >
                        {link.icon}
                    </a>
                ))}
            </div>
        );
    };

    if (isError) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-6 ${
                isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
            }`}>
                <div className="text-center max-w-sm">
                    <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                        isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-400'
                    }`}>
                        <PackageX className="w-8 h-8" />
                    </div>
                    <h1 className="text-lg font-black mb-1">Catálogo no disponible</h1>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Verifica el enlace o contacta directamente al negocio.
                    </p>
                </div>
            </div>
        );
    }

    if (isPending || !data) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${
                isDark ? 'bg-slate-950' : 'bg-slate-50'
            }`}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                    <span className="text-xs font-bold text-slate-400">Cargando catálogo...</span>
                </div>
            </div>
        );
    }

    const isEmpty = filteredGroups.length === 0;

    return (
        <div className={`catalog-root min-h-screen flex flex-col transition-colors duration-200 ${
            isDark ? 'catalog-mode-dark bg-slate-950 text-slate-100' : 'catalog-mode-light bg-slate-50/70 text-slate-900'
        }`}>
            {/* ─── Hero Header Premium ─── */}
            <header className={`border-b shadow-xs overflow-hidden transition-colors ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
            }`}>
                {/* Banner superior opcional */}
                {data.bannerUrl ? (
                    <div className="w-full h-44 sm:h-64 md:h-72 bg-slate-800 overflow-hidden relative">
                        <img
                            src={data.bannerUrl}
                            alt="Banner de la tienda"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                    </div>
                ) : (
                    <div className={`w-full h-24 sm:h-36 md:h-44 relative overflow-hidden transition-colors ${
                        isDark 
                            ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900' 
                            : 'bg-gradient-to-r from-slate-200 via-indigo-50 to-slate-200 border-b border-slate-200/80'
                    }`}>
                        <div className={`absolute inset-0 opacity-20 ${
                            isDark 
                                ? 'bg-[radial-gradient(#818cf8_1px,transparent_1px)]' 
                                : 'bg-[radial-gradient(#6366f1_1px,transparent_1px)]'
                        } [background-size:20px_20px]`} />
                        {isDark && <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />}
                    </div>
                )}

                <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
                    {/* Contenedor principal de Identidad del Negocio */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 relative z-10">
                        {/* Logo + Textos con jerarquía clara y limpia */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
                            {/* Logo flotante sobre el banner */}
                            <div className="-mt-12 sm:-mt-16 shrink-0 relative z-20">
                                {data.logoUrl ? (
                                    <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 shadow-xl overflow-hidden flex items-center justify-center p-2 ${
                                        isDark ? 'bg-slate-900 border-slate-900 shadow-black/50' : 'bg-white border-white shadow-slate-200'
                                    }`}>
                                        <img
                                            src={data.logoUrl}
                                            alt={data.businessName}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 shadow-xl flex items-center justify-center ${
                                        isDark 
                                            ? 'bg-indigo-950 border-slate-900 text-indigo-400 shadow-black/50' 
                                            : 'bg-indigo-600 border-white text-white shadow-slate-200'
                                    }`}>
                                        <Store className="w-12 h-12" />
                                    </div>
                                )}
                            </div>

                            {/* Nombre, Badge de Catálogo, RIF y Productos (permanece 100% sobre el fondo del header) */}
                            <div className="flex flex-col items-center sm:items-start gap-2 pt-2 sm:pt-3 pb-1">
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                    <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                                        isDark ? 'text-white' : 'text-slate-950'
                                    }`}>
                                        {data.businessName}
                                    </h1>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border shrink-0 ${
                                        isDark 
                                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60' 
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    }`}>
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        Catálogo Oficial
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                                    {data.taxId && (
                                        <span className={`font-bold px-2.5 py-1 rounded-lg border ${
                                            isDark 
                                                ? 'bg-slate-800/90 text-slate-100 border-slate-700' 
                                                : 'bg-slate-100 text-slate-800 border-slate-200'
                                        }`}>
                                            RIF: {data.taxId}
                                        </span>
                                    )}
                                    <span className={`font-black flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                                        isDark 
                                            ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50' 
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}>
                                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                                        {totalProductsCount} {totalProductsCount === 1 ? 'producto activo' : 'productos activos'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Redes Sociales */}
                        <div className="flex justify-center sm:justify-end pt-2 sm:pt-0 pb-1 shrink-0">
                            {renderSocialLinks(data.socialLinks)}
                        </div>
                    </div>

                    {/* Descripción Comercial */}
                    {data.description && (
                        <p className={`text-xs sm:text-sm mt-4 pt-3 border-t max-w-3xl leading-relaxed text-center sm:text-left ${
                            isDark ? 'border-slate-800 text-slate-200' : 'border-slate-200 text-slate-700'
                        }`}>
                            {data.description}
                        </p>
                    )}

                    {/* Horarios y Dirección con Badges limpios y legibles */}
                    {(data.schedule || data.address) && (
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3 pt-1 text-xs">
                            {data.schedule && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                                    isDark 
                                        ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
                                        : 'bg-slate-100 border-slate-200 text-slate-800'
                                }`}>
                                    <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>{data.schedule}</span>
                                </div>
                            )}
                            {data.address && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold ${
                                    isDark 
                                        ? 'bg-slate-800/80 border-slate-700 text-slate-100' 
                                        : 'bg-slate-100 border-slate-200 text-slate-800'
                                }`}>
                                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>{data.address}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* ─── Barra Flotante Sticky: Buscador + QR + Moneda + Tema ─── */}
            <div className={`sticky top-0 z-30 backdrop-blur-xl border-b shadow-sm transition-colors ${
                isDark 
                    ? 'bg-slate-900/90 border-slate-800/90' 
                    : 'bg-white/90 border-slate-200/90'
            }`}>
                <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                    {/* Input de Búsqueda + Botón de Escáner QR */}
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1">
                            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar productos, marcas o códigos..."
                                className={`w-full pl-10 pr-9 py-2.5 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                    isDark 
                                        ? 'border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900' 
                                        : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:bg-white'
                                }`}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${
                                        isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Botón de Escaneo con Cámara */}
                        <Button
                            type="button"
                            onClick={() => setScannerOpen(true)}
                            className="h-10 px-3.5 sm:px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 shrink-0 shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer"
                            title="Escanear código QR o barras"
                        >
                            <QrCode className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">Escanear</span>
                        </Button>
                    </div>

                    {/* Controles de Vista: Tema y Selector de Moneda */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {/* Selector de Modo Claro / Oscuro */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
                            title={`Modo ${isDark ? 'Claro' : 'Oscuro'}`}
                            className={`p-2 sm:px-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                                isDark 
                                    ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-750' 
                                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {isDark ? (
                                <>
                                    <Sun className="w-4 h-4 text-amber-400" />
                                    <span className="hidden md:inline text-[11px]">Claro</span>
                                </>
                            ) : (
                                <>
                                    <Moon className="w-4 h-4 text-indigo-600" />
                                    <span className="hidden md:inline text-[11px]">Oscuro</span>
                                </>
                            )}
                        </button>

                        {/* Selector de Moneda */}
                        <div className={`flex items-center gap-1 p-1 rounded-2xl border ${
                            isDark 
                                ? 'bg-slate-950 border-slate-800' 
                                : 'bg-slate-100 border-slate-200/80'
                        }`}>
                            <span className={`text-[11px] font-bold pl-2 pr-1 hidden xs:inline flex items-center gap-1 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                                <Coins className="w-3.5 h-3.5 text-indigo-400" /> Moneda:
                            </span>
                            {activeCurrencies.map(curr => {
                                const isCurrSelected = selectedCurrency === curr;
                                return (
                                    <button
                                        key={curr}
                                        type="button"
                                        onClick={() => setSelectedCurrency(curr)}
                                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                            isCurrSelected
                                                ? isDark
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                                                : isDark
                                                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ─── Píldoras de Categorías Horizontales ─── */}
                {data.groups.length > 1 && (
                    <div className="max-w-5xl mx-auto px-4 pb-2.5 overflow-x-auto no-scrollbar flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                                selectedCategory === 'all'
                                    ? isDark
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-900 text-white shadow-xs'
                                    : isDark
                                        ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todas ({totalProductsCount})
                        </button>
                        {data.groups.map(group => {
                            const isCatSelected = selectedCategory === group.id;
                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(group.id)}
                                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                                        isCatSelected
                                            ? isDark
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-900 text-white shadow-xs'
                                            : isDark
                                                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {group.name} ({group.products.length})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Listado Principal de Productos ─── */}
            <main className="max-w-5xl mx-auto px-4 py-8 pb-24 flex-1 w-full">
                {isEmpty ? (
                    <div className={`text-center py-20 rounded-3xl border p-8 ${
                        isDark 
                            ? 'bg-slate-900/80 border-slate-800' 
                            : 'bg-white border-slate-200'
                    }`}>
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${
                            isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'
                        }`}>
                            <PackageX className="w-8 h-8" />
                        </div>
                        <h3 className={`text-lg font-bold mb-1 ${
                            isDark ? 'text-white' : 'text-slate-800'
                        }`}>
                            {search ? 'Sin coincidencias' : 'No hay productos en esta sección'}
                        </h3>
                        <p className={`text-xs max-w-sm mx-auto ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                            {search 
                                ? `No encontramos productos para "${search}". Intenta con otra palabra clave.`
                                : 'Pronto se añadirán nuevos artículos.'}
                        </p>
                        {(search || selectedCategory !== 'all') && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                                className={`mt-5 rounded-2xl text-xs font-bold cursor-pointer ${
                                    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : ''
                                }`}
                            >
                                Restablecer filtros
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-12">
                        {filteredGroups.map(group => (
                            <section key={group.id} aria-label={group.name} className="space-y-4">
                                <div className={`flex items-center justify-between border-b pb-3 ${
                                    isDark ? 'border-slate-800' : 'border-slate-200'
                                }`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm" />
                                        <h2 className={`text-base sm:text-lg font-black tracking-tight ${
                                            isDark ? 'text-slate-100' : 'text-slate-900'
                                        }`}>
                                            {group.name}
                                        </h2>
                                    </div>
                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                        isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {group.products.length} {group.products.length === 1 ? 'artículo' : 'artículos'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                                    {group.products.map(product => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            currency={selectedCurrency}
                                            baseCurrency={baseCurrency}
                                            rates={rates}
                                            isDark={isDark}
                                            onSelect={() => setDetailProduct(product)}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal de Detalle de Producto al hacer clic o escanear */}
            <ProductDetailModal
                open={!!detailProduct}
                onClose={() => setDetailProduct(null)}
                product={detailProduct}
                currency={selectedCurrency}
                baseCurrency={baseCurrency}
                rates={rates}
                isDark={isDark}
                whatsappNumber={data.socialLinks?.whatsapp}
            />

            {/* Escáner de Código de Barras / QR con la Cámara */}
            <CameraBarcodeScannerModal
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleScan}
            />

            {/* Footer Elegante con Redes Sociales y Marca */}
            <footer className={`border-t py-10 transition-colors ${
                isDark 
                    ? 'border-slate-800/80 bg-slate-950' 
                    : 'border-slate-200/80 bg-white'
            }`}>
                <div className="max-w-5xl mx-auto px-4 flex flex-col items-center text-center gap-4">
                    {/* Redes Sociales en el Footer */}
                    {renderSocialLinks(data.socialLinks) && (
                        <div className="flex flex-col items-center gap-2">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                                Conecta con nosotros
                            </span>
                            <div className="flex items-center justify-center">
                                {renderSocialLinks(data.socialLinks)}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1 pt-1">
                        <p className={`text-base font-black tracking-tight ${
                            isDark ? 'text-slate-200' : 'text-slate-900'
                        }`}>
                            {data.businessName}
                        </p>
                        <p className={`text-xs max-w-md mx-auto ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                            Catálogo digital en tiempo real • Precios y disponibilidad sujetos a cambio sin previo aviso.
                        </p>
                    </div>

                    {data.address && (
                        <div className={`text-xs flex items-center gap-1.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{data.address}</span>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
}