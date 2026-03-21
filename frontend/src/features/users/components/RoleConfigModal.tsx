import { useState } from 'react';
import { Shield } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EmployeeRole } from '@/types/erp.types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoleConfigModalProps {
    open: boolean;
    onClose: () => void;
    employeeName: string;
    currentRole: EmployeeRole;
    onSave: (role: EmployeeRole) => void;
}

const ROLES: { key: EmployeeRole; label: string; description: string; color: string }[] = [
    { key: 'admin',       label: 'Administrador',   description: 'Acceso total al sistema.',            color: 'border-purple-400 bg-purple-50 text-purple-800' },
    { key: 'supervisor',  label: 'Supervisor',      description: 'Supervisión de operaciones y reportes.', color: 'border-blue-400 bg-blue-50 text-blue-800' },
    { key: 'cashier',     label: 'Cajero/a',        description: 'Acceso al POS y flujo de caja.',      color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
    { key: 'warehouse',   label: 'Almacenista',     description: 'Gestión de inventario y compras.',    color: 'border-amber-400 bg-amber-50 text-amber-800' },
];

export function RoleConfigModal({ open, onClose, employeeName, currentRole, onSave }: RoleConfigModalProps) {
    const [selectedRole, setSelectedRole] = useState<EmployeeRole>(currentRole);

    const handleSave = () => {
        onSave(selectedRole);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-125">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        Configurar Rol
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona el rol de acceso para <strong>{employeeName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-2.5" role="radiogroup" aria-label="Roles disponibles">
                    {ROLES.map(role => (
                        <button
                            key={role.key}
                            type="button"
                            role="radio"
                            aria-checked={selectedRole === role.key}
                            onClick={() => setSelectedRole(role.key)}
                            className={cn(
                                'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
                                selectedRole === role.key
                                    ? role.color + ' border-current'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                            )}
                        >
                            <div className={cn(
                                'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                                selectedRole === role.key ? 'border-current bg-current' : 'border-slate-300'
                            )}>
                                {selectedRole === role.key && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold">{role.label}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} className="shadow-sm shadow-purple-500/20">
                        Guardar Rol
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
