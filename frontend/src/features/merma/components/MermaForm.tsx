import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useProducts } from '@/features/products/hooks';
import { useCreateMerma } from '../hooks';
import { MERMA_REASONS, type MermaReason, type CreateMermaInput } from '../types';
import { useToast } from '@/components/ui/use-toast';

interface MermaFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MermaForm({ open, onOpenChange }: MermaFormProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { data: productsData } = useProducts({ limit: 100 });
    const createMerma = useCreateMerma();

    const [form, setForm] = useState<CreateMermaInput>({
        productId: '',
        quantity: 0,
        reason: 'DAMAGED',
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.productId) errs.productId = 'Selecciona un producto';
        if (form.quantity <= 0) errs.quantity = 'La cantidad debe ser mayor a 0';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            await createMerma.mutateAsync(form);
            toast({ title: 'Merma registrada', description: 'La merma se ha registrado correctamente' });
            onOpenChange(false);
            setForm({ productId: '', quantity: 0, reason: 'DAMAGED', description: '' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar Merma</DialogTitle>
                    <DialogDescription>
                        Registra la merma/spoilage de productos
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Producto</Label>
                        <Select
                            value={form.productId}
                            onValueChange={v => setForm(f => ({ ...f, productId: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un producto" />
                            </SelectTrigger>
                            <SelectContent>
                                {productsData?.data?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.productId && (
                            <p className="text-sm text-red-500">{errors.productId}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Cantidad</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={form.quantity || ''}
                            onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                            placeholder="Cantidad en unidades/kg"
                        />
                        {errors.quantity && (
                            <p className="text-sm text-red-500">{errors.quantity}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Razón</Label>
                        <Select
                            value={form.reason}
                            onValueChange={(v: MermaReason) => setForm(f => ({ ...f, reason: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MERMA_REASONS.map(r => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Descripción (opcional)</Label>
                        <Input
                            value={form.description || ''}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Ej: Puntas al finalizar la pieza"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMerma.isPending}>
                            {createMerma.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Registrar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}