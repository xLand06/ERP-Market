// =============================================================================
// CATALOG SETTINGS — Configuración del catálogo digital (F5)
// Permite activar/desactivar el catálogo público, definir el slug y las
// redes sociales que se muestran en la página standalone /catalogo/:slug.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Globe, Link2, Save } from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SocialLinksState {
    facebook: string;
    instagram: string;
    whatsapp: string;
}

const DEFAULT_SOCIALS: SocialLinksState = { facebook: '', instagram: '', whatsapp: '' };

// Copia con fallback para navegadores sin permisos de clipboard
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
    const { catalogSlug, catalogActive, socialLinks, fetchSettings, updateSettings } = useConfigStore();

    const [localActive, setLocalActive] = useState(catalogActive);
    const [localSlug, setLocalSlug] = useState(catalogSlug || '');
    const [socials, setSocials] = useState<SocialLinksState>(DEFAULT_SOCIALS);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Cargar configuración del backend al montar
    useEffect(() => {
        fetchSettings();
    }, []);

    // Sincronizar estado local cuando el store se actualiza desde la API
    useEffect(() => {
        setLocalActive(catalogActive);
        setLocalSlug(catalogSlug || '');
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
    }, [catalogActive, catalogSlug, socialLinks]);

    // En Electron (protocolo file:) no existe URL pública local — se muestra el enlace relativo
    const baseUrl = useMemo(() => {
        if (window.location.protocol === 'file:' || (window as any).erpApi?.isElectron) {
            return '';
        }
        return window.location.origin;
    }, []);

    const shareLink = localSlug.trim()
        ? (baseUrl ? `${baseUrl}/catalogo/${encodeURIComponent(localSlug.trim())}` : `/catalogo/${encodeURIComponent(localSlug.trim())}`)
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

    const handleSave = async () => {
        // El slug es obligatorio para activar el catálogo
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
            });
            toast.success('Catálogo digital guardado correctamente');
        } catch {
            toast.error('Error al guardar la configuración del catálogo');
        } finally {
            setSaving(false);
        }
    };

    const setSocial = (key: keyof SocialLinksState, value: string) => {
        setSocials(prev => ({ ...prev, [key]: value }));
    };

    const socialInputs: Array<{ key: keyof SocialLinksState; label: string; placeholder: string }> = [
        { key: 'whatsapp', label: 'WhatsApp', placeholder: '0414-1234567 o https://wa.me/584141234567' },
        { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/mi-tienda' },
        { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/mi-tienda' },
    ];

    return (
        <div className="max-w-4xl space-y-6 animate-fade-in">

            {/* SECCIÓN ESTADO DEL CATÁLOGO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Catálogo Digital</h3>
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
                    className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors cursor-pointer',
                        localActive ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                    )}
                >
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">{localActive ? 'Catálogo activo' : 'Catálogo inactivo'}</p>
                        <p className="text-xs text-slate-500 font-medium">
                            {localActive
                                ? 'Tu página pública está disponible en el enlace de abajo.'
                                : 'Al activarlo, el enlace de abajo empieza a funcionar.'}
                        </p>
                    </div>
                    <span
                        className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                            localActive ? 'bg-emerald-500' : 'bg-slate-300'
                        )}
                    >
                        <span
                            className={cn(
                                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                                localActive && 'translate-x-5'
                            )}
                        />
                    </span>
                </button>

                {/* Slug */}
                <div>
                    <label htmlFor="catalog-slug" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Slug del catálogo
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 font-semibold shrink-0">{baseUrl || ''}/catalogo/</span>
                        <input
                            id="catalog-slug"
                            type="text"
                            value={localSlug}
                            onChange={e => setLocalSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                            placeholder="mi-tienda"
                            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">
                        Solo letras, números y guiones. Ej: mi-tienda → {baseUrl || ''}/catalogo/mi-tienda
                    </p>
                </div>

                {/* Link compartible + copiar */}
                {shareLink ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                        <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-600 font-medium truncate">{shareLink}</span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0',
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

            {/* SECCIÓN REDES SOCIALES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Redes Sociales</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Se muestran como botones en la página pública del catálogo.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {socialInputs.map(field => (
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
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
            </div>
        </div>
    );
}