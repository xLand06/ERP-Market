import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
    ShoppingCart, PackagePlus, Lock, Play, Store, Search, Barcode, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/hardware/useBarcodeScanner';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useInventory } from '@/hooks/useInventory';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useAutoOpenRegister } from '@/hooks/useAutoOpenRegister';
import { StockEntryModal } from '../../inventory/components/StockEntryModal';
import { ProductSearch } from '../components/ProductSearch';
import { CartPanel } from '../components/CartPanel';
import { PaymentDialog } from '../components/PaymentDialog';
import { TransactionSummary } from '../components/TransactionSummary';
import { useCart } from '../hooks/useCart';
import toast from 'react-hot-toast';

import type { Product, PaymentMethodType, Currency, CreateTransactionPayload } from '../types';

// ─── Main Component ────────────────────────────────────────────────
export default function POSPage() {
    const [isSaleMode, setIsSaleMode] = useState(true);
    const [payOpen, setPayOpen] = useState(false);
    const [activeProductForPres, setActiveProductForPres] = useState<Product | null>(null);
    const [stockEntryOpen, setStockEntryOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [summary, setSummary] = useState<{
        visible: boolean;
        items: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
        total: number;
        paymentMethods?: Array<{ type: string; amount: number; currency: string }>;
        type?: 'SALE' | 'INVENTORY_IN';
    }>({ visible: false, items: [], total: 0 });
    const searchRef = useRef<HTMLInputElement>(null);

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const user = useAuthStore(s => s.user);
    const queryClient = useQueryClient();

    // ── Open Register Dialog State ────────────────────────────────────
    const [openCashOpen, setOpenCashOpen] = useState(false);
    const [openCopVal, setOpenCopVal] = useState('0');
    const [openUsdVal, setOpenUsdVal] = useState('0');
    const [openVesVal, setOpenVesVal] = useState('0');

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const selectedBranchData = useMemo(() => {
        if (!selectedBranch || selectedBranch === 'all') return null;
        return branches.find((b: any) => b.id === selectedBranch);
    }, [selectedBranch, branches]);

    const { iva, fmtCOP, rates } = useConfigStore();
    const effectiveBranch = selectedBranchData?.id || (selectedBranch === 'all' && user?.role === 'OWNER' ? null : selectedBranch);

    // ── Open Register Query ──────────────────────────────────────────
    const { data: openRegister, isLoading: registerLoading, refetch: refetchRegister } = useQuery({
        queryKey: ['openRegister', effectiveBranch],
        queryFn: async () => {
            if (!effectiveBranch) return null;
            try {
                const res = await api.get(`/cash-flow/current/${effectiveBranch}`);
                return res.data.data;
            } catch (err: any) {
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!effectiveBranch,
        staleTime: 10_000,
    });

    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const openMutation = useMutation({
        mutationFn: async (openingAmount: number) => {
            await api.post('/cash-flow/open', { branchId: effectiveBranch, openingAmount });
        },
        onSuccess: () => {
            toast.success('Caja abierta correctamente');
            setOpenCashOpen(false);
            setOpenCopVal('0'); setOpenUsdVal('0'); setOpenVesVal('0');
            refetchRegister();
            queryClient.invalidateQueries({ queryKey: ['openRegister'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Error al abrir caja');
        }
    });

    useAutoOpenRegister({
        branchId: effectiveBranch || null,
        hasOpenRegister: !!openRegister,
        onOpened: () => { refetchRegister(); queryClient.invalidateQueries({ queryKey: ['openRegister'] }); },
    });

    const { inventory, refetch, isOnline } = useInventory(effectiveBranch || '');

    const products = useMemo<Product[]>(() => {
        if (!inventory || !Array.isArray(inventory)) return [];
        return inventory
            .filter((item: any) => item && item.product)
            .map((item: any) => ({
                id: item.product.id,
                code: item.product.barcode || '',
                barcodes: item.product.barcodes || [],
                name: item.product.name,
                price: Number(item.product.price),
                cost: Number(item.product.cost || 0),
                stock: Number(item.stock),
                category: typeof item.product.subGroup === 'object'
                    ? (item.product.subGroup?.name || 'Varios')
                    : (item.product.subGroup || 'Varios'),
                baseUnit: item.product.baseUnit || 'UNIDAD',
                presentations: (item.product.presentations || []).map((p: any) => ({
                    id: p.id, name: p.name,
                    multiplier: Number(p.multiplier),
                    price: Number(p.price),
                    barcode: p.barcode,
                })),
            }));
    }, [inventory]);

    const inventoryItems = useMemo(() => {
        return inventory?.map((item: any) => ({
            product: products.find(p => p.id === item.product?.id) || item.product,
            stock: Number(item.stock),
        })) || [];
    }, [inventory, products]);

    // ── Cart Hook ────────────────────────────────────────────────────
    const {
        items: cart,
        addItem: addToCart,
        updateQty: updateCartItemQty,
        updatePresentation: updateCartItemPresentation,
        removeItem: removeFromCart,
        clearCart,
        totals,
    } = useCart({ isSaleMode }, products, iva);

    // ── Barcode Scanner ──────────────────────────────────────────────
    useBarcodeScanner((barcode) => {
        const p = products.find(x => x.code === barcode);
        if (p) { addToCart(p); toast.success(`✓ ${p.name} añadido`); return; }

        for (const prod of products) {
            if (prod.barcodes.some(b => b.code === barcode)) {
                addToCart(prod); toast.success(`✓ ${prod.name} añadido`); return;
            }
        }

        for (const prod of products) {
            const pres = prod.presentations.find(pr => pr.barcode === barcode);
            if (pres) { addToCart(prod, pres); toast.success(`✓ ${prod.name} (${pres.name}) añadido`); return; }
        }

        toast.error(`⚠️ Código ${barcode} no encontrado`);
    });

    // ── Hotkeys ──────────────────────────────────────────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.ctrlKey && e.key === 'Enter' && cart.length > 0) setPayOpen(true);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [cart]);

    // ── Handle Payment Confirm ───────────────────────────────────────
    const handlePayment = async (paymentMethods: Array<{
        type: PaymentMethodType; amount: number; currency: Currency; exchangeRate?: number;
    }>) => {
        if (!selectedBranch) { toast.error('No hay una sede seleccionada'); return; }

        setIsSubmitting(true);
        try {
            const items = cart.map(c => ({
                productId: c.id,
                presentationId: c.presentationId,
                quantity: c.qty,
                unitPrice: c.currentPrice,
            }));

            const payload: CreateTransactionPayload = {
                type: 'SALE',
                branchId: effectiveBranch!,
                items,
                currency: 'COP',
                exchangeRate: 1,
                paymentMethods,
            };

            await api.post('/pos/transactions', payload);

            setSummary({
                visible: true,
                items: cart.map(c => ({
                    name: c.name,
                    qty: c.qty,
                    unitPrice: c.currentPrice,
                    total: c.currentPrice * c.qty,
                })),
                total: totals.total,
                paymentMethods: paymentMethods.map(pm => ({
                    type: pm.type,
                    amount: pm.amount,
                    currency: pm.currency,
                })),
                type: 'SALE',
            });

            setPayOpen(false);
            clearCart();
            refetch();
            queryClient.invalidateQueries({ queryKey: ['openRegister'] });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Error al procesar la venta');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStockEntry = async () => {
        setStockEntryOpen(true);
    };

    // ── Branch Selection Screen ──────────────────────────────────────
    if (!selectedBranch || selectedBranch === 'all') {
        return (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center gap-6 pb-20">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex justify-center items-center mb-2">
                    <Store className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-800">Selecciona una Sucursal</h2>
                <p className="text-slate-500 max-w-md">
                    Para acceder al Punto de Venta, necesitas seleccionar en qué sucursal vas a operar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                    {branches.map((b: any) => (
                        <button key={b.id}
                            onClick={() => useAuthStore.getState().setSelectedBranch(b.id)}
                            className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-500 hover:shadow-md transition-all flex items-center gap-4 text-left group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center shrink-0 transition-colors">
                                <Store className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{b.name}</h3>
                                <p className="text-xs text-slate-500 mt-1">Operar en esta sucursal</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Closed Register Screen ───────────────────────────────────────
    if (!registerLoading && !openRegister) {
        return (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4 pb-20">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex justify-center items-center">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Caja Cerrada</h2>
                <p className="text-slate-500 text-sm">No puedes realizar ventas sin un turno de caja activo.</p>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full mt-4">
                    <Button size="lg" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold text-base shadow-sm"
                        onClick={() => setOpenCashOpen(true)}>
                        <Play className="w-4 h-4 mr-2" /> Abrir Caja Ahora
                    </Button>
                </div>

                <Dialog open={openCashOpen} onOpenChange={(o) => !o && setOpenCashOpen(false)}>
                    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-slate-50/50">
                        <div className="bg-white p-8 space-y-6">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-xl font-bold text-slate-800">Abrir Turno de Caja</DialogTitle>
                                <DialogDescription className="text-slate-500 text-sm mt-1">
                                    Ingresa el monto de apertura (efectivo físico en caja) para iniciar.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                                {([
                                    { id: 'cop', label: 'COP', symbol: '$', val: openCopVal, set: setOpenCopVal, step: '1' },
                                    { id: 'usd', label: 'USD', symbol: '$', val: openUsdVal, set: setOpenUsdVal, step: '0.01' },
                                    { id: 'ves', label: 'VES', symbol: 'Bs.', val: openVesVal, set: setOpenVesVal, step: '0.01' },
                                ] as const).map((f) => (
                                    <div key={f.id} className="flex items-center gap-3">
                                        <span className="w-16 font-bold text-slate-600 text-sm shrink-0">{f.label}</span>
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{f.symbol}</span>
                                            <input type="number" step={f.step} min="0" value={f.val}
                                                onChange={e => f.set(e.target.value)}
                                                className="w-full text-right h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-slate-900 rounded-xl text-white">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Estimado (COP)</span>
                                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500 uppercase">Base</Badge>
                                </div>
                                <p className="text-2xl font-black tabular-nums">
                                    {fmtCOP((parseFloat(openCopVal) || 0) + ((parseFloat(openUsdVal) || 0) * usdRate) + ((parseFloat(openVesVal) || 0) * vesRate))}
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" className="flex-1 h-11 rounded-lg font-bold text-slate-500"
                                    onClick={() => setOpenCashOpen(false)}>Cancelar</Button>
                                <Button className="flex-[2] h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-100"
                                    disabled={openMutation.isPending}
                                    onClick={() => {
                                        const cop = parseFloat(openCopVal) || 0;
                                        const usd = parseFloat(openUsdVal) || 0;
                                        const ves = parseFloat(openVesVal) || 0;
                                        openMutation.mutate(cop + (usd * usdRate) + (ves * vesRate));
                                    }}>
                                    {openMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Abriendo...</> : <><Play className="w-4 h-4 mr-2" /> Confirmar Apertura</>}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // ── Main POS Layout ──────────────────────────────────────────────
    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full lg:h-[calc(100dvh-112px)] overflow-hidden">
            {/* LEFT: Products */}
            <div className="flex-[6] flex flex-col gap-4 bg-white rounded-xl border p-4 shadow-sm overflow-hidden">
                <div className="flex border border-slate-200 p-1 rounded-lg w-fit mb-1">
                    <button onClick={() => { setIsSaleMode(true); clearCart(); }}
                        className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            isSaleMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                        <ShoppingCart className="w-4 h-4" /> Venta
                    </button>
                    <button onClick={() => { setIsSaleMode(false); clearCart(); }}
                        className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            !isSaleMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                        <PackagePlus className="w-4 h-4" /> Entrada / Restock
                    </button>
                </div>


                <div className="flex-1 overflow-y-auto">
                    <ProductSearch
                        inventory={inventoryItems}
                        isSaleMode={isSaleMode}
                        onAddToCart={addToCart}
                        onShowPresentations={(prod) => setActiveProductForPres(prod)}
                    />
                </div>
            </div>

            {/* RIGHT: Cart */}
            <div className="flex-[4] flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                <CartPanel
                    items={cart}
                    totals={totals}
                    isSaleMode={isSaleMode}
                    products={products}
                    onUpdateQty={updateCartItemQty}
                    onUpdatePresentation={updateCartItemPresentation}
                    onRemoveItem={removeFromCart}
                    onClearCart={clearCart}
                    onCheckout={() => isSaleMode ? setPayOpen(true) : handleStockEntry()}
                    isSubmitting={isSubmitting}
                />
            </div>

            {/* Payment Dialog */}
            {isSaleMode && (
                <PaymentDialog
                    open={payOpen}
                    total={totals.total}
                    onClose={() => setPayOpen(false)}
                    onConfirm={handlePayment}
                    isSubmitting={isSubmitting}
                />
            )}

            {/* Stock Entry Modal */}
            <StockEntryModal
                open={stockEntryOpen}
                onClose={() => setStockEntryOpen(false)}
                branchId={effectiveBranch || undefined}
                preloadedItems={cart.map(c => ({
                    productId: c.id,
                    productName: c.name,
                    quantity: c.qty * c.multiplier,
                    suggestedCost: c.currentPrice / c.multiplier,
                }))}
                onSuccess={() => {
                    clearCart();
                    setStockEntryOpen(false);
                    refetch();
                }}
            />

            {/* Presentation Selector Dialog */}
            <Dialog open={!!activeProductForPres} onOpenChange={(open) => !open && setActiveProductForPres(null)}>
                <DialogContent className="max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900">{activeProductForPres?.name}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-400">
                            Selecciona la presentación a agregar
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        {activeProductForPres && (
                            <button onClick={() => { addToCart(activeProductForPres); setActiveProductForPres(null); toast.success(`✓ ${activeProductForPres.name} añadido`); }}
                                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all hover:scale-[1.02] font-bold text-slate-800">
                                <span>Base ({activeProductForPres.baseUnit})</span>
                                <span className="font-black">{fmtCOP(isSaleMode ? activeProductForPres.price : activeProductForPres.cost)}</span>
                            </button>
                        )}
                        {activeProductForPres?.presentations.map(pres => (
                            <button key={pres.id}
                                onClick={() => { addToCart(activeProductForPres, pres); setActiveProductForPres(null); toast.success(`✓ ${activeProductForPres.name} (${pres.name}) añadido`); }}
                                className="flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 rounded-xl transition-all hover:scale-[1.02] font-bold text-indigo-900">
                                <div className="flex flex-col text-left">
                                    <span>{pres.name}</span>
                                    <span className="text-[10px] text-indigo-500 font-semibold mt-0.5">
                                        Equivale a {pres.multiplier} {activeProductForPres.baseUnit}
                                    </span>
                                </div>
                                <span className="font-black">{fmtCOP(isSaleMode ? pres.price : activeProductForPres.cost * pres.multiplier)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => setActiveProductForPres(null)}>Cancelar</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Transaction Summary */}
            <TransactionSummary
                visible={summary.visible}
                type={summary.type}
                items={summary.items}
                total={summary.total}
                paymentMethods={summary.paymentMethods}
                onDismiss={() => setSummary(prev => ({ ...prev, visible: false }))}
            />
        </div>
    );
}
