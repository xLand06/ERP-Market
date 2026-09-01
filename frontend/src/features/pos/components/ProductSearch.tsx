import React, { useState, useCallback } from 'react';
import {
    Search, Barcode, Package, Loader2, Camera,
    Coffee, Croissant, CupSoda, Wine, Beef, Apple, Sparkles, Cookie, ShoppingBag, Store
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useProductSearch, findProductByBarcode } from '../hooks/useProductSearch';
import { CameraBarcodeScannerModal } from '@/components/scanner/CameraBarcodeScannerModal';
import toast from 'react-hot-toast';
import type { Product, ProductPresentation, InventoryItem } from '../types';

interface ProductSearchProps {
    inventory: InventoryItem[];
    isSaleMode: boolean;
    onAddToCart: (product: Product, presentation?: ProductPresentation) => boolean;
    onShowPresentations: (product: Product) => void;
    onProductNotFound?: (barcode: string) => void;
}

/**
 * Retorna el ícono y la paleta de color dinámica para cada producto/categoría.
 */
function getProductCategoryIcon(categoryName?: string, productName?: string) {
    const text = `${categoryName || ''} ${productName || ''}`.toLowerCase();

    if (text.includes('café') || text.includes('cafe') || text.includes('taza') || text.includes('cappuccino') || text.includes('latte') || text.includes('tinto') || text.includes('expresso')) {
        return {
            Icon: Coffee,
            badgeStyle: 'bg-amber-500/15 text-amber-500 border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-white',
        };
    }
    if (text.includes('pan') || text.includes('bakery') || text.includes('croissant') || text.includes('pastel') || text.includes('reposter') || text.includes('torta') || text.includes('galleta')) {
        return {
            Icon: Croissant,
            badgeStyle: 'bg-yellow-500/15 text-yellow-600 border border-yellow-500/30 group-hover:bg-yellow-500 group-hover:text-white',
        };
    }
    if (text.includes('jugo') || text.includes('refresco') || text.includes('gaseosa') || text.includes('agua') || text.includes('bebida') || text.includes('soda') || text.includes('coca') || text.includes('pepsi')) {
        return {
            Icon: CupSoda,
            badgeStyle: 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-white',
        };
    }
    if (text.includes('licor') || text.includes('cerveza') || text.includes('vino') || text.includes('ron') || text.includes('whisky') || text.includes('vodka') || text.includes('coctel')) {
        return {
            Icon: Wine,
            badgeStyle: 'bg-purple-500/15 text-purple-400 border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white',
        };
    }
    if (text.includes('carne') || text.includes('pollo') || text.includes('res') || text.includes('cerdo') || text.includes('jamón') || text.includes('jamon') || text.includes('queso') || text.includes('embutido') || text.includes('charcuter')) {
        return {
            Icon: Beef,
            badgeStyle: 'bg-rose-500/15 text-rose-500 border border-rose-500/30 group-hover:bg-rose-500 group-hover:text-white',
        };
    }
    if (text.includes('fruta') || text.includes('verdura') || text.includes('manzana') || text.includes('víveres') || text.includes('viveres') || text.includes('arroz') || text.includes('grano') || text.includes('aceite')) {
        return {
            Icon: Apple,
            badgeStyle: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white',
        };
    }
    if (text.includes('jabón') || text.includes('jabon') || text.includes('limpieza') || text.includes('aseo') || text.includes('detergente') || text.includes('shampoo') || text.includes('cloro')) {
        return {
            Icon: Sparkles,
            badgeStyle: 'bg-blue-500/15 text-blue-500 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white',
        };
    }
    if (text.includes('snack') || text.includes('dulce') || text.includes('chocolate') || text.includes('golosina') || text.includes('doritos') || text.includes('papita')) {
        return {
            Icon: Cookie,
            badgeStyle: 'bg-orange-500/15 text-orange-500 border border-orange-500/30 group-hover:bg-orange-500 group-hover:text-white',
        };
    }

    return {
        Icon: ShoppingBag,
        badgeStyle: 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-white',
    };
}

function StockBadge({ stock, unit }: { stock: number; unit: string }) {
    const v = stock < 5 ? 'destructive' : stock < 12 ? 'warning' : 'success';
    const label = `${stock.toFixed(unit === 'UNIDAD' ? 0 : 2)} ${unit}`;
    return <Badge variant={v} className="text-[10px] px-1.5 py-0.5">{label}</Badge>;
}

interface ProductCardProps {
    product: Product;
    isSaleMode: boolean;
    onAdd: (product: Product, presentation?: ProductPresentation) => boolean;
    onShowPresentations: (product: Product) => void;
}

const ProductCard = React.memo(function ProductCard({
    product,
    isSaleMode,
    onAdd,
    onShowPresentations,
}: ProductCardProps) {
    const { fmtCOP } = useConfigStore();
    const [flash, setFlash] = useState(false);
    const { Icon, badgeStyle } = getProductCategoryIcon(product.category?.name, product.name);

    const handle = useCallback(() => {
        if (product.stock === 0) return;
        if (product.presentations && product.presentations.length > 0) {
            onShowPresentations(product);
        } else {
            if (onAdd(product)) {
                setFlash(true);
                setTimeout(() => setFlash(false), 250);
            }
        }
    }, [product, onAdd, onShowPresentations]);

    return (
        <button
            onClick={handle}
            disabled={product.stock === 0}
            className={cn(
                'flex flex-col justify-between gap-2.5 p-3.5 rounded-2xl border text-left transition-all duration-200 group relative h-full min-h-[145px] sm:min-h-[160px] w-full cursor-pointer',
                'hover:border-emerald-400 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]',
                flash ? 'border-emerald-500 bg-emerald-50/80 shadow-inner' : 'border-slate-200/90 bg-white',
                product.stock === 0 && 'opacity-40 cursor-not-allowed hover:border-slate-200 hover:shadow-none hover:translate-y-0'
            )}
        >
            <div className="flex items-center justify-between gap-2 w-full">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs group-hover:scale-105", badgeStyle)}>
                    <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                </div>
                {product.category?.name && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate max-w-[80px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {product.category.name}
                    </span>
                )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 w-full justify-between">
                <p className="text-xs font-black text-slate-900 line-clamp-2 leading-tight mb-2 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                </p>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                    <p className="text-sm sm:text-base font-black text-slate-950 tabular-nums leading-none">
                        {fmtCOP(isSaleMode ? product.price : product.cost)}
                        {!isSaleMode && <span className="text-[10px] text-slate-400 font-normal ml-1">Costo</span>}
                    </p>
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        {product.presentations.length > 0 ? (
                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-md font-extrabold whitespace-nowrap">
                                {product.presentations.length} pres.
                            </span>
                        ) : <div />}
                        <StockBadge stock={product.stock} unit={product.baseUnit} />
                    </div>
                </div>
            </div>
        </button>
    );
});

export function ProductSearch({
    inventory,
    isSaleMode,
    onAddToCart,
    onShowPresentations,
}: ProductSearchProps) {
    const searchRef = React.useRef<HTMLInputElement>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const {
        search,
        setSearch,
        category,
        setCategory,
        categories,
        filteredProducts,
        isSearching,
    } = useProductSearch(inventory, isSaleMode);

    const handleCameraScan = useCallback((scannedCode: string) => {
        const allProducts = inventory.map(item => item.product).filter(Boolean) as unknown as Product[];
        const found = findProductByBarcode(filteredProducts, scannedCode) 
            || findProductByBarcode(allProducts, scannedCode);

        if (found) {
            if (found.product.stock === 0 && isSaleMode) {
                toast.error(`${found.product.name} no tiene stock disponible`);
                return;
            }
            if (found.presentation) {
                if (onAddToCart(found.product, found.presentation)) {
                    toast.success(`✓ ${found.product.name} (${found.presentation.name}) añadido`);
                }
            } else {
                if (onAddToCart(found.product)) {
                    toast.success(`✓ ${found.product.name} añadido`);
                }
            }
            setSearch('');
        } else {
            toast.error(`Código ${scannedCode} no encontrado`);
        }
    }, [inventory, filteredProducts, isSaleMode, onAddToCart, setSearch]);

    // Manejar hotkey F2 y Enter para escanear código de barras estando enfocado en el input
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'F2') {
            e.preventDefault();
            searchRef.current?.focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const term = search.trim();
            if (!term) return;

            // 1. Intentar buscar por coincidencia exacta de código de barras
            const allProducts = inventory.map(item => item.product).filter(Boolean) as unknown as Product[];
            const found = findProductByBarcode(filteredProducts, term) 
                || findProductByBarcode(allProducts, term); // fallback a todo el inventario

            if (found) {
                if (found.product.stock === 0 && isSaleMode) {
                    toast.error(`⚠️ ${found.product.name} no tiene stock disponible`);
                    return;
                }
                if (found.presentation) {
                    if (onAddToCart(found.product, found.presentation)) {
                        toast.success(`✓ ${found.product.name} (${found.presentation.name}) añadido`);
                    }
                } else {
                    if (onAddToCart(found.product)) {
                        toast.success(`✓ ${found.product.name} añadido`);
                    }
                }
                setSearch('');
                return;
            }

            // 2. Si no hay coincidencia exacta de código pero queda un solo producto filtrado
            if (filteredProducts.length === 1) {
                const prod = filteredProducts[0];
                if (prod.stock === 0 && isSaleMode) {
                    toast.error(`${prod.name} no tiene stock disponible`);
                    return;
                }
                if (prod.presentations.length > 0) {
                    onShowPresentations(prod);
                } else {
                    if (onAddToCart(prod)) {
                        toast.success(`✓ ${prod.name} añadido`);
                    }
                }
                setSearch('');
                return;
            }
        }
    }, [search, filteredProducts, inventory, onAddToCart, onShowPresentations, setSearch, isSaleMode]);

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Search Bar & Barcode Scanner Status Indicator */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2" onKeyDown={handleKeyDown}>
                <div className="relative flex-1 flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            ref={searchRef}
                            placeholder="Buscar producto por nombre o escanear código... [F2]"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-10 h-11 bg-white border-slate-200 shadow-2xs rounded-xl focus:border-indigo-500 text-sm font-medium"
                        />
                        <Barcode className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-indigo-500" />
                    </div>

                    {/* Phone/Tablet Camera Scanner Trigger Button */}
                    <Button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="h-11 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95"
                        title="Escanear con la cámara del teléfono"
                    >
                        <Camera className="w-4 h-4" />
                        <span className="text-xs hidden xs:inline sm:inline">Cámara</span>
                    </Button>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl shrink-0 self-start sm:self-auto" title="El lector de código de barras físico o cámara está listo">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-emerald-700 tracking-tight">Escáner Activo</span>
                </div>
            </div>

            {/* Camera Barcode Scanner Modal */}
            <CameraBarcodeScannerModal
                open={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onScan={handleCameraScan}
            />

            {/* Category chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar items-center">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                            'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95',
                            category === cat
                                ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20'
                                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Product grid — Responsive para Teléfonos y Tablets Horizontales */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3.5 content-start pb-4">
                {isSearching ? (
                    <div className="col-span-full h-32 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center text-slate-400 mt-10">
                        No se encontraron productos.
                    </div>
                ) : (
                    filteredProducts.map(p => (
                        <div key={p.id} className="relative group">
                            <ProductCard
                                product={p}
                                isSaleMode={isSaleMode}
                                onAdd={onAddToCart}
                                onShowPresentations={onShowPresentations}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}