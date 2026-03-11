import {
    LayoutDashboard, Package, ShoppingCart, Receipt,
    Coins, BarChart3, Users, Truck, Tag, Store, ChevronRight,
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
    { label: 'Dashboard',      icon: LayoutDashboard, href: '/dashboard', section: 'Principal' },
    { label: 'Punto de Venta', icon: ShoppingCart,    href: '/pos',       badge: 'F1' },
    { label: 'Inventario',     icon: Package,         href: '/inventory', section: 'Gestión' },
    { label: 'Proveedores',    icon: Truck,           href: '/suppliers' },
    { label: 'Productos',      icon: Store,           href: '/products' },
    { label: 'Lotes',          icon: Tag,             href: '/inventory/batches' },
    { label: 'Ventas',         icon: Receipt,         href: '/sales',     section: 'Finanzas' },
    { label: 'Finanzas',       icon: Coins,           href: '/finance' },
    { label: 'Reportes',       icon: BarChart3,        href: '/reports' },
    { label: 'Usuarios',       icon: Users,           href: '/users',     section: 'Admin' },
];

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
    const navigate = useNavigate();
    const location = useLocation();
    let lastSection = '';

    return (
        <div className="flex flex-col h-full gap-0.5">
            {/* Brand mark (collapsed) */}
            {collapsed && (
                <div className="flex justify-center mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-blue-900 flex items-center justify-center">
                        <span className="text-[10px] font-black text-white">EM</span>
                    </div>
                </div>
            )}

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
                                    <span className="text-[10px] font-mono bg-blue-900/60 text-blue-300 rounded px-1.5 py-0.5">
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
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 pt-3 pb-1">
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
                    <p className="text-[10px] text-slate-600 text-center">ERP-Market v2.0</p>
                </div>
            )}
        </div>
    );
}
