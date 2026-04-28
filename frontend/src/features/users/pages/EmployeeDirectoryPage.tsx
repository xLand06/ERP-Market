import { useState } from 'react';
import { Search, Plus, Edit2, UserX, UserCheck, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { UserFormModal, Branch, User } from '../components/UserFormModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Administrador', 
    SELLER: 'Vendedor',
};

const ROLE_BADGES: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
    OWNER: 'destructive', 
    SELLER: 'success',
};

function Avatar({ name }: { name: string }) {
    const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('') || 'U';
    const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500'];
    const color = colors[name.charCodeAt(0) % colors.length] || colors[0];
    return (
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', color)}>
            {initials}
        </div>
    );
}

export default function EmployeeDirectoryPage() {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const queryClient = useQueryClient();

    // Data Fetching
    const { data: users = [], isLoading, isError } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/users');
            return res.data.data;
        },
        retry: false,
    });

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        retry: false,
    });

    // Mutations
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.put(`/users/${id}`, { isActive });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Estado actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar estado. Verifica conexión.');
        }
    });

    const filtered = users.filter((e: User) => {
        const searchText = search.toLowerCase();
        const matchSearch =
            (e.nombre || '').toLowerCase().includes(searchText) ||
            (e.apellido || '').toLowerCase().includes(searchText) ||
            (e.username || '').toLowerCase().includes(searchText) ||
            (e.email || '').toLowerCase().includes(searchText);
            
        const matchStatus = 
            filterStatus === 'all' ? true :
            filterStatus === 'active' ? e.isActive === true :
            e.isActive === false;
            
        return matchSearch && matchStatus;
    });

    const handleOpenCreate = () => {
        setSelectedUser(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (u: User) => {
        setSelectedUser(u);
        setModalOpen(true);
    };

    return (
        <>
            <UserFormModal 
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                user={selectedUser}
                branches={branches}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
            />

            <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Gestión de Usuarios
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {users.filter(e => e.isActive).length} activos
                            · {users.filter(e => !e.isActive).length} inactivos
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700">
                            <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                        </Button>
                        <Button onClick={handleOpenCreate} size="lg" className="h-10 font-bold shadow-sm shadow-emerald-500/20">
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nuevo Usuario
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-50">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre, usuario o email..."
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

                {isError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm font-medium">Error al cargar datos. Verifica la conexión a la base de datos o si el sistema se encuentra offline.</p>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Directorio de empleados">
                            <thead>
                                <tr>
                                    <th className="sm:w-87.5">Empleado</th>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Sucursal</th>
                                    <th>Estado</th>
                                    <th className="w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-sm text-slate-400">
                                            Cargando empleados...
                                        </td>
                                    </tr>
                                ) : filtered.map(emp => (
                                    <tr key={emp.id} className={cn(!emp.isActive && 'opacity-60 bg-slate-50')}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <Avatar name={emp.nombre} />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{emp.nombre} {emp.apellido}</p>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        C.I: {emp.cedula || 'Sin CI'} {emp.telefono ? `· Tlf: ${emp.telefono}` : ''}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">{emp.email || 'Sin email'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="text-sm font-medium text-slate-600">{emp.username}</span>
                                        </td>
                                        <td>
                                            <Badge variant={ROLE_BADGES[emp.role] || 'default'}>
                                                {ROLE_LABELS[emp.role] || emp.role}
                                            </Badge>
                                        </td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                {branches.find(b => b.id === emp.branchId)?.name || 'Sin asignar'}
                                            </span>
                                        </td>
                                        <td>
                                            <Badge variant={emp.isActive ? 'success' : 'default'}>
                                                {emp.isActive ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenEdit(emp)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                                    aria-label={`Editar información de ${emp.nombre}`}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatusMutation.mutate({ id: emp.id, isActive: !emp.isActive })}
                                                    className={cn(
                                                        'p-1.5 rounded-lg transition-colors',
                                                        emp.isActive
                                                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    )}
                                                    aria-label={emp.isActive ? `Desactivar ${emp.nombre}` : `Activar ${emp.nombre}`}
                                                    disabled={toggleStatusMutation.isPending}
                                                >
                                                    {emp.isActive
                                                        ? <UserX className="w-4 h-4" />
                                                        : <UserCheck className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && filtered.length === 0 && !isError && (
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
