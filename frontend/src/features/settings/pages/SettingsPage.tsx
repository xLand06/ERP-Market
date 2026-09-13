import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Settings2,
    Building2,
    Tag,
    AlertTriangle,
    HardDrive,
    Printer,
    Globe,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Check
} from 'lucide-react';
import {
    SystemSettings,
    InvoiceSettings,
    BranchesTab,
    CategoriesTab,
    MaintenanceTab,
    CatalogSettings,
    BillingSettings
} from '../components';
import { BackupPanel } from '@/features/backup/BackupPanel';
import { useAuthStore } from '@/features/auth/store/authStore';

type Tab = 'branches' | 'categories' | 'invoice' | 'system' | 'maintenance' | 'backup' | 'catalog' | 'billing';

interface TabItem {
    id: Tab;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    category: 'Operación' | 'Facturación' | 'Sistema';
}

export default function SettingsPage() {
    const user = useAuthStore(s => s.user);
    const userRole = (user?.role as string) || '';
    const isOwner = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'GERENTE' || !userRole;
    const [activeTab, setActiveTab] = useState<Tab>(isOwner ? 'branches' : 'system');
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const tabsListRef = useRef<HTMLDivElement>(null);
    const activeTabButtonRef = useRef<HTMLButtonElement>(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', 'all'],
        queryFn: async () => {
            const res = await api.get('/branches?includeInactive=true');
            return res.data.data;
        },
        retry: false
    });

    const { data: groups = [] } = useQuery({
        queryKey: ['groups'],
        queryFn: async () => {
            const res = await api.get('/groups');
            return res.data.data;
        },
        retry: false
    });

    const allTabs: TabItem[] = [
        {
            id: 'branches',
            label: 'Sucursales',
            description: 'Gestión de locales, cajas y puntos de venta',
            icon: Building2,
            count: branches.length,
            category: 'Operación'
        },
        {
            id: 'categories',
            label: 'Grupos y Subgrupos',
            description: 'Clasificación y categorización de productos',
            icon: Tag,
            count: groups.length,
            category: 'Operación'
        },
        {
            id: 'catalog',
            label: 'Catálogo Digital',
            description: 'Configuración de catálogo público y pedidos online',
            icon: Globe,
            category: 'Operación'
        },
        {
            id: 'invoice',
            label: 'Facturación e Impresora',
            description: 'Formatos de ticket, impresoras térmicas y fiscales',
            icon: Printer,
            category: 'Facturación'
        },
        {
            id: 'billing',
            label: 'Mi Suscripción',
            description: 'Planes activos, pagos y facturación del servicio',
            icon: CreditCard,
            category: 'Facturación'
        },
        {
            id: 'system',
            label: 'Configuración Global',
            description: 'Parámetros del sistema, monedas y preferencias',
            icon: Settings2,
            category: 'Sistema'
        },
        {
            id: 'backup',
            label: 'Backup & Nube',
            description: 'Copias de seguridad, sincronización y restauración',
            icon: HardDrive,
            category: 'Sistema'
        },
        {
            id: 'maintenance',
            label: 'Mantenimiento',
            description: 'Depuración, cache y herramientas de soporte',
            icon: AlertTriangle,
            category: 'Sistema'
        },
    ];

    const tabs = isOwner ? allTabs : allTabs.filter(t => t.id === 'system' || t.id === 'invoice');
    const currentTabInfo = tabs.find(t => t.id === activeTab) || tabs[0];

    // Scroll active tab into view smoothly when changed
    useEffect(() => {
        if (activeTabButtonRef.current && tabsListRef.current) {
            const container = tabsListRef.current;
            const button = activeTabButtonRef.current;
            const containerWidth = container.offsetWidth;
            const buttonLeft = button.offsetLeft;
            const buttonWidth = button.offsetWidth;

            const scrollTarget = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);
            container.scrollTo({
                left: Math.max(0, scrollTarget),
                behavior: 'smooth'
            });
        }
    }, [activeTab]);

    const handleScroll = (direction: 'left' | 'right') => {
        if (tabsListRef.current) {
            const scrollAmount = direction === 'left' ? -220 : 220;
            tabsListRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = tabs.findIndex(t => t.id === activeTab);
        if (e.key === 'ArrowRight') {
            const nextIndex = (currentIndex + 1) % tabs.length;
            setActiveTab(tabs[nextIndex].id);
        } else if (e.key === 'ArrowLeft') {
            const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            setActiveTab(tabs[prevIndex].id);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'branches':
                return <BranchesTab />;
            case 'categories':
                return <CategoriesTab />;
            case 'invoice':
                return <InvoiceSettings />;
            case 'catalog':
                return <CatalogSettings />;
            case 'billing':
                return <BillingSettings />;
            case 'system':
                return <SystemSettings />;
            case 'backup':
                return <BackupPanel />;
            case 'maintenance':
                return <MaintenanceTab />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col gap-5 sm:gap-6 max-w-[1400px] mx-auto pb-12 px-1 sm:px-0">
            {/* Header with Title & Quick Info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Settings2 className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
                        <span>Configuración del Sistema</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        Administra parámetros operativos, sucursales, facturación y mantenimiento.
                    </p>
                </div>

                {/* Mobile Selector Dropdown Button */}
                <div className="relative md:hidden w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setShowMobileMenu(prev => !prev)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-xs text-sm font-semibold text-slate-800 min-h-[48px] active:bg-slate-50"
                        aria-expanded={showMobileMenu}
                    >
                        <div className="flex items-center gap-2.5 truncate">
                            <currentTabInfo.icon className="w-5 h-5 text-indigo-600 shrink-0" />
                            <span className="truncate">{currentTabInfo.label}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMobileMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showMobileMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
                                onClick={() => setShowMobileMenu(false)}
                            />
                            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setShowMobileMenu(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3.5 text-left text-sm transition-colors min-h-[48px] ${
                                            activeTab === tab.id
                                                ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                                                : 'text-slate-700 hover:bg-slate-50 font-medium'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <div>
                                                <div>{tab.label}</div>
                                                <div className="text-[11px] text-slate-400 font-normal leading-tight">{tab.category}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {tab.count !== undefined && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
                                                    {tab.count}
                                                </span>
                                            )}
                                            {activeTab === tab.id && <Check className="w-4 h-4 text-indigo-600" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Desktop & Tablet Navigation Bar */}
            <div className="relative bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                {/* Horizontal scroll indicators */}
                <button
                    type="button"
                    onClick={() => handleScroll('left')}
                    aria-label="Desplazar pestañas a la izquierda"
                    className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-lg bg-white/90 shadow-md text-slate-600 hover:text-slate-900 hover:bg-white backdrop-blur-xs transition-all border border-slate-200/60"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                    ref={tabsListRef}
                    onKeyDown={handleKeyDown}
                    role="tablist"
                    aria-label="Pestañas de configuración"
                    className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1 sm:px-9 py-0.5 touch-pan-x"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                ref={isActive ? activeTabButtonRef : null}
                                onClick={() => setActiveTab(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                tabIndex={isActive ? 0 : -1}
                                className={`group flex items-center gap-2.5 px-4 py-2.5 min-h-[46px] rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 select-none cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                    isActive
                                        ? 'bg-white text-indigo-900 shadow-sm shadow-slate-200/80 border border-slate-200/80'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                                }`}
                            >
                                <tab.icon
                                    className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-colors ${
                                        isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                                    }`}
                                />
                                <span className="whitespace-nowrap">{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'bg-slate-200/70 text-slate-500 group-hover:bg-slate-200'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => handleScroll('right')}
                    aria-label="Desplazar pestañas a la derecha"
                    className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-lg bg-white/90 shadow-md text-slate-600 hover:text-slate-900 hover:bg-white backdrop-blur-xs transition-all border border-slate-200/60"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Context Breadcrumb & Quick Description of Active Tab */}
            <div className="hidden sm:flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-xl text-xs text-slate-600">
                <div className="flex items-center gap-2 font-medium">
                    <span className="text-slate-400">Configuración</span>
                    <span className="text-slate-300">/</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold">
                        {currentTabInfo.category}
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">{currentTabInfo.label}</span>
                </div>
                <span className="text-slate-400 font-normal">{currentTabInfo.description}</span>
            </div>

            {/* Active Tab Content Area */}
            <main className="transition-opacity duration-200">
                {renderContent()}
            </main>
        </div>
    );
}