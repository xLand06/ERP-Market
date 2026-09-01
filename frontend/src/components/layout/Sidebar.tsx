import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useConfigStore, UITheme } from '@/hooks/useConfigStore';
import {
    LayoutDashboard, Package, ShoppingCart,
    Coins, Users, Truck, BarChart2, ShieldCheck, Store, PanelLeftClose, PanelLeftOpen, X,
    Settings, Tag, TrendingDown, CalendarClock, Coffee, ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPathAllowed } from '@/lib/planConfig';

interface NavItem {
    name: string;
    path: string;
    icon: React.ElementType;
    roles?: string[];
}

const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Punto de Venta', path: '/pos', icon: ShoppingCart },
    { name: 'Flujo de Caja', path: '/finance/cash-register', icon: Coins },
    { name: 'Productos', path: '/products', icon: Tag },
    { name: 'Inventario', path: '/inventory', icon: Package },
    { name: 'Lotes y Vencimientos', path: '/inventory/batches', icon: CalendarClock },
    { name: 'Merma', path: '/merma', icon: TrendingDown },
    { name: 'Compras', path: '/purchases', icon: Truck },
    { name: 'Proveedores', path: '/suppliers', icon: Users },
    { name: 'Reportes', path: '/reports', icon: BarChart2 },
    { name: 'Usuarios', path: '/users', icon: Users, roles: ['OWNER'] },
    { name: 'Auditoría', path: '/audit', icon: ShieldCheck, roles: ['OWNER'] },
    { name: 'Configuración', path: '/settings', icon: Settings, roles: ['OWNER', 'SELLER'] },
];

export interface SidebarProps {
    collapsed?: boolean;
    onCloseMobile?: () => void;
    onToggleDesktop?: () => void;
}

const getSidebarTheme = (theme: UITheme = 'emerald') => {
    switch (theme) {
        case 'indigo':
            return {
                bg: 'bg-white border-r border-slate-200/90 shadow-2xs',
                headerBorder: 'border-slate-100',
                logoBg: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700',
                LogoIcon: Store,
                logoTextColor: 'text-slate-900 font-black tracking-wider',
                activeLine: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
                activeIcon: 'text-indigo-600',
                hoverIcon: 'group-hover:text-indigo-600',
                activeBg: 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs',
                inactiveText: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
                footerBg: 'bg-slate-50/80 border-t border-slate-200/80',
                onlineBadge: 'bg-indigo-500',
            };
        case 'amber':
            return {
                bg: 'bg-white border-r border-slate-200/90 shadow-2xs',
                headerBorder: 'border-slate-100',
                logoBg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700',
                LogoIcon: Coffee,
                logoTextColor: 'text-stone-900 font-black tracking-wider',
                activeLine: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
                activeIcon: 'text-amber-600',
                hoverIcon: 'group-hover:text-amber-600',
                activeBg: 'bg-amber-50 text-amber-950 font-bold border border-amber-200/80 shadow-2xs',
                inactiveText: 'text-stone-500 hover:text-stone-900 hover:bg-stone-100/80',
                footerBg: 'bg-stone-50/80 border-t border-stone-200/80',
                onlineBadge: 'bg-amber-500',
            };
        case 'rose':
            return {
                bg: 'bg-white border-r border-slate-200/90 shadow-2xs',
                headerBorder: 'border-slate-100',
                logoBg: 'bg-gradient-to-br from-rose-500 via-rose-600 to-pink-700',
                LogoIcon: ShoppingBag,
                logoTextColor: 'text-slate-900 font-black tracking-wider',
                activeLine: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
                activeIcon: 'text-rose-600',
                hoverIcon: 'group-hover:text-rose-600',
                activeBg: 'bg-rose-50 text-rose-950 font-bold border border-rose-200/80 shadow-2xs',
                inactiveText: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
                footerBg: 'bg-slate-50/80 border-t border-slate-200/80',
                onlineBadge: 'bg-rose-500',
            };
        case 'dark':
            return {
                bg: 'bg-[#0D1117] border-r border-[#30363D] shadow-[0_0_25px_rgba(16,185,129,0.15)]',
                headerBorder: 'border-[#30363D]',
                logoBg: 'bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                LogoIcon: Store,
                logoTextColor: 'text-[#F0F6FC] font-black tracking-wider',
                activeLine: 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)]',
                activeIcon: 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
                hoverIcon: 'group-hover:text-emerald-400',
                activeBg: 'bg-[#21262D] text-[#F0F6FC] ring-1 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
                inactiveText: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
                footerBg: 'bg-[#161B22] border-t border-[#30363D] shadow-[0_0_12px_rgba(16,185,129,0.1)]',
                onlineBadge: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
            };
        case 'emerald':
        default:
            return {
                bg: 'bg-white border-r border-slate-200/90 shadow-2xs',
                headerBorder: 'border-slate-100',
                logoBg: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
                LogoIcon: Store,
                logoTextColor: 'text-slate-900 font-black tracking-wider',
                activeLine: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
                activeIcon: 'text-emerald-600',
                hoverIcon: 'group-hover:text-emerald-600',
                activeBg: 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/80 shadow-2xs',
                inactiveText: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
                footerBg: 'bg-slate-50/80 border-t border-slate-200/80',
                onlineBadge: 'bg-emerald-500',
            };
    }
};

export function Sidebar({ collapsed = false, onCloseMobile, onToggleDesktop }: SidebarProps) {
    const { user } = useAuthStore();
    const { activeTheme } = useConfigStore();
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

    const themeStyles = getSidebarTheme(activeTheme);
    const LogoIcon = themeStyles.LogoIcon;

    return (
        <div className={cn("flex flex-col h-full w-full border-r z-10 transition-all duration-300 relative", themeStyles.bg)}>
            {/* Branding Header */}
            <div className={cn("h-16 flex items-center justify-between px-3 lg:px-4 border-b mb-4 overflow-hidden shrink-0", themeStyles.headerBorder)}>
                <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-all duration-300", themeStyles.logoBg)}>
                        <LogoIcon className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <span className={cn("text-base lg:text-lg uppercase whitespace-nowrap animate-in fade-in duration-300 delay-150", themeStyles.logoTextColor)}>
                            ALLMARKET
                        </span>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={onToggleDesktop || onCloseMobile}
                        className="p-1.5 lg:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors hidden lg:block min-w-10 min-h-10 cursor-pointer"
                        aria-label="Colapsar sidebar"
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                )}
                {!collapsed && onCloseMobile && (
                    <button
                        onClick={onCloseMobile}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors lg:hidden min-w-11 min-h-11 cursor-pointer"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="px-2 lg:px-3 flex-1 overflow-y-auto override-scrollbar overflow-x-hidden pb-4">
                {!collapsed ? (
                    <div className="px-2 lg:px-3 mb-3 mt-2 text-[11px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        Principal
                    </div>
                ) : (
                    <div className="w-full h-12 mb-3 flex items-center justify-center">
                        <button
                            onClick={onToggleDesktop}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0 hidden lg:flex min-w-11 min-h-11 cursor-pointer"
                            aria-label="Expandir sidebar"
                            title="Expandir"
                        >
                            <PanelLeftOpen className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <nav className="flex flex-col space-y-1.5">
                    {navItems
                        .filter(item => isPathAllowed(item.path, user?.role))
                        .map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={collapsed && !hoveredItem ? item.name : undefined}
                            onMouseEnter={() => setHoveredItem(item.path)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={({ isActive }) =>
                                cn(
                                    "group flex items-center gap-3 py-2.5 lg:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative overflow-hidden",
                                    collapsed ? "px-0 justify-center h-11 lg:h-10 min-h-11" : "px-3",
                                    isActive
                                        ? themeStyles.activeBg
                                        : themeStyles.inactiveText
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {/* Active Indicator Line */}
                                    {isActive && (
                                        <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full transition-all", themeStyles.activeLine)} />
                                    )}

                                    <item.icon
                                        className={cn(
                                            "w-5 h-5 lg:w-4.5 lg:h-4.5 shrink-0 transition-colors duration-200",
                                            isActive ? themeStyles.activeIcon : cn("text-slate-400", themeStyles.hoverIcon)
                                        )}
                                        strokeWidth={isActive ? 2.5 : 1.75}
                                    />

                                    {!collapsed && (
                                        <span className="tracking-wide relative z-10 whitespace-nowrap">{item.name}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* User / Status Panel at Bottom */}
            <div className={cn("p-3 lg:p-4 mb-3 lg:mb-4 mt-auto shrink-0 transition-all", collapsed ? "px-1" : cn("mx-2 lg:mx-3 rounded-xl border", themeStyles.footerBg))}>
                <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
                    <div className="relative flex h-10 lg:h-9 w-10 lg:w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white font-black border border-slate-700 shadow-sm">
                        AD
                        <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900", themeStyles.onlineBadge)}></span>
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-slate-200 truncate uppercase tracking-tight">Administrador</span>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", themeStyles.onlineBadge)}></span>
                                    <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", themeStyles.onlineBadge)}></span>
                                </span>
                                <span className="truncate">Sistema en línea</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
