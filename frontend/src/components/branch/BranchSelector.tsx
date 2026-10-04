import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Store, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Branch {
    id: string;
    name: string;
}

interface BranchOption extends Branch {
    isAll?: boolean;
}

interface BranchSelectorProps {
    className?: string;
    variant?: 'topbar' | 'sidebar';
}

export function BranchSelector({ className, variant = 'topbar' }: BranchSelectorProps = {}) {
    const isSidebar = variant === 'sidebar';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const user = useAuthStore((s) => s.user);
    const selectedBranch = useAuthStore((s) => s.selectedBranch);
    const setSelectedBranch = useAuthStore((s) => s.setSelectedBranch);

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const isOwner = user.role === 'OWNER';
    const options: BranchOption[] = isOwner
        ? [{ id: 'all', name: 'Todas las sucursales', isAll: true }, ...branches]
        : branches.filter((b) => b.id === user.branchId);

    const currentOption = options.find((o) => (selectedBranch ? o.id === selectedBranch : o.isAll)) || options[0];

    if (!isOwner && !user.branchId) {
        return (
            <div className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold",
                isSidebar ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
            )}>
                <Store className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Sin sucursal</span>
            </div>
        );
    }

    if (!isOwner && options.length === 0) {
        return null;
    }

    const handleSelect = (option: BranchOption) => {
        const branchId = option.isAll ? 'all' : option.id;
        setSelectedBranch(branchId);
        setIsOpen(false);
    };

    if (isSidebar) {
        return (
            <div className={cn("relative w-full", className)} ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'flex items-center justify-between gap-2.5 w-full px-3 py-2 rounded-xl transition-all duration-200',
                        'bg-slate-800/90 hover:bg-slate-700/90 text-white border border-slate-700/70 shadow-sm',
                        isOpen && 'bg-slate-700 ring-2 ring-emerald-500/40 border-emerald-500/50'
                    )}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                            <Store className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">Sucursal</span>
                            <span className="text-xs font-bold text-white truncate max-w-[145px]">
                                {currentOption?.name || 'Seleccionar'}
                            </span>
                        </div>
                    </div>
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-[100] animate-slide-up overflow-hidden">
                        {options.map((option) => {
                            const isSelected = selectedBranch === option.id || (!selectedBranch && option.isAll) || (!isOwner && option.id === user.branchId);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors text-left',
                                        isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    )}
                                >
                                    <span className="truncate">{option.name}</span>
                                    {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("relative", className)} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all max-w-full text-xs font-semibold cursor-pointer',
                    'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-2xs',
                    isOpen && 'bg-slate-200 dark:bg-slate-700 ring-2 ring-emerald-500/20'
                )}
                title={`Sucursal: ${currentOption?.name || 'Seleccionar'}`}
            >
                <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[85px] sm:max-w-[110px] lg:max-w-[130px] truncate">
                    {currentOption?.name || 'Sucursal'}
                </span>
                <ChevronDown
                    className={cn(
                        'w-3 h-3 text-slate-400 transition-transform shrink-0',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-[100] animate-slide-up overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cambiar Sucursal</p>
                    </div>
                    {options.map((option) => {
                        const isSelected = selectedBranch === option.id || (!selectedBranch && option.isAll) || (!isOwner && option.id === user.branchId);
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => handleSelect(option)}
                                className={cn(
                                    'w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer',
                                    isSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                )}
                            >
                                <span className="truncate">{option.name}</span>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}