// =============================================================================
// PUBLIC STORE CATALOG — Catálogo digital de tienda
// Página pública sin auth en allmarket.allcode.site/:slug
// Diseño mobile-first con Tailwind CSS
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = '';

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const Spinner = ({ className = 'w-8 h-8' }: { className?: string }) => (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

const IconPackage = ({ className = 'w-10 h-10' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
);

const IconSearch = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
    </svg>
);

const IconStore = ({ className = 'w-8 h-8' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const IconTag = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
);

// ─── Social Icons ────────────────────────────────────────────────────────────
const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const InstagramIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const FacebookIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (value: number): string =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

const toExternalUrl = (value: string, kind: 'whatsapp' | 'instagram' | 'facebook'): string => {
    if (/^https?:\/\//i.test(value)) return value;
    if (kind === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
    return `https://${value}`;
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Presentation { id: string; name: string; price: number; multiplier: number; barcode: string | null; }
interface Product { id: string; name: string; price: number; barcode: string | null; imageUrl: string | null; description: string | null; presentations: Presentation[]; }
interface Group { id: string; name: string; products: Product[]; }
interface CatalogData { businessName: string; taxId: string | null; socialLinks: { whatsapp?: string; instagram?: string; facebook?: string }; groups: Group[]; }

// ─── Product Card ────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    const hasPresentations = product.presentations.length > 0;
    const activePresentation = hasPresentations
        ? product.presentations.find(p => p.id === selectedPresId) ?? product.presentations[0]
        : null;
    const displayPrice = activePresentation ? activePresentation.price : product.price;

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col border border-slate-100">
            {/* Image */}
            <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden">
                {!!product.imageUrl && !imgError ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                        <IconStore className="w-12 h-12" />
                    </div>
                )}
                {/* Price badge */}
                <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-slate-100">
                    <span className="text-base font-black text-emerald-600">{formatPrice(displayPrice)}</span>
                </div>
            </div>

            {/* Info */}
            <div className="p-3.5 flex flex-col gap-2 flex-1">
                <h3 className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                </h3>

                {product.description ? (
                    <p className="text-[11px] text-slate-400 line-clamp-1">{product.description}</p>
                ) : null}

                {product.barcode ? (
                    <p className="text-[10px] text-slate-300 font-mono tracking-wider">#{product.barcode}</p>
                ) : null}

                {/* Presentations */}
                {hasPresentations ? (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        {product.presentations.map(pres => {
                            const isSelected = activePresentation?.id === pres.id;
                            return (
                                <button
                                    key={pres.id}
                                    type="button"
                                    onClick={() => setSelectedPresId(pres.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                    }`}
                                >
                                    <IconTag className="w-3 h-3" />
                                    {pres.name}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-auto" />
                )}
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function StoreCatalogPage() {
    const { slug } = useParams<{ slug: string }>();
    const [search, setSearch] = useState('');
    const [data, setData] = useState<CatalogData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Update document title
    useEffect(() => {
        if (data?.businessName) {
            document.title = `${data.businessName} — Catálogo`;
        }
    }, [data]);

    // Fetch catalog
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/public-catalog/${slug}`);
                if (!res.ok) throw new Error('not found');
                const json = await res.json();
                if (!cancelled) {
                    if (json.success && json.data) {
                        setData(json.data);
                    } else {
                        setError(true);
                    }
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

    // Filter products
    const filteredGroups = useMemo<Group[]>(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        if (!term) return data.groups;
        return data.groups
            .map(g => ({
                ...g,
                products: g.products.filter(p =>
                    p.name.toLowerCase().includes(term) ||
                    p.description?.toLowerCase().includes(term) ||
                    p.presentations.some(pr => pr.name.toLowerCase().includes(term))
                ),
            }))
            .filter(g => g.products.length > 0);
    }, [data, search]);

    const totalProducts = useMemo(() => {
        if (!data) return 0;
        return data.groups.reduce((acc, g) => acc + g.products.length, 0);
    }, [data]);

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center text-slate-300 mb-5 border border-slate-100">
                        <IconPackage className="w-10 h-10" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 mb-2">Tienda no encontrada</h1>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Verifica el enlace o contacta directamente al negocio para recibir el catálogo actualizado.
                    </p>
                </div>
            </div>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4">
                <Spinner className="w-10 h-10 text-indigo-500" />
                <p className="text-sm text-slate-400 font-medium">Cargando catálogo...</p>
            </div>
        );
    }

    // ── Social links ──────────────────────────────────────────────────────────
    const socials: Array<{ href: string; icon: React.ReactNode; color: string; label: string }> = [];
    if (data.socialLinks.whatsapp) {
        socials.push({ href: toExternalUrl(data.socialLinks.whatsapp, 'whatsapp'), icon: <WhatsAppIcon className="w-5 h-5" />, color: 'bg-[#25D366] hover:bg-[#1da851]', label: 'WhatsApp' });
    }
    if (data.socialLinks.instagram) {
        socials.push({ href: toExternalUrl(data.socialLinks.instagram, 'instagram'), icon: <InstagramIcon className="w-5 h-5" />, color: 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] hover:opacity-90', label: 'Instagram' });
    }
    if (data.socialLinks.facebook) {
        socials.push({ href: toExternalUrl(data.socialLinks.facebook, 'facebook'), icon: <FacebookIcon className="w-5 h-5" />, color: 'bg-[#1877F2] hover:bg-[#166fe5]', label: 'Facebook' });
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                {data.businessName}
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                {data.taxId ? (
                                    <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                                        RIF: {data.taxId}
                                    </span>
                                ) : null}
                                <span className="text-xs text-slate-400 font-medium">
                                    {totalProducts} productos
                                </span>
                            </div>
                        </div>
                        {socials.length > 0 ? (
                            <div className="flex items-center gap-2">
                                {socials.map(s => (
                                    <a
                                        key={s.label}
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={s.label}
                                        className={`${s.color} text-white p-2.5 rounded-full shadow-sm transition-all duration-150 hover:scale-105`}
                                    >
                                        {s.icon}
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </header>

            {/* ── Search ──────────────────────────────────────────────────────── */}
            <div className="sticky top-[73px] z-10 bg-white/90 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
                    <div className="relative">
                        <IconSearch className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar productos..."
                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 focus:bg-white transition-all duration-150"
                        />
                    </div>
                </div>
            </div>

            {/* ── Catalog ─────────────────────────────────────────────────────── */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 mb-4">
                            <IconPackage className="w-8 h-8" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                            {search ? 'Sin resultados para tu búsqueda' : 'No hay productos disponibles'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {filteredGroups.map(group => (
                            <section key={group.id} aria-label={group.name}>
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-indigo-500">
                                        {group.name}
                                    </h2>
                                    <div className="flex-1 h-px bg-slate-200" />
                                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {group.products.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                    {group.products.map(p => (
                                        <ProductCard key={p.id} product={p} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <footer className="border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                    <p className="text-center text-xs text-slate-400 font-medium">
                        {data.businessName} &middot; catálogo digital
                    </p>
                    <p className="text-center text-[10px] text-slate-300 mt-1">
                        Powered by ALL MARKET
                    </p>
                </div>
            </footer>
        </div>
    );
}
