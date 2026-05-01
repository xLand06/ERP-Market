import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
    LayoutDashboard, Package, ShoppingCart,
    Coins, Users, Truck, BarChart2, ShieldCheck, Store, PanelLeftClose, PanelLeftOpen, X,
    Settings, Tag, TrendingDown
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
    { name: 'Productos', path: '/products', icon: Tag },
    { name: 'Inventario', path: '/inventory', icon: Package },
    { name: 'Flujo de Caja', path: '/finance/cash-register', icon: Coins },
    { name: 'Configuración', path: '/settings', icon: Settings, roles: ['OWNER'] },
    { name: 'Auditoría', path: '/audit', icon: ShieldCheck, roles: ['OWNER'] },
    { name: 'Usuarios', path: '/users', icon: Users, roles: ['OWNER'] },
    { name: 'Compras', path: '/purchases', icon: Truck },
    { name: 'Reportes', path: '/reports', icon: BarChart2 },
    { name: 'Proveedores', path: '/suppliers', icon: Users },
    { name: 'Merma', path: '/merma', icon: TrendingDown },
];

export interface SidebarProps {
    collapsed?: boolean;
    onCloseMobile?: () => void;
    onToggleDesktop?: () => void;
}
export function Sidebar({ collapsed = false, onCloseMobile, onToggleDesktop }: SidebarProps) {
    const { user } = useAuthStore();
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-full w-full bg-slate-900 border-r border-slate-800 z-10 transition-all duration-300 relative">
            {/* Branding Header */}
            <div className="h-16 flex items-center justify-between px-3 lg:px-4 border-b border-slate-800 mb-4 overflow-hidden shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
                        <Store className="w-4 h-4 text-white" />
                    </div>
                    {!collapsed && (
                        <span className="font-bold text-white text-base lg:text-lg tracking-tight whitespace-nowrap animate-in fade-in duration-300 delay-150">
                            ABASTOS SOFIMAR
                        </span>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={onToggleDesktop || onCloseMobile}
                        className="p-1.5 lg:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden lg:block min-w-10 min-h-10"
                        aria-label="Colapsar sidebar"
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                )}
                {!collapsed && onCloseMobile && (
                    <button
                        onClick={onCloseMobile}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden min-w-11 min-h-11"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="px-2 lg:px-3 flex-1 overflow-y-auto override-scrollbar overflow-x-hidden pb-4">
                {!collapsed ? (
                    <div className="px-2 lg:px-3 mb-3 mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        Principal
                    </div>
                ) : (
                    <div className="w-full h-12 mb-3 flex items-center justify-center">
                        <button
                            onClick={onToggleDesktop}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 hidden lg:flex min-w-11 min-h-11"
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
                                    "group flex items-center gap-3 py-2.5 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden",
                                    collapsed ? "px-0 justify-center h-11 lg:h-10 min-h-11" : "px-3",
                                    isActive
                                        ? "bg-slate-800/80 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ring-1 ring-white/5"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {/* Active Indicator Line */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_8px_rgba(16,183,127,0.4)]" />
                                    )}

                                    <item.icon
                                        className={cn(
                                            "w-5 h-5 lg:w-4.5 lg:h-4.5 shrink-0 transition-colors duration-200",
                                            isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"
                                        )}
                                        strokeWidth={isActive ? 2 : 1.5}
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
            <div className={cn("p-3 lg:p-4 mb-3 lg:mb-4 mt-auto shrink-0", collapsed ? "px-1" : "mx-2 lg:mx-3 rounded-xl bg-slate-800/50 border border-slate-700/50")}>
                <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
                    <div className="relative flex h-10 lg:h-9 w-10 lg:w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white font-bold border border-slate-600 shadow-sm">
                        AD
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-800"></span>
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-slate-200 truncate">Administrador</span>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
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
