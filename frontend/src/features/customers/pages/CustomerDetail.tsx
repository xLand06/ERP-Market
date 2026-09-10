import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Users, Loader2, AlertCircle, Phone, Mail, MapPin, BadgeCheck,
    Wallet, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { useCustomerStatement, useRecordPayment } from '../hooks/useCustomers';
import type { CreditSale, CustomerPayment } from '../types';

const fmtMoney = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    other: 'Otro',
};

/**
 * Formulario de abono (cobranza parcial o total)
 */
function AbonoForm({ customerId, balance }: { customerId: string; balance: number }) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'cash' | 'transfer' | 'card' | 'other'>('cash');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    const recordPayment = useRecordPayment(customerId);

    const canSubmit = Number(amount) > 0 && Number(amount) <= balance + 0.005 && !recordPayment.isPending;

    const handleSubmit = () => {
        if (!canSubmit) return;
        recordPayment.mutate({
            amount: Number(amount),
            method,
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
        }, {
            onSuccess: () => {
                setAmount('');
                setReference('');
                setNotes('');
            },
        });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Registrar Abono
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="abono-monto" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Monto *
                    </label>
                    <Input
                        id="abono-monto"
                        type="number"
                        min="0.01"
                        max={balance}
                        step="0.01"
                        placeholder={`Saldo pendiente: ${fmtMoney(balance)}`}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="abono-metodo" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Método de Pago
                    </label>
                    <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                        <SelectTrigger id="abono-metodo" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                            <SelectItem value="card">Tarjeta</SelectItem>
                            <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="abono-ref" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Referencia
                    </label>
                    <Input
                        id="abono-ref"
                        placeholder="Nro de transferencia, cheque..."
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="abono-notas" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Notas
                    </label>
                    <Input
                        id="abono-notas"
                        placeholder="Observaciones del pago"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </div>

            {Number(amount) > balance + 0.005 && (
                <p className="text-xs text-red-500">El abono no puede exceder el saldo pendiente ({fmtMoney(balance)}).</p>
            )}

            <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
                {recordPayment.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                ) : (
                    <><Plus className="w-4 h-4 mr-2" /> Registrar Abono</>
                )}
            </Button>
        </div>
    );
}

export default function CustomerDetail() {
    const { id } = useParams<{ id: string }>();
    const [editOpen, setEditOpen] = useState(false);

    const { data: statement, isLoading, isError } = useCustomerStatement(id);

    const renderSaleRow = (sale: CreditSale) => (
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-700 truncate">
                    {new Date(sale.createdAt).toLocaleString('es-VE')}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">#{sale.id.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-[11px] text-slate-400">{sale.items.length} ítems</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">{fmtMoney(sale.total)}</span>
            </div>
        </div>
    );

    const renderPaymentRow = (payment: CustomerPayment) => (
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-700 truncate">
                    {new Date(payment.createdAt).toLocaleString('es-VE')}
                </span>
                <span className="text-[11px] text-slate-400">
                    {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
            </div>
            <span className="text-sm font-bold tabular-nums text-emerald-600 shrink-0">
                -{fmtMoney(payment.amount)}
            </span>
        </div>
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (isError || !statement) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-slate-400">
                <AlertCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">No se pudo cargar el estado de cuenta del cliente</p>
                <Link to="/customers" className="text-xs text-indigo-600 font-semibold hover:underline">
                    Volver a clientes
                </Link>
            </div>
        );
    }

    const { customer, balance, totalCreditSales, totalPayments, creditSales, payments } = statement;

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            <CustomerFormModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onSuccess={() => setEditOpen(false)}
                initial={customer}
                mode="edit"
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <Link
                    to="/customers"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a clientes
                </Link>
                <Button variant="outline" onClick={() => setEditOpen(true)}>Editar Cliente</Button>
            </div>

            {/* Info del cliente */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">{customer.name}</h1>
                                <p className="text-xs text-slate-400 font-mono">{customer.cedula || 'Sin cédula'}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-slate-500">
                            {customer.phone && (
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}</span>
                            )}
                            {customer.email && (
                                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> {customer.email}</span>
                            )}
                            {customer.address && (
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {customer.address}</span>
                            )}
                        </div>
                    </div>
                    <Badge variant={customer.isActive ? 'success' : 'default'}>
                        {customer.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                </div>

                {/* Resumen financiero */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Saldo Pendiente</p>
                        <p className={`text-xl font-black tabular-nums mt-1 ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {fmtMoney(balance)}
                        </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Límite de Crédito</p>
                        <p className="text-xl font-black tabular-nums mt-1 text-slate-900">
                            {customer.creditLimit != null ? fmtMoney(customer.creditLimit) : 'Sin límite'}
                        </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas a Crédito</p>
                        <p className="text-xl font-black tabular-nums mt-1 text-indigo-600">{fmtMoney(totalCreditSales)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Abonado</p>
                        <p className="text-xl font-black tabular-nums mt-1 text-emerald-600">{fmtMoney(totalPayments)}</p>
                    </div>
                </div>
            </div>

            {/* Abono + Estado de cuenta */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Ventas a crédito */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <BadgeCheck className="w-4 h-4 text-indigo-600" /> Ventas a Crédito
                        </h3>
                        {creditSales.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">Este cliente no tiene ventas a crédito.</p>
                        ) : (
                            <div className="mt-3">
                                {creditSales.map(sale => renderSaleRow(sale))}
                            </div>
                        )}
                    </div>

                    {/* Abonos */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-emerald-600" /> Historial de Abonos
                        </h3>
                        {payments.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">Aún no se registran abonos para este cliente.</p>
                        ) : (
                            <div className="mt-3">
                                {payments.map(payment => renderPaymentRow(payment))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Formulario de abono */}
                <div className="lg:col-span-1">
                    <AbonoForm customerId={customer.id} balance={balance} />
                </div>
            </div>
        </div>
    );
}