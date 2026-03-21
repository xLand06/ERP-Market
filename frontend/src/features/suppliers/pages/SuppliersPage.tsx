import { useState } from 'react';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SupplierFormModal } from '../components/SupplierFormModal';


interface Supplier {
    id: string; name: string; rif: string; category: string;
    active: boolean; lastOrder: string; owedUSD: number; owedStatus: 'paid' | 'pending' | 'overdue';
    phone: string; email: string; address: string; paymentTerms: string;
}

interface Invoice {
    num: string; date: string; dueDate: string; amount: number;
    status: 'paid' | 'pending' | 'overdue' | 'upcoming';
}

const SUPPLIERS: Supplier[] = [
    { id:'1', name:'Distribuidora La Montaña', rif:'J-30122456-1', category:'Abarrotes', active:true,  lastOrder:'hace 2 días',  owedUSD:1240, owedStatus:'pending',  phone:'+58 212 555-0100', email:'ventas@lamontana.com', address:'Av. Principal, Caracas',    paymentTerms:'30 días' },
    { id:'2', name:'Lácteos del Norte',        rif:'J-28567890-5', category:'Lácteos',   active:true,  lastOrder:'hace 5 días',  owedUSD:0,    owedStatus:'paid',     phone:'+58 261 555-0200', email:'info@lacteosnorte.com', address:'Zona Industrial, Maracaibo', paymentTerms:'15 días' },
    { id:'3', name:'Aceites Venezuela',        rif:'J-12345678-9', category:'Aceites',   active:true,  lastOrder:'hace 1 semana', owedUSD:3800, owedStatus:'overdue',  phone:'+58 212 555-0123', email:'ventas@aceitesvzla.com', address:'Av. Principal, Caracas',   paymentTerms:'30 días' },
    { id:'4', name:'Importadora Global',       rif:'J-40098765-3', category:'Varios',    active:false, lastOrder:'hace 1 mes',   owedUSD:0,    owedStatus:'paid',     phone:'+58 212 555-0300', email:'info@importglobal.com', address:'Centro Comercial, Valencia', paymentTerms:'60 días' },
    { id:'5', name:'Carnes Premium',           rif:'J-33456789-2', category:'Carnes',    active:true,  lastOrder:'hace 3 días',  owedUSD:560,  owedStatus:'pending',  phone:'+58 412 555-0400', email:'pedidos@carnespremium.com', address:'Mercado Central, Barquisimeto', paymentTerms:'7 días' },
    { id:'6', name:'Bebidas y Más',            rif:'J-25678901-7', category:'Bebidas',   active:true,  lastOrder:'hace 4 días',  owedUSD:1100, owedStatus:'pending',  phone:'+58 424 555-0500', email:'ventas@bebidasmas.com', address:'Zona Norte, Caracas',       paymentTerms:'30 días' },
];

const INVOICES: Invoice[] = [
    { num:'FA-2024-0142', date:'15/01/2024', dueDate:'14/02/2024', amount:1800, status:'overdue'  },
    { num:'FA-2024-0198', date:'01/02/2024', dueDate:'02/03/2024', amount:1200, status:'upcoming' },
    { num:'FA-2024-0215', date:'10/02/2024', dueDate:'11/03/2024', amount:800,  status:'pending'  },
];

const INVOICE_BADGE: Record<Invoice['status'], { variant: 'destructive' | 'warning' | 'success' | 'info'; label: string }> = {
    overdue:  { variant: 'destructive', label: 'Vencida'  },
    upcoming: { variant: 'warning',     label: 'Próxima'  },
    pending:  { variant: 'info',        label: 'Pendiente'},
    paid:     { variant: 'success',     label: 'Pagada'   },
};

const STATUS_COLORS: Record<Supplier['owedStatus'], string> = {
    paid:    'text-emerald-600',
    pending: 'text-amber-600',
    overdue: 'text-red-600',
};

export default function SuppliersPage() {
    const [selected, setSelected] = useState<Supplier>(SUPPLIERS[2]);
    const [search, setSearch]     = useState('');
    const [modalOpen, setModalOpen] = useState(false);

    const filtered = SUPPLIERS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    const overdue  = INVOICES.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    const pending  = INVOICES.filter(i => i.status !== 'paid' && i.status !== 'overdue').reduce((s, i) => s + i.amount, 0);

    return (
        <>
        <SupplierFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSave={data => { console.log('New supplier:', data); setModalOpen(false); }}
        />
        <div className="flex flex-col gap-5 max-w-350 mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Control de Proveedores</h1>
                    <p className="text-xs text-slate-400 mt-1">{SUPPLIERS.filter(s => s.active).length} proveedores activos</p>
                </div>
                <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Agregar Proveedor</Button>
            </div>

            {/* Split panel */}
            <div className="flex gap-4 min-h-150">
                {/* LEFT: Supplier List */}
                <div className="w-85 shrink-0 flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {filtered.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelected(s)}
                                className={cn(
                                    'flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all duration-150',
                                    selected.id === s.id
                                        ? 'bg-white border-emerald-300 border-l-4 border-l-emerald-500 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('w-2 h-2 rounded-full shrink-0', s.active ? 'bg-emerald-500' : 'bg-slate-300')} />
                                        <span className="text-sm font-semibold text-slate-900 leading-snug">{s.name}</span>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                </div>
                                <div className="flex items-center justify-between ml-4">
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.category}</span>
                                    <div className="text-right">
                                        {s.owedUSD > 0 ? (
                                            <span className={cn('text-xs font-bold tabular-nums', STATUS_COLORS[s.owedStatus])}>
                                                ${s.owedUSD.toLocaleString()}
                                                {s.owedStatus === 'overdue' && <Bell className="inline w-3 h-3 ml-1" />}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Pagado
                                            </span>
                                        )}
                                        <p className="text-[10px] text-slate-400">{s.lastOrder}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Detail */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
                    {/* Detail header */}
                    <div className="flex items-start justify-between p-6 border-b border-slate-100">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                            <p className="text-sm text-slate-400 mt-0.5">RIF: {selected.rif}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={selected.active ? 'success' : 'default'}>
                                {selected.active ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <Button variant="outline" size="sm">Editar</Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50">Desactivar</Button>
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-4 p-6 border-b border-slate-100">
                        {[
                            { icon: Phone,  label:'Teléfono', val: selected.phone    },
                            { icon: Mail,   label:'Email',    val: selected.email     },
                            { icon: MapPin, label:'Dirección', val: selected.address  },
                            { icon: Check,  label:'Términos',  val: selected.paymentTerms },
                        ].map(({ icon: Icon, label, val }) => (
                            <div key={label} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                                    <p className="text-sm text-slate-700">{val}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Invoices */}
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Cuentas por Pagar</h3>
                        <table className="w-full erp-table">
                            <thead>
                                <tr>
                                    <th>Factura</th><th>Fecha</th><th>Vencimiento</th>
                                    <th className="text-right">Monto</th><th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {INVOICES.map(inv => {
                                    const meta = INVOICE_BADGE[inv.status];
                                    return (
                                        <tr key={inv.num}>
                                            <td><span className="font-mono text-xs text-slate-600">{inv.num}</span></td>
                                            <td className="text-xs text-slate-500">{inv.date}</td>
                                            <td className="text-xs">
                                                <span className={cn(inv.status === 'overdue' ? 'text-red-600 font-semibold' : inv.status === 'upcoming' ? 'text-amber-600 font-medium' : 'text-slate-500')}>
                                                    {inv.dueDate}
                                                </span>
                                            </td>
                                            <td className="text-right tabular-nums text-sm font-semibold text-slate-900">
                                                ${inv.amount.toLocaleString()}
                                            </td>
                                            <td><Badge variant={meta.variant}>{meta.label}</Badge></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Totals + Action */}
                        <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencido</p>
                                    <p className="text-lg font-black text-red-600 tabular-nums">${overdue.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pendiente</p>
                                    <p className="text-lg font-black text-amber-600 tabular-nums">${pending.toLocaleString()}</p>
                                </div>
                            </div>
                            <Button size="sm">
                                <Check className="w-4 h-4" /> Registrar Pago
                            </Button>
                        </div>
                    </div>

                    {/* Recent Orders mini-table */}
                    <div className="p-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Últimas Órdenes</h3>
                        <table className="w-full erp-table">
                            <thead>
                                <tr><th>Fecha</th><th>Orden</th><th className="text-right">Monto</th><th>Ítems</th><th>Estado</th></tr>
                            </thead>
                            <tbody>
                                {[
                                    { date:'10/02/2024', num:'OC-0215', monto:800,  items:12, status:'Recibida'  },
                                    { date:'01/02/2024', num:'OC-0198', monto:1200, items:8,  status:'En tránsito'},
                                    { date:'15/01/2024', num:'OC-0142', monto:1800, items:20, status:'Entregada' },
                                ].map(o => (
                                    <tr key={o.num}>
                                        <td className="text-xs text-slate-500">{o.date}</td>
                                        <td><span className="font-mono text-xs text-slate-600">{o.num}</span></td>
                                        <td className="text-right tabular-nums text-sm font-semibold">${o.monto.toLocaleString()}</td>
                                        <td className="text-center text-sm text-slate-500">{o.items}</td>
                                        <td><Badge variant={o.status === 'Recibida' || o.status === 'Entregada' ? 'success' : 'info'}>{o.status}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
