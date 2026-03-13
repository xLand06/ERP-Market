import {
    LayoutDashboard, Package, ShoppingCart, Receipt,
    Coins, BarChart3, Users, Truck, Tag, Store, ChevronRight, X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
    label: string;
    icon: React.ElementType;
    href: string;
    badge?: string;
    section?: string;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', section: 'Principal' },
    { label: 'Punto de Venta', icon: ShoppingCart, href: '/pos', badge: 'F1' },
    { label: 'Inventario', icon: Package, href: '/inventory', section: 'Gestión' },
    { label: 'Reportes', icon: BarChart3, href: '/reports' },
    { label: 'Usuarios', icon: Users, href: '/users', section: 'Admin' },

    { label: 'Finanzas', icon: Coins, href: '/finance', section: 'Pro' },

    { label: 'Productos', icon: Store, href: '/products' },
    { label: 'Lotes', icon: Tag, href: '/inventory/batches' },
    { label: 'Ventas', icon: Receipt, href: '/sales', section: 'Pro Max' },

    { label: 'Proveedores', icon: Truck, href: '/suppliers' },
];

interface SidebarProps {
    collapsed?: boolean;
    onCloseMobile?: () => void;
}

export function Sidebar({ collapsed = false, onCloseMobile }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    let lastSection = '';

    return (
        <div className="flex flex-col h-full gap-0.5">
            {/* Header / Brand Mark */}
            <div className={cn(
                "mb-6 px-3 flex flex-col transition-all duration-300",
                collapsed ? "items-center" : "items-start"
            )}>
                <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform">
                            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-white font-black text-sm tracking-tight leading-none uppercase">Abastos sofimar</span>
                                <span className="text-slate-500 font-medium text-[10px] tracking-widest uppercase mt-1">sistema de gestion</span>
                            </div>
                        )}
                    </div>
                    {!collapsed && onCloseMobile && (
                        <button 
                            onClick={onCloseMobile}
                            className="md:hidden p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                            aria-label="Cerrar menú"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {!collapsed && <div className="h-px w-full bg-gradient-to-r from-slate-800 via-slate-800 to-transparent mb-2" />}
            </div>

            {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                const showSection = !collapsed && item.section && item.section !== lastSection;
                if (showSection) lastSection = item.section!;

                const NavBtn = () => (
                    <button
                        onClick={() => navigate(item.href)}
                        className={cn(
                            'flex items-center gap-2.5 w-full rounded-lg transition-all duration-150 text-sm relative',
                            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                            isActive
                                ? 'bg-emerald-500/10 text-emerald-400 font-semibold border-l-2 border-emerald-500'
                                : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 border-l-2 border-transparent'
                        )}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <item.icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
                        {!collapsed && (
                            <>
                                <span className="flex-1 text-left">{item.label}</span>
                                {item.badge && (
                                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 rounded px-1.5 py-0.5">
                                        {item.badge}
                                    </span>
                                )}
                                {isActive && <ChevronRight className="w-3 h-3 opacity-70" />}
                            </>
                        )}
                    </button>
                );

                return (
                    <div key={item.href}>
                        {showSection && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 pt-4 pb-2">
                                {item.section}
                            </p>
                        )}
                        <NavBtn />
                    </div>
                );
            })}

            {/* Footer */}
            {!collapsed && (
                <div className="mt-auto pt-4 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 text-center font-bold tracking-widest uppercase opacity-50">Sofimar v2.0</p>
                </div>
            )}
        </div>
    );
}
