import { useState } from 'react';
import { 
    ArrowLeftRight, Bell, ChevronDown, LogOut, Settings, User, Menu, Keyboard,
    ShoppingCart, Package, Layers, Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { BranchSelector } from '@/components/branch/BranchSelector';
import { CloudSyncWidget } from './CloudSyncWidget';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
    Dialog, DialogContent,
} from '@/components/ui/dialog';

const SYMBOLS: Record<string, string> = { USD: '$', VES: 'Bs.', COP: '$' };
type Currency = 'USD' | 'VES' | 'COP';
const CURRENCIES: Currency[] = ['COP', 'USD', 'VES'];

interface TopBarProps {
    onToggleSidebar?: () => void;
    collapsed?: boolean;
}

export function TopBar({ onToggleSidebar, collapsed }: TopBarProps) {
    const { toCOP, fromCOP } = useConfigStore();
    const { user, logout } = useAuthStore();
    const [base, setBase] = useState<Currency>('COP');
    const [profileOpen, setProfileOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const formatRate = (from: Currency, to: Currency) => {
        // Convertimos 1 unidad de "from" a COP
        const copAmount = toCOP(1, from);
        // Convertimos los COP a "to"
        const rate = fromCOP(copAmount, to);

        return rate >= 1000
            ? rate.toLocaleString('es-VE', { maximumFractionDigits: 0 })
            : rate.toFixed(2);
    };

    const others = CURRENCIES.filter(c => c !== base);

    const navigationShortcuts = [
        { key: 'V', label: 'PUNTO DE VENTA', icon: ShoppingCart },
        { key: 'P', label: 'PRODUCTOS', icon: Package },
        { key: 'I', label: 'INVENTARIO', icon: Layers },
        { key: 'F', label: 'FINANZAS', icon: Banknote },
        { key: 'C', label: 'CONFIGURACIÓN', icon: Settings },
    ];

    return (
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-2 lg:px-5 gap-1 lg:gap-4 transition-all duration-300 shadow-sm relative z-30">
            {/* Left – Toggle + Logo */}
            <div className="flex items-center gap-1 lg:gap-4 shrink-0">
                <button 
                    onClick={onToggleSidebar}
                    className="p-2 lg:p-2 -ml-1 lg:-ml-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 min-w-11 min-h-11"
                    aria-label={collapsed ? 'Abrir menú' : 'Cerrar menú'}
                >
                    <Menu className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>

                
            </div>

            {/* Center – Exchange Rate Widget */}
            <div className={cn(
                "items-center gap-0 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shrink-0 max-w-[140px] sm:max-w-none overflow-x-auto no-scrollbar",
                collapsed ? "hidden md:flex" : "hidden xl:flex"
            )}>
                {/* Label */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 text-slate-400">
                    <ArrowLeftRight className="w-3 h-3" />
                    <span className="font-medium hidden md:block">Tasa</span>
                </div>
                <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

                {/* Currency tabs */}
                <div className="flex items-center">
                    {CURRENCIES.map(cur => (
                        <button
                            key={cur}
                            onClick={() => setBase(cur)}
                            className={cn(
                                'px-2 py-1 sm:px-2.5 rounded-lg font-semibold transition-all duration-150',
                                base === cur
                                    ? 'bg-white shadow-sm text-slate-900'
                                    : 'text-slate-400 hover:text-slate-700'
                            )}
                        >
                            {cur}
                        </button>
                    ))}
                </div>

                <div className={cn("w-px h-5 bg-slate-200 mx-1", collapsed ? "hidden lg:block" : "hidden xl:block")} />

                {/* Rates display */}
                <div className={cn("items-center", collapsed ? "hidden lg:flex" : "hidden xl:flex")}>
                    {others.map((cur, i) => (
                        <div key={cur} className="flex items-center">
                            {i > 0 && <div className="w-px h-4 bg-slate-200 mx-2" />}
                            <span className="px-2 tabular-nums text-slate-500">
                                <span className="text-slate-400">{SYMBOLS[base]}1 = </span>
                                <span className="font-bold text-slate-900">
                                    {SYMBOLS[cur]}{formatRate(base, cur)}
                                </span>
                                <span className="text-slate-400"> {cur}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right – BranchSelector + Notifications + Shortcuts + Profile */}
            <div className="flex items-center gap-1 lg:gap-3 shrink-0">
                {/* Cloud Sync Status */}
                <CloudSyncWidget />

                {/* Branch Selector */}
                <BranchSelector />

                <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                    {/* Keyboard Shortcuts */}
                    <button 
                        onClick={() => setShortcutsOpen(true)}
                        className="w-10 h-10 lg:w-9 lg:h-9 flex items-center justify-center text-slate-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all active:scale-95 min-w-10" 
                        title="Atajos de teclado (K)"
                    >
                        <Keyboard className="w-4.5 h-4.5" />
                    </button>

                    {/* Bell */}
                    <button className="relative w-10 h-10 lg:w-9 lg:h-9 flex items-center justify-center text-slate-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all active:scale-95 min-w-10" aria-label="Notificaciones">
                        <Bell className="w-4.5 h-4.5" />
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
                    </button>
                </div>

                {/* Profile */}
                <div className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-1.5 lg:py-1.5 py-1 px-1.5 lg:px-2 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
                    >
                        <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="hidden lg:block text-left">
                            <p className="text-xs font-bold text-slate-900 leading-none">{user?.nombre || 'Usuario'}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-tight italic">{user?.role || 'Invitado'}</p>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 hidden lg:block" />
                    </button>

                    {profileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-slide-up">
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                <User className="w-4 h-4" /> Mi Perfil
                            </button>
                            <button onClick={() => { setProfileOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                <Settings className="w-4 h-4" /> Configuración
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4" /> Cerrar Sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Monochromatic Minimalist Keyboard Shortcuts Dialog */}
            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
                    <div className="bg-white rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-slate-100">
                        <div className="bg-indigo-600 p-8 text-white relative">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Keyboard className="w-24 h-24 rotate-12" />
                            </div>
                            
                            <h3 className="text-2xl font-black tracking-tight mb-1">ACCESO RÁPIDO</h3>
                            <p className="text-indigo-100 text-sm font-medium">Atajos de teclado para expertos</p>
                        </div>
                        
                        <div className="p-4 bg-slate-50/50">
                            <div className="space-y-1">
                                {navigationShortcuts.map((s) => (
                                    <button
                                        key={s.key}
                                        onClick={() => {
                                            setShortcutsOpen(false);
                                            const paths: Record<string, string> = {
                                                'V': '/pos', 'P': '/products', 'I': '/inventory', 'F': '/finance', 'C': '/settings'
                                            };
                                            navigate(paths[s.key]);
                                        }}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                <s.icon className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-slate-400 tracking-wider mb-0.5 uppercase">{s.label}</p>
                                                <p className="text-sm font-bold text-indigo-600 leading-none">
                                                    CON TECLA <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md ml-1">{s.key}</span>
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all bg-white">
                                            <ArrowLeftRight className="w-4 h-4 text-indigo-600 rotate-90" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 flex justify-center border-t border-slate-100 bg-white">
                            <button 
                                onClick={() => setShortcutsOpen(false)}
                                className="text-xs font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                                Presiona <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border-b-2 border-slate-300">ESC</kbd> para salir
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    );
}
