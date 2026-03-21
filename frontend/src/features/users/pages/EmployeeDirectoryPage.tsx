import { useState } from 'react';
import { Search, Plus, UserCog, UserX, UserCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { RoleConfigModal } from '../components/RoleConfigModal';
import type { Employee, EmployeeRole, EmployeeStatus } from '@/types/erp.types';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_EMPLOYEES: Employee[] = [
    { id: '1', name: 'María González',  email: 'maria@sofimar.com',  phone: '0416-1234567', role: 'admin',      branch: 'Principal',  status: 'active',   startDate: '2023-01-15' },
    { id: '2', name: 'Carlos Pérez',    email: 'carlos@sofimar.com', phone: '0424-7654321', role: 'cashier',    branch: 'Sucursal A', status: 'active',   startDate: '2023-04-01' },
    { id: '3', name: 'Laura Martínez',  email: 'laura@sofimar.com',  phone: '0412-5551234', role: 'warehouse',  branch: 'Principal',  status: 'active',   startDate: '2023-06-10' },
    { id: '4', name: 'José Rodríguez',  email: 'jose@sofimar.com',   phone: '0426-9876543', role: 'supervisor', branch: 'Sucursal B', status: 'inactive', startDate: '2022-11-20' },
    { id: '5', name: 'Ana Torres',      email: 'ana@sofimar.com',    phone: '0414-3334455', role: 'cashier',    branch: 'Sucursal A', status: 'active',   startDate: '2024-02-05' },
];

const ROLE_LABELS: Record<EmployeeRole, string> = {
    admin: 'Administrador', supervisor: 'Supervisor', cashier: 'Cajero/a', warehouse: 'Almacenista',
};

const ROLE_BADGES: Record<EmployeeRole, 'default' | 'success' | 'warning' | 'destructive'> = {
    admin: 'destructive', supervisor: 'warning', cashier: 'success', warehouse: 'default',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
    const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('');
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', color)}>
            {initials}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeeDirectoryPage() {
    const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<EmployeeStatus | 'all'>('all');
    const [roleModal, setRoleModal] = useState<{ open: boolean; employee: Employee | null }>({
        open: false, employee: null,
    });

    const filtered = employees.filter(e => {
        const matchSearch =
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.email.toLowerCase().includes(search.toLowerCase()) ||
            e.branch.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || e.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const toggleStatus = (id: string) =>
        setEmployees(prev => prev.map(e =>
            e.id === id ? { ...e, status: e.status === 'active' ? 'inactive' : 'active' } : e
        ));

    const handleSaveRole = (role: EmployeeRole) => {
        if (!roleModal.employee) return;
        setEmployees(prev => prev.map(e =>
            e.id === roleModal.employee!.id ? { ...e, role } : e
        ));
    };

    return (
        <>
            {roleModal.employee && (
                <RoleConfigModal
                    open={roleModal.open}
                    onClose={() => setRoleModal({ open: false, employee: null })}
                    employeeName={roleModal.employee.name}
                    currentRole={roleModal.employee.role}
                    onSave={handleSaveRole}
                />
            )}

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Directorio de Empleados
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {employees.filter(e => e.status === 'active').length} activos
                            · {employees.filter(e => e.status === 'inactive').length} inactivos
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700">
                            <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                        </Button>
                        <Button size="lg" className="h-10 font-bold shadow-sm shadow-emerald-500/20">
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nuevo Empleado
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-50">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre, email o sucursal..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                            aria-label="Buscar empleados"
                        />
                    </div>
                    <div className="flex gap-1.5" role="group" aria-label="Filtrar por estado">
                        {(['all', 'active', 'inactive'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                    filterStatus === s
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                )}
                            >
                                {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Directorio de empleados">
                            <thead>
                                <tr>
                                    <th className="sm:w-87.5">Empleado</th>
                                    <th>Rol</th>
                                    <th>Sucursal</th>
                                    <th>Estado</th>
                                    <th>Desde</th>
                                    <th className="w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(emp => (
                                    <tr key={emp.id} className={cn(emp.status === 'inactive' && 'opacity-60')}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <Avatar name={emp.name} />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                                                    <p className="text-xs text-slate-400">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={ROLE_BADGES[emp.role]}>
                                                {ROLE_LABELS[emp.role]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                {emp.branch}
                                            </span>
                                        </td>
                                        <td>
                                            <Badge variant={emp.status === 'active' ? 'success' : 'default'}>
                                                {emp.status === 'active' ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </td>
                                        <td className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                            {new Date(emp.startDate).toLocaleDateString('es-VE', {
                                                day: '2-digit', month: 'short', year: 'numeric',
                                            })}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setRoleModal({ open: true, employee: emp })}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                                    aria-label={`Configurar rol de ${emp.name}`}
                                                >
                                                    <UserCog className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(emp.id)}
                                                    className={cn(
                                                        'p-1.5 rounded-lg transition-colors',
                                                        emp.status === 'active'
                                                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    )}
                                                    aria-label={emp.status === 'active' ? `Desactivar ${emp.name}` : `Activar ${emp.name}`}
                                                >
                                                    {emp.status === 'active'
                                                        ? <UserX className="w-4 h-4" />
                                                        : <UserCheck className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-sm text-slate-400">
                                            No hay empleados que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
