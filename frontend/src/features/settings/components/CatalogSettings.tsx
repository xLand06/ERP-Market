// =============================================================================
// CATALOG SETTINGS — Configuración del catálogo digital (F5)
// Soporta activación, slug, enlaces de redes sociales y
// Personalización de Marca (Logo, Banner, Bio, Horarios y Dirección)
// con Candado y Upgrade exclusivo para Plan PREMIUM.
// =============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { 
    Check, Copy, Globe, Link2, Save, Sparkles, Upload, 
    Image as ImageIcon, Trash2, Clock, MapPin, AlignLeft, 
    Lock, ArrowUpRight, Loader2, Store
} from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { getEffectivePlan } from '@/lib/planConfig';
import { PlanUpgradeModal } from '@/components/modals/PlanUpgradeModal';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SocialLinksState {
    facebook: string;
    instagram: string;
    whatsapp: string;
}

const DEFAULT_SOCIALS: SocialLinksState = { facebook: '', instagram: '', whatsapp: '' };

const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    }
};

export function CatalogSettings() {
    const { 
        catalogSlug, 
        catalogActive, 
        socialLinks, 
        catalogLogo, 
        catalogBanner, 
        catalogDescription, 
        catalogSchedule, 
        catalogAddress,
        fetchSettings, 
        updateSettings 
    } = useConfigStore();

    const plan = getEffectivePlan();
    const isPremium = plan === 'PREMIUM';

    const [localActive, setLocalActive] = useState(catalogActive);
    const [localSlug, setLocalSlug] = useState(catalogSlug || '');
    const [socials, setSocials] = useState<SocialLinksState>(DEFAULT_SOCIALS);

    // Campos de marca
    const [logoUrl, setLogoUrl] = useState<string | null>(catalogLogo || null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(catalogBanner || null);
    const [description, setDescription] = useState(catalogDescription || '');
    const [schedule, setSchedule] = useState(catalogSchedule || '');
    const [address, setAddress] = useState(catalogAddress || '');

    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        setLocalActive(catalogActive);
        setLocalSlug(catalogSlug || '');
        setLogoUrl(catalogLogo || null);
        setBannerUrl(catalogBanner || null);
        setDescription(catalogDescription || '');
        setSchedule(catalogSchedule || '');
        setAddress(catalogAddress || '');

        try {
            const parsed = JSON.parse(socialLinks || '{}') as Partial<SocialLinksState>;
            setSocials({
                facebook: parsed.facebook || '',
                instagram: parsed.instagram || '',
                whatsapp: parsed.whatsapp || '',
            });
        } catch {
            setSocials(DEFAULT_SOCIALS);
        }
    }, [catalogActive, catalogSlug, socialLinks, catalogLogo, catalogBanner, catalogDescription, catalogSchedule, catalogAddress]);

    const catalogBaseUrl = 'https://allmarket.allcode.site';
    const shareLink = localSlug.trim()
        ? `${catalogBaseUrl}/${encodeURIComponent(localSlug.trim())}`
        : '';

    const handleCopy = async () => {
        if (!shareLink) return;
        const ok = await copyToClipboard(shareLink);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else {
            toast.error('No se pudo copiar el enlace');
        }
    };

    // Subida de Logo o Banner
    const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
        if (!isPremium) {
            setUpgradeModalOpen(true);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen no puede superar 5MB.');
            return;
        }

        const setUploading = type === 'logo' ? setUploadingLogo : setUploadingBanner;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await api.post(`/upload/catalog-image?type=${type}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.success && res.data?.url) {
                if (type === 'logo') setLogoUrl(res.data.url);
                if (type === 'banner') setBannerUrl(res.data.url);
                toast.success(type === 'logo' ? 'Logo subido correctamente' : 'Banner subido correctamente');
            } else {
                toast.error('Error al subir imagen');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Error al procesar la imagen';
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (localActive && !localSlug.trim()) {
            toast.error('El slug es obligatorio para activar el catálogo');
            return;
        }

        setSaving(true);
        try {
            await updateSettings({
                catalogSlug: localSlug.trim(),
                catalogActive: localActive,
                socialLinks: JSON.stringify(socials),
                catalogLogo: isPremium ? logoUrl : null,
                catalogBanner: isPremium ? bannerUrl : null,
                catalogDescription: isPremium ? description.trim() : null,
                catalogSchedule: isPremium ? schedule.trim() : null,
                catalogAddress: isPremium ? address.trim() : null,
            });
            toast.success('Configuración del catálogo guardada correctamente');
        } catch {
            toast.error('Error al guardar la configuración del catálogo');
        } finally {
            setSaving(false);
        }
    };

    const setSocial = (key: keyof SocialLinksState, value: string) => {
        setSocials(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="max-w-4xl space-y-6 animate-fade-in pb-12">
            <PlanUpgradeModal
                isOpen={upgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                feature="Personalización de Marca y Logo en Catálogo Online"
            />

            {/* SECCIÓN ESTADO DEL CATÁLOGO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            Catálogo Digital
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Página pública para compartir tus productos con clientes, sin necesidad de cuenta.
                        </p>
                    </div>
                </div>

                {/* Toggle activar/desactivar */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={localActive}
                    onClick={() => setLocalActive(prev => !prev)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 transition-colors cursor-pointer text-left"
                >
                    <div>
                        <span className="text-sm font-bold text-slate-800 block">
                            Habilitar catálogo público
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                            {localActive ? 'El catálogo está activo y accesible públicamente' : 'El catálogo está desactivado'}
                        </span>
                    </div>
                    <div
                        className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                            localActive ? 'bg-indigo-600' : 'bg-slate-200'
                        )}
                    >
                        <span
                            className={cn(
                                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out',
                                localActive ? 'translate-x-5' : 'translate-x-0'
                            )}
                        />
                    </div>
                </button>

                {/* Slug */}
                <div>
                    <label htmlFor="catalog-slug" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Slug del catálogo
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-xs sm:text-sm text-slate-400 font-semibold shrink-0 select-none break-all">
                            {catalogBaseUrl}/
                        </span>
                        <input
                            id="catalog-slug"
                            type="text"
                            value={localSlug}
                            onChange={e => setLocalSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                            placeholder="mi-tienda"
                            className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]"
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">
                        Solo letras, números y guiones. Ej: mi-tienda → {catalogBaseUrl}/mi-tienda
                    </p>
                </div>

                {/* Link compartible + copiar */}
                {shareLink ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:px-3.5 sm:py-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs sm:text-sm text-slate-600 font-medium truncate">{shareLink}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={cn(
                                'flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 min-h-[40px]',
                                copied ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            )}
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copiado' : 'Copiar enlace'}
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 font-medium">
                        Define un slug para generar el enlace compartible.
                    </p>
                )}
            </div>

            {/* SECCIÓN PERSONALIZACIÓN DE MARCA (LOGO, BANNER, BIO) — EXCLUSIVO PLAN PREMIUM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 relative overflow-hidden">
                {!isPremium && (
                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-black text-slate-900 tracking-tight">
                            Personalización Exclusiva del Plan Premium
                        </h4>
                        <p className="text-xs text-slate-600 max-w-md mt-1 mb-4 leading-relaxed">
                            Personaliza tu catálogo online con el logotipo de tu empresa, portada destacada, horarios de atención, punto de retiro y descripción corporativa.
                        </p>
                        <button
                            type="button"
                            onClick={() => setUpgradeModalOpen(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                        >
                            <Sparkles className="w-4 h-4" />
                            Actualizar a Plan Premium
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                    Identidad & Marca
                                </h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    Premium
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Logo, banner de portada y detalles para transmitir confianza a tus clientes.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Subida de Logo y Portada Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LOGO */}
                    <div className="border border-slate-200/90 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center text-center">
                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 self-start">
                            Logotipo del Comercio
                        </span>
                        <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-2xs mb-3">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                            ) : (
                                <Store className="w-8 h-8 text-slate-300" />
                            )}
                            {uploadingLogo && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                </div>
                            )}
                        </div>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleImageUpload(f, 'logo');
                                e.target.value = '';
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={!isPremium || uploadingLogo}
                                onClick={() => logoInputRef.current?.click()}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                            </button>
                            {logoUrl && (
                                <button
                                    type="button"
                                    onClick={() => setLogoUrl(null)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                    title="Quitar logo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">Recomendado: PNG o WebP cuadrado (500x500px)</span>
                    </div>

                    {/* BANNER DE PORTADA */}
                    <div className="border border-slate-200/90 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center text-center">
                        <span className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 self-start">
                            Banner de Portada
                        </span>
                        <div className="w-full h-24 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-2xs mb-3">
                            {bannerUrl ? (
                                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="w-8 h-8 text-slate-300" />
                            )}
                            {uploadingBanner && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                </div>
                            )}
                        </div>
                        <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleImageUpload(f, 'banner');
                                e.target.value = '';
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={!isPremium || uploadingBanner}
                                onClick={() => bannerInputRef.current?.click()}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {bannerUrl ? 'Cambiar Banner' : 'Subir Banner'}
                            </button>
                            {bannerUrl && (
                                <button
                                    type="button"
                                    onClick={() => setBannerUrl(null)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                    title="Quitar banner"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-2">Recomendado: panorámico (1400x500px)</span>
                    </div>
                </div>

                {/* Campos de texto de marca */}
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <AlignLeft className="w-3.5 h-3.5 text-indigo-600" />
                            Descripción / Eslogan del Negocio
                        </label>
                        <textarea
                            disabled={!isPremium}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ej: Distribuidora mayorista y detal de víveres, charcutería y lácteos frescos."
                            rows={2}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-slate-50"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                Horario de Atención
                            </label>
                            <input
                                type="text"
                                disabled={!isPremium}
                                value={schedule}
                                onChange={e => setSchedule(e.target.value)}
                                placeholder="Ej: Lun - Sáb: 8:00 AM - 7:00 PM"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 min-h-[44px]"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                                Dirección de Retiro / Tienda Física
                            </label>
                            <input
                                type="text"
                                disabled={!isPremium}
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="Ej: Av. Bolívar, Edif. Central, Local 2"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 min-h-[44px]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN REDES SOCIALES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                        <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Redes Sociales</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Se muestran como botones de contacto directo en la página pública del catálogo.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {[
                        { key: 'whatsapp' as const, label: 'WhatsApp', placeholder: '0414-1234567 o https://wa.me/584141234567' },
                        { key: 'instagram' as const, label: 'Instagram', placeholder: 'https://instagram.com/mi-tienda' },
                        { key: 'facebook' as const, label: 'Facebook', placeholder: 'https://facebook.com/mi-tienda' },
                    ].map(field => (
                        <div key={field.key}>
                            <label htmlFor={`social-${field.key}`} className="block text-xs font-bold text-slate-700 mb-1.5">
                                {field.label}
                            </label>
                            <input
                                id={`social-${field.key}`}
                                type="text"
                                value={socials[field.key]}
                                onChange={e => setSocial(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm min-h-[46px]"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
            </div>
        </div>
    );
}