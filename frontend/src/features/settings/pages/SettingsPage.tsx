import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Settings2, Building2, Tag, AlertTriangle, HardDrive } from 'lucide-react';
import { SystemSettings, BranchesTab, CategoriesTab, MaintenanceTab } from '../components';
import { BackupPanel } from '@/features/backup/BackupPanel';

type Tab = 'branches' | 'categories' | 'maintenance' | 'system' | 'backup';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('branches');

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
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

    const tabs = [
        { id: 'branches' as Tab, label: 'Sucursales', icon: Building2, count: branches.length },
        { id: 'categories' as Tab, label: 'Grupos y Subgrupos', icon: Tag, count: groups.length },
        { id: 'system' as Tab, label: 'Configuración Global', icon: Settings2 },
        { id: 'maintenance' as Tab, label: 'Mantenimiento', icon: AlertTriangle },
        { id: 'backup' as Tab, label: 'Backup & Nube', icon: HardDrive },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'branches':
                return <BranchesTab />;
            case 'categories':
                return <CategoriesTab />;
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
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            <div className="mb-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Configuración del Sistema</h1>
                <p className="text-xs text-slate-400 mt-1 font-medium">Gestiona parámetros operativos, sucursales y clasificaciones.</p>
            </div>

            <div className="border-b border-slate-200">
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 cursor-pointer text-sm font-bold border-b-[3px] transition-colors rounded-t-xl hover:bg-slate-50 ${activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            aria-selected={activeTab === tab.id}
                            role="tab"
                        >
                            <tab.icon className="w-4.5 h-4.5" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-1 px-2.5 py-0.5 rounded-full text-[11px] ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-500'
                                    }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {renderContent()}
        </div>
    );
}