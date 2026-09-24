// =============================================================================
// PUBLIC STORE CATALOG — Catálogo digital de tienda
// Página pública sin auth en allmarket.allcode.site/:slug
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = '';

// Simple spinner and icons (no lucide dependency)
const Loader2 = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
);
const PackageX = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
);
const Search = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
);
const Store = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);

// ─── Price formatter ─────────────────────────────────────────────────────────
const formatPrice = (value: number): string =>
    new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value);

// ─── Social icons ────────────────────────────────────────────────────────────
const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const InstagramIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const FacebookIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);

const toExternalUrl = (value: string, kind: 'whatsapp' | 'instagram' | 'facebook'): string => {
    if (/^https?:\/\//i.test(value)) return value;
    if (kind === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
    return `https://${value}`;
};

// ─── Product card ────────────────────────────────────────────────────────────
interface Presentation { id: string; name: string; price: number; multiplier: number; barcode: string | null; }
interface Product { id: string; name: string; price: number; barcode: string | null; imageUrl: string | null; description: string | null; presentations: Presentation[]; }
interface Group { id: string; name: string; products: Product[]; }
interface CatalogData { businessName: string; taxId: string | null; socialLinks: { whatsapp?: string; instagram?: string; facebook?: string }; groups: Group[]; }

function ProductCard({ product }: { product: Product }) {
    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    const hasPresentations = product.presentations.length > 0;
    const activePresentation = hasPresentations
        ? product.presentations.find(p => p.id === selectedPresId) ?? product.presentations[0]
        : null;
    const displayPrice = activePresentation ? activePresentation.price : product.price;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                {!!product.imageUrl && !imgError ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-10 h-10" /></div>
                )}
            </div>
            <div className="p-3 flex flex-col gap-1.5 flex-1">
                <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{product.name}</h3>
                {product.description ? <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p> : null}
                <p className="text-base font-black text-slate-900 mt-auto">
                    {formatPrice(displayPrice)}
                    {hasPresentations ? <span className="text-[10px] font-semibold text-slate-400 ml-1">desde</span> : null}
                </p>
                {hasPresentations ? (
                    <div className="flex flex-wrap gap-1.5">
                        {product.presentations.map(pres => (
                            <button key={pres.id} type="button" onClick={() => setSelectedPresId(pres.id)}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                                    activePresentation?.id === pres.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                {pres.name}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function StoreCatalogPage() {
    const { slug } = useParams<{ slug: string }>();
    const [search, setSearch] = useState('');
    const [data, setData] = useState<CatalogData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Fetch on mount
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/public-catalog/${slug}`);
                if (!res.ok) throw new Error('not found');
                const json = await res.json();
                if (json.success && json.data) {
                    setData(json.data);
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    const filteredGroups = useMemo<Group[]>(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        if (!term) return data.groups;
        return data.groups
            .map(g => ({ ...g, products: g.products.filter(p => p.name.toLowerCase().includes(term) || p.presentations.some(pr => pr.name.toLowerCase().includes(term))) }))
            .filter(g => g.products.length > 0);
    }, [data, search]);

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                        <PackageX className="w-8 h-8" />
                    </div>
                    <h1 className="text-lg font-black text-slate-900 mb-1">Tienda no encontrada</h1>
                    <p className="text-sm text-slate-500">Verifica el enlace o contacta directamente al negocio.</p>
                </div>
            </div>
        );
    }

    if (loading || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const renderSocial = () => {
        const links: Array<{ href: string; icon: React.ReactNode; color: string }> = [];
        if (data!.socialLinks.whatsapp) links.push({ href: toExternalUrl(data!.socialLinks.whatsapp, 'whatsapp'), icon: <WhatsAppIcon />, color: 'bg-[#25D366]' });
        if (data!.socialLinks.instagram) links.push({ href: toExternalUrl(data!.socialLinks.instagram, 'instagram'), icon: <InstagramIcon />, color: 'bg-[#E4405F]' });
        if (data!.socialLinks.facebook) links.push({ href: toExternalUrl(data!.socialLinks.facebook, 'facebook'), icon: <FacebookIcon />, color: 'bg-[#1877F2]' });
        if (!links.length) return null;
        return (
            <div className="flex items-center gap-2">
                {links.map((l, i) => (
                    <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" className={`${l.color} text-white p-2.5 rounded-full shadow-sm hover:opacity-90 transition-opacity`}>
                        {l.icon}
                    </a>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{data!.businessName}</h1>
                        {data!.taxId ? <p className="text-xs text-slate-400 font-medium mt-0.5">RIF: {data!.taxId}</p> : null}
                    </div>
                    {renderSocial()}
                </div>
            </header>

            <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-6 pb-16">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-16">
                        <PackageX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">{search ? 'Sin resultados para tu búsqueda' : 'No hay productos disponibles'}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredGroups.map(group => (
                            <section key={group.id} aria-label={group.name}>
                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">{group.name}</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {group.products.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            <footer className="border-t border-slate-200 py-6">
                <p className="text-center text-xs text-slate-400 font-medium">{data!.businessName} — catálogo digital</p>
            </footer>
        </div>
    );
}
