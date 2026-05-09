import { useState } from 'react';
import { 
    Plus, 
    Search, 
    Filter, 
    User as UserIcon, 
    Shield, 
    MoreHorizontal, 
    Edit, 
    Power,
    CheckCircle2,
    XCircle,
    Mail,
    Phone,
    Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useUsers } from '../hooks';
import { UserFormModal } from '../components/UserFormModal';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '../types';

export default function UsersPage() {
    const [filters, setFilters] = useState({
        search: '',
        role: '',
        isActive: ''
    });
    
    const { data: users = [], isLoading, refetch } = useUsers(filters);
    
    // Fetch branches for the modal
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        }
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setModalOpen(true);
    };

    const handleCreateUser = () => {
        setSelectedUser(null);
        setModalOpen(true);
    };

    const handleToggleStatus = async (user: User) => {
        try {
            await api.put(`/users/${user.id}`, { isActive: !user.isActive });
            refetch();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-slate-500 mt-1">Administra las cuentas de acceso y permisos del sistema.</p>
                </div>
                <Button 
                    onClick={handleCreateUser}
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all flex items-center gap-2 px-6 py-6 rounded-xl"
                >
                    <Plus className="w-5 h-5" /> 
                    <span className="font-bold">Nuevo Usuario</span>
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nombre, usuario o email..."
                        className="pl-10 bg-white border-slate-200 rounded-xl h-11 focus:ring-2 focus:ring-indigo-500/20"
                        value={filters.search}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                </div>
                
                <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none text-sm font-medium"
                        value={filters.role}
                        onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
                    >
                        <option value="">Todos los roles</option>
                        <option value="OWNER">Administrador</option>
                        <option value="SELLER">Vendedor</option>
                    </select>
                </div>

                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none text-sm font-medium"
                        value={filters.isActive}
                        onChange={(e) => setFilters(f => ({ ...f, isActive: e.target.value }))}
                    >
                        <option value="">Todos los estados</option>
                        <option value="true">Activos</option>
                        <option value="false">Inactivos</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Contacto</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/30" />
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                                <UserIcon className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-slate-500 font-medium">No se encontraron usuarios</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm border",
                                                    user.role === 'OWNER' 
                                                        ? "bg-indigo-50 text-indigo-600 border-indigo-100" 
                                                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                )}>
                                                    {(user.nombre?.[0] || user.username?.[0]).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900">
                                                        {user.nombre} {user.apellido}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">@{user.username}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <Badge className={cn(
                                                    "w-fit font-bold uppercase text-[10px] tracking-widest px-2.5 py-0.5 border shadow-none rounded-lg",
                                                    user.role === 'OWNER' 
                                                        ? "bg-indigo-100 text-indigo-700 border-indigo-200" 
                                                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                )}>
                                                    {user.role === 'OWNER' ? 'Administrador' : 'Vendedor'}
                                                </Badge>
                                                {user.branch && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                        <Briefcase className="w-3 h-3" />
                                                        {user.branch.name}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {user.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        {user.email}
                                                    </div>
                                                )}
                                                {user.telefono && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                        {user.telefono}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={cn(
                                                "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full w-fit",
                                                user.isActive 
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                            )}>
                                                {user.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {user.isActive ? 'Activo' : 'Inactivo'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full">
                                                        <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl shadow-xl border-slate-200">
                                                    <DropdownMenuItem 
                                                        onClick={() => handleEditUser(user)}
                                                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                                                    >
                                                        <Edit className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium text-slate-700">Editar Perfil</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleToggleStatus(user)}
                                                        className={cn(
                                                            "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer font-medium",
                                                            user.isActive ? "text-amber-600" : "text-emerald-600"
                                                        )}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                        {user.isActive ? 'Desactivar Cuenta' : 'Reactivar Cuenta'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <UserFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                user={selectedUser}
                branches={branches}
                onSuccess={() => {
                    refetch();
                    setModalOpen(false);
                }}
            />
        </div>
    );
}
