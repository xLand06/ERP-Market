import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowLeftRight, Users, CreditCard, Shield, Hexagon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Inventario', path: '/inventory', icon: Package },
    { name: 'Compras', path: '/purchases', icon: ArrowLeftRight },
    { name: 'Flujo de Caja', path: '/cashflow', icon: CreditCard },
    { name: 'Directorio', path: '/directory', icon: Users },
    { name: 'Auditoría', path: '/logs', icon: Shield },
];

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside 
            className={cn(
                "bg-slate-900 border-r border-slate-800 h-full hidden md:flex flex-col shrink-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)] z-10 transition-all duration-300 relative",
                isCollapsed ? "w-20" : "w-65"
            )}
        >
            {/* Branding Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 mb-4 overflow-hidden shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                        <Hexagon size={18} className="fill-white/20" strokeWidth={2.5} />
                    </div>
                    {!isCollapsed && (
                        <span className="font-bold text-white text-lg tracking-tight whitespace-nowrap animate-in fade-in duration-300 delay-150">
                            ERP-Market
                        </span>
                    )}
                </div>
                {!isCollapsed && (
                    <button 
                        onClick={() => setIsCollapsed(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="px-3 flex-1 overflow-y-auto override-scrollbar overflow-x-hidden">
                {!isCollapsed ? (
                    <div className="px-3 mb-3 mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        Principal
                    </div>
                ) : (
                    <div className="w-full h-8 mb-3 flex items-center justify-center">
                        <button 
                            onClick={() => setIsCollapsed(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                            title="Expandir"
                        >
                            <PanelLeftOpen className="w-5 h-5" />
                        </button>
                    </div>
                )}
                
                <nav className="flex flex-col space-y-1.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={isCollapsed ? item.name : undefined}
                            className={({ isActive }) =>
                                cn(
                                    "group flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden",
                                    isCollapsed ? "px-0 justify-center" : "px-3",
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
                                            "w-4.5 h-4.5 shrink-0 transition-colors duration-200",
                                            isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"
                                        )} 
                                        strokeWidth={isActive ? 2 : 1.5} 
                                    />
                                    
                                    {!isCollapsed && (
                                        <span className="tracking-wide relative z-10 whitespace-nowrap">{item.name}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>
            
            {/* User / Status Panel at Bottom */}
            <div className={cn("p-4 mb-4", isCollapsed ? "px-2" : "mx-3 rounded-xl bg-slate-800/50 border border-slate-700/50")}>
                <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white font-bold border border-slate-600 shadow-sm">
                        AD
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-800"></span>
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-slate-200 truncate">Administrador</span>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Sistema en línea
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
