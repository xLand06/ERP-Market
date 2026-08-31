import { useState } from 'react';
import { 
    ArrowLeftRight, ChevronDown, LogOut, Settings, User, Menu, Keyboard,
    ShoppingCart, Package, Layers, Banknote, Store, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { BranchSelector } from '@/components/branch/BranchSelector';
import { CloudSyncWidget } from './CloudSyncWidget';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
    Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const SYMBOLS: Record<string, string> = { USD: '$', VES: 'Bs.', COP: '$' };
type Currency = 'USD' | 'VES' | 'COP';
const CURRENCIES: Currency[] = ['COP', 'USD', 'VES'];

interface TopBarProps {
    onToggleSidebar?: () => void;
    collapsed?: boolean;
}

export function TopBar({ onToggleSidebar, collapsed }: TopBarProps) {
    const { toUSD, fromUSD } = useConfigStore();
    const { user, logout } = useAuthStore();
    const [base, setBase] = useState<Currency>('USD');
    const [profileOpen, setProfileOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [ratePopoverOpen, setRatePopoverOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getPairInfo = (from: Currency, to: Currency) => {
        if (from === 'USD') {
            const val = fromUSD(1, to);
            const formatted = to === 'COP'
                ? val.toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
                : val.toLocaleString('es-VE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
            return {
                left: '$1 USD = ',
                right: `${SYMBOLS[to]} ${formatted}`,
            };
        }

        if (from === 'VES') {
            if (to === 'USD') {
                const val = toUSD(1, 'VES');
                return {
                    left: 'Bs. 1 VES = ',
                    right: `$ ${val.toFixed(4)} USD`,
                };
            } else {
                const val = fromUSD(toUSD(1, 'VES'), 'COP');
                return {
                    left: 'Bs. 1 VES = ',
                    right: `$ ${val.toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} COP`,
                };
            }
        }

        if (from === 'COP') {
            if (to === 'USD') {
                const val = fromUSD(1, 'COP');
                return {
                    left: '$1 USD = ',
                    right: `$ ${val.toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} COP`,
                };
            } else {
                const valVES = fromUSD(1, 'VES');
                const valCOP = fromUSD(1, 'COP');
                const vesPer1000Cop = (valVES / valCOP) * 1000;
                return {
                    left: '$1,000 COP = ',
                    right: `Bs. ${vesPer1000Cop.toFixed(2)} VES`,
                };
            }
        }

        return { left: '', right: '' };
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
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-6 gap-3 transition-all duration-300 shadow-2xs relative z-30 min-w-0">
            {/* Left – Sidebar Toggle */}
            <div className="flex items-center gap-2 shrink-0">
                <button 
                    onClick={onToggleSidebar}
                    className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 flex items-center justify-center"
                    aria-label={collapsed ? 'Abrir menú' : 'Cerrar menú'}
                >
                    <Menu className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
            </div>

            {/* Center – Exchange Rate Widget */}
            <div className="flex items-center shrink-0">
                {/* Desktop Full Rates Bar */}
                <div className="hidden lg:flex items-center gap-0 bg-slate-50 border border-slate-200/80 rounded-xl p-1 text-xs">
                    <div className="flex items-center gap-1.5 px-2 text-slate-400">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-semibold text-slate-600">Tasa</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200 mx-1" />

                    {/* Currency tabs */}
                    <div className="flex items-center bg-slate-200/50 p-0.5 rounded-lg">
                        {CURRENCIES.map(cur => (
                            <button
                                key={cur}
                                onClick={() => setBase(cur)}
                                className={cn(
                                    'px-2 py-0.5 rounded-md font-bold text-[11px] transition-all duration-150',
                                    base === cur
                                        ? 'bg-white shadow-sm text-indigo-600'
                                        : 'text-slate-400 hover:text-slate-700'
                                )}
                            >
                                {cur}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-4 bg-slate-200 mx-1.5" />

                    {/* Rates display */}
                    <div className="flex items-center">
                        {others.map((cur, i) => {
                            const pair = getPairInfo(base, cur);
                            return (
                                <div key={cur} className="flex items-center">
                                    {i > 0 && <div className="w-px h-3.5 bg-slate-200 mx-2" />}
                                    <span className="px-1.5 tabular-nums text-slate-600 text-xs font-medium">
                                        <span className="text-slate-400">{pair.left}</span>
                                        <span className="font-extrabold text-slate-900">{pair.right}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Mobile / Tablet Compact Rate Trigger */}
                <div className="relative lg:hidden">
                    <button
                        onClick={() => setRatePopoverOpen(!ratePopoverOpen)}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                        title="Ver tasas de cambio"
                    >
                        <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-bold text-xs">{base}</span>
                        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", ratePopoverOpen && "rotate-180")} />
                    </button>

                    {ratePopoverOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 animate-slide-up">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Moneda Base</span>
                                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                    {CURRENCIES.map(cur => (
                                        <button
                                            key={cur}
                                            onClick={() => setBase(cur)}
                                            className={cn(
                                                'px-2 py-0.5 rounded-md text-[11px] font-bold transition-all',
                                                base === cur
                                                    ? 'bg-white shadow text-indigo-600'
                                                    : 'text-slate-400 hover:text-slate-700'
                                            )}
                                        >
                                            {cur}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                {others.map((cur) => {
                                    const pair = getPairInfo(base, cur);
                                    return (
                                        <div key={cur} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold">
                                            <span className="text-slate-500">{pair.left}</span>
                                            <span className="text-slate-950 font-black">{pair.right}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right – BranchSelector + Shortcuts + Profile */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
                <CloudSyncWidget />
                <BranchSelector />

                <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/80 p-0.5 sm:p-1 rounded-xl border border-slate-200/50">
                    <button 
                        onClick={() => setShortcutsOpen(true)}
                        className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 items-center justify-center text-slate-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all active:scale-95" 
                        title="Atajos de teclado (K)"
                    >
                        <Keyboard className="w-4 h-4" />
                    </button>
                    <button 
                        className="relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center text-slate-500 hover:bg-white hover:text-indigo-600 rounded-lg transition-all active:scale-95"
                        aria-label="Notificaciones"
                    >
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
                    </button>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-1.5 py-1 px-1 sm:px-2 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
                    >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md shrink-0">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
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
                        <div className="bg-emerald-600 p-8 text-white relative">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Keyboard className="w-24 h-24 rotate-12" />
                            </div>
                            
                            <DialogTitle className="text-2xl font-black tracking-tight mb-1 text-white">ACCESO RÁPIDO</DialogTitle>
                            <DialogDescription className="text-emerald-100 text-sm font-medium">Atajos de teclado para expertos</DialogDescription>
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
                                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                                <s.icon className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-black text-slate-400 tracking-wider mb-0.5 uppercase">{s.label}</p>
                                                <p className="text-sm font-bold text-emerald-600 leading-none">
                                                    CON TECLA <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md ml-1">{s.key}</span>
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all bg-white">
                                            <ArrowLeftRight className="w-4 h-4 text-emerald-600 rotate-90" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 flex justify-center border-t border-slate-100 bg-white">
                            <button 
                                onClick={() => setShortcutsOpen(false)}
                                className="text-xs font-black text-slate-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-2"
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
