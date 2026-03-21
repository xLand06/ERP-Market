import { useState } from 'react';
import { ArrowLeftRight, Bell, ChevronDown, LogOut, Settings, User, Menu, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const RATES: Record<string, number> = { USD: 1, VES: 36.50, COP: 4100 };
const SYMBOLS: Record<string, string> = { USD: '$', VES: 'Bs.', COP: '$' };
type Currency = 'USD' | 'VES' | 'COP';
const CURRENCIES: Currency[] = ['USD', 'VES', 'COP'];

interface TopBarProps {
    onToggleSidebar?: () => void;
    collapsed?: boolean;
}

export function TopBar({ onToggleSidebar, collapsed }: TopBarProps) {
    const [base, setBase] = useState<Currency>('USD');
    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    const formatRate = (from: Currency, to: Currency) => {
        const rate = RATES[to] / RATES[from];
        return rate >= 1000
            ? rate.toLocaleString('es-VE', { maximumFractionDigits: 0 })
            : rate.toFixed(2);
    };

    const others = CURRENCIES.filter(c => c !== base);

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 gap-4">
            {/* Left - Spacer or Breadcrumbs could go here */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Empty for now to let Sidebar handle branding */}
            </div>

            {/* Center – Exchange Rate Widget */}
            <div className="flex items-center gap-0 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shrink-0 max-w-[140px] sm:max-w-none overflow-x-auto min-[400px]:flex hidden no-scrollbar">
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

                <div className="w-px h-5 bg-slate-200 mx-1 hidden lg:block" />

                {/* Rates display */}
                <div className="hidden lg:flex items-center">
                    {others.map((cur, i) => (
                        <div key={cur} className="flex items-center">
                            {i > 0 && <div className="w-px h-4 bg-slate-200 mx-2" />}
                            <span className="px-2 tabular-nums text-slate-500">
                                <span className="text-slate-400">{SYMBOLS[cur]}1 = </span>
                                <span className="font-bold text-slate-900">
                                    {SYMBOLS[base]}{formatRate(cur, base)}
                                </span>
                                <span className="text-slate-400"> {base}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right – Notifications + Profile */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Branch Selector (Global) */}
                <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-600 transition-all">
                    <span className="text-xs font-medium text-slate-500 ml-1">Sucursal:</span>
                    <select className="bg-transparent border-none text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0 cursor-pointer pr-1">
                        <option>Central (A)</option>
                        <option>Norte (B)</option>
                    </select>
                </div>
                <div className="w-px h-5 bg-slate-200 mx-1 hidden md:block" />

                {/* Bell */}
                <button className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-label="Notificaciones">
                    <Bell className="w-4.5 h-4.5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
                </button>

                {/* Profile */}
                <div className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-2 py-1.5 px-1.5 sm:px-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-xs font-semibold text-slate-900 leading-none">Admin</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Administrador</p>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                    </button>

                    {profileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-slide-up">
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <User className="w-4 h-4" /> Mi Perfil
                            </button>
                            <button onClick={() => navigate('/users')} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <Settings className="w-4 h-4" /> Configuración
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                <LogOut className="w-4 h-4" /> Cerrar Sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
