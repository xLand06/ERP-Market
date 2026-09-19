import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Check, ShieldAlert, MessageCircle, CreditCard, X } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useConfigStore } from '@/hooks/useConfigStore';
import { normalizePlanType, getPlanLimits, PlanType } from '@/lib/planConfig';

export interface PlanUpgradeModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    resourceName?: string; // 'usuarios' | 'sucursales' | 'productos' | 'módulo'
    currentCount?: number;
    limitCount?: number;
    recommendedPlan?: 'PRO' | 'PREMIUM';
}

const PLAN_BENEFITS: Record<PlanType, { name: string; price: string; color: string; features: string[] }> = {
    BASICO: {
        name: 'Plan Básico',
        price: '$10/mes',
        color: 'from-blue-600 to-indigo-600',
        features: [
            'Hasta 2 usuarios cajeros',
            '1 sucursal / caja principal',
            'Punto de venta y control de inventario',
            'Flujo de caja y arqueos',
            'Desktop App Offline incluida',
        ],
    },
    PRO: {
        name: 'Plan Pro',
        price: '$20/mes',
        color: 'from-emerald-600 to-teal-600',
        features: [
            'Hasta 6 usuarios activos',
            'Hasta 2 sucursales con inventario independiente',
            'Clientes y gestión de Fiados (crédito)',
            'Compras a Proveedores y reposición',
            'Toma de inventario física por lotes',
            'Reportes ejecutivos y estadísticas avanzadas',
            'Desktop App Offline incluida',
        ],
    },
    PREMIUM: {
        name: 'Plan Premium',
        price: '$30/mes',
        color: 'from-purple-600 to-violet-700',
        features: [
            'Usuarios ilimitados para todo tu equipo',
            'Hasta 5 sucursales centralizadas',
            'Catálogo Digital en Línea público',
            'Módulo de Bancos y Conciliación',
            'Cotizaciones y presupuestos a clientes',
            'Soporte prioritario 24/7',
            'Desktop App Offline incluida',
        ],
    },
};

export function PlanUpgradeModal({
    open,
    onClose,
    title,
    description,
    resourceName = 'usuarios',
    currentCount,
    limitCount,
    recommendedPlan,
}: PlanUpgradeModalProps) {
    const navigate = useNavigate();
    const { planTier, businessName } = useConfigStore();
    const currentPlan = normalizePlanType(planTier);

    // Si está en Básico recomendamos Pro; si está en Pro recomendamos Premium
    const targetPlan: PlanType = recommendedPlan || (currentPlan === 'BASICO' ? 'PRO' : 'PREMIUM');
    const targetInfo = PLAN_BENEFITS[targetPlan];
    const limits = getPlanLimits(currentPlan);

    const actualLimit = limitCount ?? (resourceName === 'usuarios' ? limits.maxUsers : limits.maxBranches);

    const defaultTitle = title || `Alcanzaste el límite de ${resourceName} de tu plan`;
    const defaultDesc = description || (
        `Tu ${PLAN_BENEFITS[currentPlan].name} permite un máximo de ${actualLimit} ${resourceName}. Para continuar expandiendo tu negocio, mejorá a un plan superior.`
    );

    const whatsappMessage = encodeURIComponent(
        `¡Hola ALLMARKET! 👋 Deseo actualizar mi negocio *${businessName || 'Comercio'}* al *${targetInfo.name}* para ampliar el límite de ${resourceName}. ¿Me podrían asesorar con el cambio?`
    );

    const handleGoToBilling = () => {
        onClose();
        navigate('/settings');
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl bg-white dark:bg-slate-900">
                {/* Header con gradiente llamativo */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                    
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                                Mejora de Plan
                            </span>
                            <h2 className="text-lg font-bold text-white mt-1 leading-tight">
                                {defaultTitle}
                            </h2>
                        </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {defaultDesc}
                    </p>
                </div>

                {/* Contenido comparativo */}
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Recomendado para vos:
                                </span>
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                    {targetInfo.name}
                                </span>
                            </div>
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {targetInfo.price}
                            </span>
                        </div>

                        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                            {targetInfo.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <span>{feat}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <a
                            href={`https://wa.me/584129657169?text=${whatsappMessage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 text-center cursor-pointer"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Actualizar por WhatsApp</span>
                        </a>

                        <button
                            type="button"
                            onClick={handleGoToBilling}
                            className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                            <CreditCard className="w-4 h-4" />
                            <span>Ver Facturación</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors py-1 cursor-pointer"
                    >
                        Continuar con mi plan actual
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
