import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ProductsPage() {
    return (
        <div className="flex flex-col gap-4 max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-900">Productos</h1>
                <Button size="sm"><Plus className="w-4 h-4" /> Nuevo Producto</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-sm text-slate-400">Catálogo de productos maestro...</p>
            </div>
        </div>
    );
}
