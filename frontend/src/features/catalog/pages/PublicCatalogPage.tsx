// =============================================================================
// PUBLIC CATALOG PAGE — Catálogo digital público (F5)
// Página standalone FUERA del AppShell y de PrivateRoute: es el enlace que
// el dueño comparte con sus clientes. Diseño mobile-first, sin dependencias
// de estado de autenticación.
// =============================================================================

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, PackageX, Search, Store } from 'lucide-react';
import { catalogApi } from '@/services/catalog.service';
import type { CatalogGroup, CatalogProduct, SocialLinks } from '@/services/catalog.service';

// ─── Formato de precio (USD: moneda principal por defecto del ERP) ──────────
const formatPrice = (value: number): string =>
    new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value);

// ─── Iconos sociales inline SVG (evita dependencias de iconos de marca) ─────
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

// ─── Conversión de valor social a URL navegable ─────────────────────────────
const toExternalUrl = (value: string, kind: 'whatsapp' | 'instagram' | 'facebook'): string => {
    if (/^https?:\/\//i.test(value)) return value;
    if (kind === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
    return `https://${value}`;
};

// ─── Tarjeta de producto con selector de presentaciones ─────────────────────
function ProductCard({ product }: { product: CatalogProduct }) {
    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    const hasPresentations = product.presentations.length > 0;
    const activePresentation = hasPresentations
        ? product.presentations.find(p => p.id === selectedPresId) ?? product.presentations[0]
        : null;
    const displayPrice = activePresentation ? activePresentation.price : product.price;
    const showImage = !!product.imageUrl && !imgError;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                {showImage ? (
                    <img
                        src={product.imageUrl!}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Store className="w-10 h-10" />
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col gap-1.5 flex-1">
                <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{product.name}</h3>

                {product.description ? (
                    <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>
                ) : null}

                <p className="text-base font-black text-slate-900 mt-auto">
                    {formatPrice(displayPrice)}
                    {hasPresentations ? <span className="text-[10px] font-semibold text-slate-400 ml-1">desde</span> : null}
                </p>

                {hasPresentations ? (
                    <div className="flex flex-wrap gap-1.5">
                        {product.presentations.map(pres => {
                            const isSelected = activePresentation?.id === pres.id;
                            return (
                                <button
                                    key={pres.id}
                                    type="button"
                                    onClick={() => setSelectedPresId(pres.id)}
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {pres.name}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ─── Página principal ───────────────────────────────────────────────────────
export default function PublicCatalogPage() {
    const { slug } = useParams<{ slug: string }>();
    const [search, setSearch] = useState('');

    const { data, isPending, isError } = useQuery({
        queryKey: ['public-catalog', slug],
        queryFn: () => catalogApi.getBySlug(slug!),
        enabled: !!slug,
        retry: false,
    });

    // Filtro cliente-side por nombre de producto / presentación
    const filteredGroups = useMemo<CatalogGroup[]>(() => {
        if (!data) return [];
        const term = search.trim().toLowerCase();
        if (!term) return data.groups;
        return data.groups
            .map(group => ({
                ...group,
                products: group.products.filter(p =>
                    p.name.toLowerCase().includes(term) ||
                    p.presentations.some(pres => pres.name.toLowerCase().includes(term))
                ),
            }))
            .filter(group => group.products.length > 0);
    }, [data, search]);

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
                        className={`${link.color} text-white p-2.5 rounded-full shadow-sm hover:opacity-90 transition-opacity`}
                    >
                        {link.icon}
                    </a>
                ))}
            </div>
        );
    };

    // ── Estado de error / no encontrado ──────────────────────────────────────
    if (isError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                        <PackageX className="w-8 h-8" />
                    </div>
                    <h1 className="text-lg font-black text-slate-900 mb-1">Catálogo no encontrado</h1>
                    <p className="text-sm text-slate-500">
                        Verifica el enlace o contacta directamente al negocio para recibir el catálogo actualizado.
                    </p>
                </div>
            </div>
        );
    }

    // ── Estado de carga ──────────────────────────────────────────────────────
    if (isPending || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const isEmpty = filteredGroups.length === 0;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header del negocio */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{data.businessName}</h1>
                        {data.taxId ? <p className="text-xs text-slate-400 font-medium mt-0.5">RIF: {data.taxId}</p> : null}
                    </div>
                    {renderSocialLinks(data.socialLinks)}
                </div>
            </header>

            {/* Búsqueda sticky */}
            <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar productos..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Catálogo */}
            <main className="max-w-5xl mx-auto px-4 py-6 pb-16">
                {isEmpty ? (
                    <div className="text-center py-16">
                        <PackageX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">
                            {search ? 'Sin resultados para tu búsqueda' : 'No hay productos disponibles por el momento'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredGroups.map(group => (
                            <section key={group.id} aria-label={group.name}>
                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">
                                    {group.name}
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {group.products.map(product => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 py-6">
                <p className="text-center text-xs text-slate-400 font-medium">
                    {data.businessName} — catálogo digital
                </p>
            </footer>
        </div>
    );
}