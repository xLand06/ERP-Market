import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Search, Smartphone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';
import { cn, normalizeText } from '@/lib/utils';
import { useCustomers } from '../hooks/useCustomers';
import {
    useCreateIncomingPayment,
    useRejectIncomingPayment,
    useVerifyIncomingPayment,
} from '../hooks/useIncomingPayments';
import type { IncomingPaymentRow } from '@/services/incoming-payments.service';

const fmtMoney = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const formatFecha = (iso: string) =>
    new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

function Field({ label, id, children, error }: {
    label: string; id: string; children: React.ReactNode; error?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {label}
            </label>
            {children}
            {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
        </div>
    );
}

/**
 * Selector de cliente searchable (mismo patrón que el modo fiado de
 * PaymentDialog): lista activos y filtra por nombre/cédula en el cliente.
 */
function CustomerPicker({ customerId, onSelect }: {
    customerId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const [search, setSearch] = useState('');
    const { data: customers = [], isLoading } = useCustomers({ isActive: true });

    const selected = customers.find(c => c.id === customerId) || null;
    const filtered = customers.filter(c =>
        normalizeText(c.name).includes(search) ||
        normalizeText(c.cedula || '').includes(search)
    );

    if (selected) {
        return (
            <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{selected.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                        {selected.cedula || 'Sin cédula'} · Saldo {fmtMoney(selected.balance)}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 shrink-0 transition-colors"
                >
                    Cambiar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Buscar cliente por nombre o cédula..."
                    value={search}
                    onChange={e => setSearch(normalizeText(e.target.value))}
                    className="pl-9"
                    aria-label="Buscar cliente"
                />
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {isLoading && (
                    <p className="text-[11px] text-slate-400 text-center py-3">Cargando clientes...</p>
                )}
                {!isLoading && filtered.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-3">Sin resultados</p>
                )}
                {filtered.map(c => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelect(c.id)}
                        className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px] hover:bg-indigo-50 transition-colors"
                    >
                        <span className="text-xs font-semibold text-slate-800 truncate">{c.name}</span>
                        <span className={cn('text-[10px] tabular-nums font-bold shrink-0', c.balance > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                            {fmtMoney(c.balance)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

interface IncomingPaymentsPanelProps {
    payments: IncomingPaymentRow[];
    isLoading: boolean;
    isError: boolean;
}

export function IncomingPaymentsPanel({ payments, isLoading, isError }: IncomingPaymentsPanelProps) {
    const userRole = (useAuthStore(s => s.user?.role) as string) || '';
    const canVerify = userRole === 'OWNER' || userRole === 'MANAGER';
    const fmtVES = useConfigStore(s => s.fmtVES);
    const toUSD = useConfigStore(s => s.toUSD);

    const createMutation = useCreateIncomingPayment();
    const verifyMutation = useVerifyIncomingPayment();
    const rejectMutation = useRejectIncomingPayment();

    // ── Captura manual ───────────────────────────────────────────────────────
    const emptyForm = { amountVes: '', reference: '', senderPhone: '', senderBank: '', notes: '' };
    const [manualOpen, setManualOpen] = useState(false);
    const [manualForm, setManualForm] = useState(emptyForm);
    const [manualCustomerId, setManualCustomerId] = useState<string | null>(null);
    const [manualErrors, setManualErrors] = useState<{ amountVes?: string; reference?: string }>({});

    // ── Verificar ────────────────────────────────────────────────────────────
    const [verifyRow, setVerifyRow] = useState<IncomingPaymentRow | null>(null);
    const [verifyCustomerId, setVerifyCustomerId] = useState<string | null>(null);

    // ── Rechazar ─────────────────────────────────────────────────────────────
    const [rejectRow, setRejectRow] = useState<IncomingPaymentRow | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectError, setRejectError] = useState<string | undefined>();

    const setManual = (key: keyof typeof emptyForm, val: string) =>
        setManualForm(prev => ({ ...prev, [key]: val }));

    const closeManual = () => {
        setManualOpen(false);
        setManualForm(emptyForm);
        setManualCustomerId(null);
        setManualErrors({});
    };

    const handleManualSubmit = () => {
        const errs: typeof manualErrors = {};
        if (!manualForm.amountVes || Number(manualForm.amountVes) <= 0) errs.amountVes = 'El monto debe ser mayor a 0';
        if (!manualForm.reference.trim()) errs.reference = 'La referencia es requerida';
        setManualErrors(errs);
        if (Object.keys(errs).length > 0) return;

        createMutation.mutate(
            {
                amountVes: Number(manualForm.amountVes),
                reference: manualForm.reference.trim(),
                senderPhone: manualForm.senderPhone.trim() || undefined,
                senderBank: manualForm.senderBank.trim() || undefined,
                customerId: manualCustomerId || undefined,
                notes: manualForm.notes.trim() || undefined,
            },
            { onSuccess: () => closeManual() }
        );
    };

    const openVerify = (row: IncomingPaymentRow) => {
        setVerifyRow(row);
        setVerifyCustomerId(row.customerId);
    };

    const verifyReady = !!verifyRow && !!(verifyRow.customerId || verifyCustomerId);

    const handleVerify = () => {
        if (!verifyRow || !verifyReady) return;
        verifyMutation.mutate(
            { id: verifyRow.id, customerId: verifyCustomerId || undefined },
            { onSuccess: () => setVerifyRow(null) }
        );
    };

    const openReject = (row: IncomingPaymentRow) => {
        setRejectRow(row);
        setRejectReason('');
        setRejectError(undefined);
    };

    const handleReject = () => {
        if (!rejectRow) return;
        if (!rejectReason.trim()) {
            setRejectError('El motivo es requerido');
            return;
        }
        rejectMutation.mutate(
            { id: rejectRow.id, reason: rejectReason.trim() },
            { onSuccess: () => setRejectRow(null) }
        );
    };

    const renderActions = (row: IncomingPaymentRow) => (canVerify ? (
        <>
            <button
                type="button"
                onClick={() => openVerify(row)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
                <CheckCircle2 className="w-3.5 h-3.5" /> Verificar
            </button>
            <button
                type="button"
                onClick={() => openReject(row)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors"
            >
                <XCircle className="w-3.5 h-3.5" /> Rechazar
            </button>
        </>
    ) : null);

    const columns: Column<IncomingPaymentRow>[] = [
        {
            key: 'fecha',
            header: 'Fecha',
            cell: row => <span className="text-xs text-slate-500 whitespace-nowrap">{formatFecha(row.createdAt)}</span>,
            showCard: true,
        },
        {
            key: 'cliente',
            header: 'Cliente sugerido',
            cell: row => (
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                        {row.customer?.name || 'Sin cliente'}
                    </span>
                    {row.customer?.phone && (
                        <span className="text-[11px] text-slate-400 font-mono">{row.customer.phone}</span>
                    )}
                </div>
            ),
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'monto',
            header: 'Monto',
            cell: row => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold tabular-nums text-slate-800">{fmtVES(row.amountVes)}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">
                        {fmtMoney(row.amountBase != null ? row.amountBase : toUSD(row.amountVes, 'VES'))}
                        {row.amountBase == null && ' (por verificar)'}
                    </span>
                </div>
            ),
            className: 'text-right',
            headerClassName: 'text-right',
            showCard: true,
        },
        {
            key: 'banco',
            header: 'Banco',
            cell: row => <span className="text-xs text-slate-500">{row.senderBank || '—'}</span>,
            hideBelow: 'md',
        },
        {
            key: 'referencia',
            header: 'Referencia',
            cell: row => <span className="text-xs font-mono text-slate-600">{row.reference}</span>,
            showCard: true,
        },
        {
            key: 'origen',
            header: 'Origen',
            cell: row => (
                row.source === 'WEBHOOK'
                    ? <Badge variant="info">Webhook</Badge>
                    : <Badge variant="secondary">Manual</Badge>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Pagos por verificar
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Reclamos de Pago Móvil pendientes de acreditación como abono de CxC
                    </p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setManualOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Registrar pago manual
                </Button>
            </div>

            {/* Cola */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isError && (
                    <div className="p-4 bg-red-50 text-red-600 flex items-center gap-2 m-4 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        <p className="text-sm">Error al cargar los pagos pendientes</p>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    rows={payments}
                    rowKey={row => row.id}
                    isLoading={isLoading}
                    empty={{
                        icon: <Smartphone className="w-8 h-8 text-slate-200" />,
                        title: 'No hay pagos por verificar',
                        description: 'Los reclamos de Pago Móvil aparecerán aquí cuando lleguen por webhook o se registren manualmente.',
                    }}
                    actions={renderActions}
                />
            </div>

            {/* Captura manual */}
            <Dialog open={manualOpen} onOpenChange={o => !o && closeManual()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                <Smartphone className="w-4 h-4 text-indigo-600" />
                            </div>
                            Registrar pago manual
                        </DialogTitle>
                        <DialogDescription>
                            El pago quedará pendiente de verificación antes de acreditarse como abono.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Monto (Bs) *" id="amountVes" error={manualErrors.amountVes}>
                                <Input
                                    id="amountVes"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="1500,00"
                                    value={manualForm.amountVes}
                                    onChange={e => setManual('amountVes', e.target.value)}
                                    className={cn(manualErrors.amountVes && 'border-red-400')}
                                    aria-invalid={!!manualErrors.amountVes}
                                />
                            </Field>
                            <Field label="Referencia *" id="reference" error={manualErrors.reference}>
                                <Input
                                    id="reference"
                                    placeholder="0001234567"
                                    value={manualForm.reference}
                                    onChange={e => setManual('reference', e.target.value)}
                                    className={cn(manualErrors.reference && 'border-red-400')}
                                    aria-invalid={!!manualErrors.reference}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Teléfono emisor" id="senderPhone">
                                <Input
                                    id="senderPhone"
                                    placeholder="+58 212 555-0100"
                                    value={manualForm.senderPhone}
                                    onChange={e => setManual('senderPhone', e.target.value)}
                                />
                            </Field>
                            <Field label="Banco" id="senderBank">
                                <Input
                                    id="senderBank"
                                    placeholder="Banco de Venezuela"
                                    value={manualForm.senderBank}
                                    onChange={e => setManual('senderBank', e.target.value)}
                                />
                            </Field>
                        </div>

                        <Field label="Cliente (opcional)" id="customerId">
                            <CustomerPicker customerId={manualCustomerId} onSelect={setManualCustomerId} />
                        </Field>

                        <Field label="Notas" id="notes">
                            <Input
                                id="notes"
                                placeholder="Detalles adicionales del pago"
                                value={manualForm.notes}
                                onChange={e => setManual('notes', e.target.value)}
                            />
                        </Field>
                    </div>

                    <DialogFooter className="border-t border-slate-100 p-6">
                        <Button variant="outline" onClick={closeManual} disabled={createMutation.isPending}>Cancelar</Button>
                        <Button onClick={handleManualSubmit} disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Verificar */}
            <Dialog open={!!verifyRow} onOpenChange={o => !o && setVerifyRow(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Verificar pago</DialogTitle>
                        <DialogDescription>
                            Se creará un abono y se descontará el saldo del cliente. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    {verifyRow && (
                        <div className="px-6 py-4 space-y-4">
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex flex-col gap-1">
                                <span className="text-sm font-bold text-slate-800 tabular-nums">
                                    {fmtVES(verifyRow.amountVes)}
                                    <span className="text-xs font-medium text-slate-400 ml-2">
                                        ≈ {fmtMoney(toUSD(verifyRow.amountVes, 'VES'))}
                                    </span>
                                </span>
                                <span className="text-[11px] font-mono text-slate-500">
                                    Ref. {verifyRow.reference} · {verifyRow.senderBank || 'Banco no registrado'}
                                </span>
                                {verifyRow.customer && (
                                    <span className="text-xs text-slate-600">
                                        Cliente: <span className="font-semibold">{verifyRow.customer.name}</span>
                                    </span>
                                )}
                            </div>

                            {!verifyRow.customerId && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                        Seleccionar cliente *
                                    </label>
                                    <CustomerPicker customerId={verifyCustomerId} onSelect={setVerifyCustomerId} />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setVerifyRow(null)} disabled={verifyMutation.isPending}>Cancelar</Button>
                        <Button onClick={handleVerify} disabled={!verifyReady || verifyMutation.isPending}>
                            {verifyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Verificar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rechazar */}
            <Dialog open={!!rejectRow} onOpenChange={o => !o && setRejectRow(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rechazar pago</DialogTitle>
                        <DialogDescription>
                            El pago no se acreditará y el saldo del cliente no cambiará.
                        </DialogDescription>
                    </DialogHeader>

                    {rejectRow && (
                        <div className="px-6 pb-2">
                            <Field label="Motivo del rechazo *" id="rejectReason" error={rejectError}>
                                <Input
                                    id="rejectReason"
                                    placeholder="Ej: referencia duplicada"
                                    value={rejectReason}
                                    onChange={e => { setRejectReason(e.target.value); setRejectError(undefined); }}
                                    className={cn(rejectError && 'border-red-400')}
                                    aria-invalid={!!rejectError}
                                />
                            </Field>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setRejectRow(null)} disabled={rejectMutation.isPending}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                            {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Rechazar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
