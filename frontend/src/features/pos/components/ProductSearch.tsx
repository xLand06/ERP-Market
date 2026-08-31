import React, { useState, useCallback } from 'react';
import { Search, Barcode, Package, Loader2, Camera } from 'lucide-react';
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

function StockBadge({ stock, unit }: { stock: number; unit: string }) {
    const v = stock < 5 ? 'destructive' : stock < 12 ? 'warning' : 'success';
    const label = `${stock.toFixed(unit === 'UNIDAD' ? 0 : 2)} ${unit}`;
    return <Badge variant={v}>{label}</Badge>;
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
    const { fmtCOP, fromCOP } = useConfigStore();
    const [flash, setFlash] = useState(false);

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
                'flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-200 group relative h-full min-h-[150px] w-full',
                'hover:border-emerald-400 hover:shadow-md hover:-translate-y-1 active:scale-[0.98]',
                flash ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-slate-200 bg-white',
                product.stock === 0 && 'opacity-40 cursor-not-allowed hover:border-slate-200 hover:shadow-none hover:translate-y-0'
            )}
        >
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                <Package className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-all group-hover:scale-110" />
            </div>
            <div className="flex flex-col flex-1 min-w-0 w-full">
                <p className="text-[12px] font-bold text-slate-800 line-clamp-2 leading-tight mb-2 h-8">{product.name}</p>
                <div className="mt-auto pt-2 border-t border-slate-50 space-y-2">
                    <p className="text-sm font-black text-slate-900 tabular-nums leading-none">
                        {fmtCOP(isSaleMode ? product.price : product.cost)}
                        {!isSaleMode && <span className="text-[10px] text-slate-400 font-normal ml-1">Costo</span>}
                    </p>
                    <div className="flex items-center justify-between gap-1.5">
                        {product.presentations.length > 0 ? (
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
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

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 content-start">
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