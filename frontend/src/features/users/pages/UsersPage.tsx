import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function UsersPage() {
    return (
        <div className="flex flex-col gap-4 max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-900">Gestión de Usuarios</h1>
                <Button size="sm"><Plus className="w-4 h-4" /> Nuevo Usuario</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-sm text-slate-400">Tabla de usuarios del sistema...</p>
            </div>
        </div>
    );
}
