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

export function BranchSelector() {
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Store className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-700 font-medium">Sin sucursal asignada</span>
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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
                    'hover:bg-slate-100 text-slate-700',
                    isOpen && 'bg-slate-100'
                )}
            >
                <Store className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                    {currentOption?.name || 'Seleccionar'}
                </span>
                <ChevronDown
                    className={cn(
                        'w-3 h-3 text-slate-400 transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-slide-up">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option)}
                            className={cn(
                                'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                                selectedBranch === option.id ||
                                (!selectedBranch && option.isAll) ||
                                (!isOwner && option.id === user.branchId)
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                            )}
                        >
                            <span className="truncate">{option.name}</span>
                            {(selectedBranch === option.id ||
                                (!selectedBranch && option.isAll) ||
                                (!isOwner && option.id === user.branchId)) && (
                                <Check className="w-4 h-4 text-indigo-600" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}