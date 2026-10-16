import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

/* ── Estilos inyectados ─────────────────────────────────────────────────── */

const paymentsStyles = `
.pay-row:hover {
    background: #f8fafc !important;
}
@media (max-width: 768px) {
    .pay-table thead { display: none; }
    .pay-table tbody { display: flex; flex-direction: column; gap: 0.75rem; }
    .pay-table tr {
        display: block;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 0.5rem 1rem;
        background: #fff !important;
    }
    .pay-table td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.4rem 0 !important;
        border-bottom: 1px dashed #f1f5f9;
    }
    .pay-table td:last-child { border-bottom: none; }
    .pay-table td::before {
        content: attr(data-label);
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        flex-shrink: 0;
    }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('payments-page-styles')) {
    const style = document.createElement('style');
    style.id = 'payments-page-styles';
    style.textContent = paymentsStyles;
    document.head.appendChild(style);
}

interface Payment {
    id: string;
    tenantId: string;
    amountCents: number;
    currency: string;
    status: string;
    provider: string | null;
    externalId?: string | null;
    notes: string | null;
    createdAt: string;
    tenant: { slug: string; domain: string };
}

interface IncomingSms {
    id: string;
    reference: string | null;
    amountVes: number | null;
    senderBank: string | null;
    senderPhone: string | null;
    rawPayload: string;
    status: 'PENDING' | 'MATCHED' | 'DISMISSED';
    matchedPaymentId: string | null;
    matchedTenantId: string | null;
    createdAt: string;
}

interface TenantSimple {
    id: string;
    slug: string;
    domain: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PENDING: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    OVERDUE: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    FAILED: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    REFUNDED: { bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6' },
    CANCELLED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
    MATCHED: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    DISMISSED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
};

const PROVIDER_LABELS: Record<string, string> = {
    zelle: 'Zelle',
    pago_movil: 'Pago Movil',
    transferencia: 'Transferencia',
    binance: 'Binance',
    cash: 'Efectivo',
    other: 'Otro',
};

const PROVIDER_FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'pago_movil', label: 'Pago Movil' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'binance', label: 'Binance' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'other', label: 'Otro' },
];

export default function Payments() {
    const [activeTab, setActiveTab] = useState<'payments' | 'sms'>('payments');
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [providerFilter, setProviderFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Incoming SMS states
    const [smsList, setSmsList] = useState<IncomingSms[]>([]);
    const [smsLoading, setSmsLoading] = useState(false);
    const [tenants, setTenants] = useState<TenantSimple[]>([]);
    const [assignModal, setAssignModal] = useState<{ open: boolean; sms: IncomingSms | null; tenantId: string }>({
        open: false,
        sms: null,
        tenantId: '',
    });
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        setPage(1);
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (providerFilter) params.set('provider', providerFilter);
        const qs = params.toString();

        apiFetch<Payment[]>(`/api/payments${qs ? `?${qs}` : ''}`)
            .then((data) => setPayments(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [statusFilter, providerFilter]);

    const loadSms = () => {
        setSmsLoading(true);
        apiFetch<IncomingSms[]>('/api/payments/incoming-sms')
            .then((data) => setSmsList(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setSmsLoading(false));
    };

    useEffect(() => {
        if (activeTab === 'sms') {
            loadSms();
            if (tenants.length === 0) {
                apiFetch<any[]>('/api/tenants')
                    .then((data) => {
                        if (Array.isArray(data)) {
                            setTenants(data.map((t) => ({ id: t.id, slug: t.slug, domain: t.domain })));
                        }
                    })
                    .catch(console.error);
            }
        }
    }, [activeTab]);

    const handleAssignTenant = async () => {
        if (!assignModal.sms || !assignModal.tenantId) return;
        setAssigning(true);
        try {
            await apiFetch(`/api/payments/incoming-sms/${assignModal.sms.id}/match`, {
                method: 'POST',
                body: { tenantId: assignModal.tenantId },
            });
            setAssignModal({ open: false, sms: null, tenantId: '' });
            loadSms();
            // Refresh payments too
            apiFetch<Payment[]>('/api/payments').then((data) => setPayments(Array.isArray(data) ? data : []));
        } catch (err: any) {
            alert(err.message || 'Error asociando SMS a tenant');
        } finally {
            setAssigning(false);
        }
    };

    const handleDismissSms = async (id: string) => {
        if (!confirm('¿Descartar este SMS de pago?')) return;
        try {
            await apiFetch(`/api/payments/incoming-sms/${id}/dismiss`, { method: 'POST' });
            loadSms();
        } catch (err: any) {
            alert(err.message || 'Error descartando SMS');
        }
    };

    const pendingSmsCount = smsList.filter((s) => s.status === 'PENDING').length;

    const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = payments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    if (loading && activeTab === 'payments') return <p style={{ color: '#64748b' }}>Cargando pagos...</p>;

    return (
        <div>
            {/* Modal de Asignación a Tenant */}
            {assignModal.open && assignModal.sms && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: 16,
                        maxWidth: 480,
                        width: '100%',
                        padding: '1.5rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                    }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                            Conciliar Pago con Tenant
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
                            Asociá este Pago Móvil recibido al tenant correspondiente para acreditar su mensualidad y reactivar su servicio si estaba suspendido.
                        </p>

                        <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ color: '#64748b' }}>Banco:</span>
                                <strong>{assignModal.sms.senderBank || 'Desconocido'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ color: '#64748b' }}>Monto:</span>
                                <strong style={{ color: '#059669' }}>Bs. {assignModal.sms.amountVes?.toFixed(2) || '---'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Referencia:</span>
                                <code style={{ fontWeight: 600 }}>{assignModal.sms.reference}</code>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                                Seleccionar Tenant:
                            </label>
                            <select
                                value={assignModal.tenantId}
                                onChange={(e) => setAssignModal({ ...assignModal, tenantId: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem',
                                }}
                            >
                                <option value="">-- Elegí el negocio / tenant --</option>
                                {tenants.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.slug} ({t.domain})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setAssignModal({ open: false, sms: null, tenantId: '' })}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#475569',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssignTenant}
                                disabled={!assignModal.tenantId || assigning}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: !assignModal.tenantId || assigning ? 'not-allowed' : 'pointer',
                                    opacity: !assignModal.tenantId || assigning ? 0.6 : 1,
                                }}
                            >
                                {assigning ? 'Conciliando...' : 'Confirmar y Activar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pestañas Principales */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <button
                    onClick={() => setActiveTab('payments')}
                    style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 8,
                        border: 'none',
                        background: activeTab === 'payments' ? '#0f172a' : '#f1f5f9',
                        color: activeTab === 'payments' ? '#fff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                >
                    Historial de Pagos Tenants
                </button>
                <button
                    onClick={() => setActiveTab('sms')}
                    style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 8,
                        border: 'none',
                        background: activeTab === 'sms' ? '#059669' : '#f1f5f9',
                        color: activeTab === 'sms' ? '#fff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease',
                    }}
                >
                    📱 SMS Pago Móvil Recibidos
                    {pendingSmsCount > 0 && (
                        <span style={{
                            background: '#ef4444',
                            color: '#fff',
                            borderRadius: 999,
                            padding: '2px 7px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                        }}>
                            {pendingSmsCount}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'sms' ? (
                <div>
                    {/* Caja informativa de configuración del Gateway */}
                    <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 12,
                        padding: '1rem 1.25rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.85rem',
                        color: '#166534',
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                            ⚡ Endpoint Webhook para SMS Gateway en tu teléfono:
                        </div>
                        <div style={{
                            background: '#fff',
                            padding: '0.4rem 0.75rem',
                            borderRadius: 6,
                            border: '1px solid #86efac',
                            fontFamily: 'monospace',
                            color: '#15803d',
                            userSelect: 'all',
                            wordBreak: 'break-all',
                            marginTop: '0.25rem',
                            marginBottom: '0.5rem',
                        }}>
                            https://mgmt.allcode.site/api/payments/webhook?secret=f919b8ccd2718b1ea78ff878f82b090e53202e113e9a171c
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d' }}>
                            Copia esta URL en tu app (SMS to URL Forwarder) con método <strong>POST</strong>. Cada vez que entre un Pago Móvil a tu celular, el sistema intentará auto-confirmar el pago del tenant que coincida con la referencia. Si ningún tenant reportó esa referencia aún, quedará acá pendiente para que lo asignes con 1 click.
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
                            Cola de Mensajes Recibidos ({smsList.length})
                        </h4>
                        <button
                            onClick={loadSms}
                            disabled={smsLoading}
                            style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#475569',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {smsLoading ? 'Actualizando...' : '↻ Refrescar'}
                        </button>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="pay-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Banco</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Monto (Bs)</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Referencia</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Teléfono</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Estado</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {smsList.map((s) => {
                                        const st = STATUS_STYLES[s.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <tr key={s.id} className="pay-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td data-label="Fecha" style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                                                    {new Date(s.createdAt).toLocaleString('es-AR')}
                                                </td>
                                                <td data-label="Banco" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                                                    {s.senderBank || 'Desconocido'}
                                                </td>
                                                <td data-label="Monto" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#059669' }}>
                                                    {s.amountVes != null ? `Bs. ${s.amountVes.toFixed(2)}` : '---'}
                                                </td>
                                                <td data-label="Referencia" style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {s.reference ? s.reference : (
                                                        <span style={{ fontSize: '0.75rem', color: '#d97706', fontStyle: 'italic' }} title={s.rawPayload}>
                                                            {s.rawPayload ? (s.rawPayload.length > 35 ? s.rawPayload.slice(0, 35) + '…' : s.rawPayload) : 'Sin referencia'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td data-label="Teléfono" style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                                                    {s.senderPhone || '---'}
                                                </td>
                                                <td data-label="Estado" style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '3px 10px',
                                                        borderRadius: 999,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        background: st.bg,
                                                        color: st.text,
                                                    }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
                                                        {s.status === 'MATCHED' ? 'Conciliado' : s.status === 'DISMISSED' ? 'Descartado' : 'Pendiente'}
                                                    </span>
                                                </td>
                                                <td data-label="Acciones" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                    {s.status === 'PENDING' ? (
                                                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                            <button
                                                                onClick={() => setAssignModal({ open: true, sms: s, tenantId: '' })}
                                                                style={{
                                                                    padding: '0.3rem 0.65rem',
                                                                    borderRadius: 6,
                                                                    border: '1px solid #059669',
                                                                    background: '#ecfdf5',
                                                                    color: '#065f46',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.75rem',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                Asignar a Tenant
                                                            </button>
                                                            <button
                                                                onClick={() => handleDismissSms(s.id)}
                                                                style={{
                                                                    padding: '0.3rem 0.5rem',
                                                                    borderRadius: 6,
                                                                    border: '1px solid #cbd5e1',
                                                                    background: '#fff',
                                                                    color: '#64748b',
                                                                    fontSize: '0.75rem',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                Descartar
                                                            </button>
                                                        </div>
                                                    ) : s.matchedTenantId ? (
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                            Vinculado a tenant
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {smsList.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                No hay SMS de pagos registrados todavía.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Filtros por estado */}
                    <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { value: '', label: 'Todos' },
                            { value: 'PENDING', label: 'Pendientes' },
                            { value: 'PAID', label: 'Pagados' },
                            { value: 'OVERDUE', label: 'Vencidos' },
                            { value: 'REFUNDED', label: 'Reembolsados' },
                            { value: 'CANCELLED', label: 'Cancelados' },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setStatusFilter(value)}
                                style={{
                                    padding: '0.4rem 0.9rem',
                                    borderRadius: 999,
                                    border: statusFilter === value ? '1px solid #059669' : '1px solid #e2e8f0',
                                    background: statusFilter === value ? '#059669' : '#fff',
                                    color: statusFilter === value ? '#fff' : '#64748b',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    minHeight: 44,
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Filtros por metodo de pago */}
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {PROVIDER_FILTERS.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setProviderFilter(value)}
                                style={{
                                    padding: '0.3rem 0.8rem',
                                    borderRadius: 999,
                                    border: providerFilter === value ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                    background: providerFilter === value ? '#eff6ff' : '#fff',
                                    color: providerFilter === value ? '#1e40af' : '#64748b',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    minHeight: 40,
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tabla de pagos */}
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="pay-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Tenant</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Monto</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Moneda</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Estado</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Proveedor</th>
                                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Referencia / Notas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((p) => {
                                        const st = STATUS_STYLES[p.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <tr key={p.id} className="pay-row" style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                background: '#fff',
                                                transition: 'background 0.1s ease',
                                            }}>
                                                <td data-label="Fecha" style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                                                    {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                                </td>
                                                <td data-label="Tenant" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{p.tenant?.slug || p.tenantId}</td>
                                                <td data-label="Monto" style={{ padding: '0.75rem 1rem', color: '#1e293b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                    {p.currency === 'VES' ? `Bs. ${(p.amountCents / 100).toFixed(2)}` : `$${(p.amountCents / 100).toFixed(2)}`}
                                                </td>
                                                <td data-label="Moneda" style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>{p.currency}</td>
                                                <td data-label="Estado" style={{ padding: '0.75rem 1rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '3px 10px',
                                                        borderRadius: 999,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        background: st.bg,
                                                        color: st.text,
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td data-label="Proveedor" style={{ padding: '0.75rem 1rem', color: '#475569' }}>{PROVIDER_LABELS[p.provider || ''] || p.provider || '---'}</td>
                                                <td data-label="Referencia / Notas" style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 280 }}>
                                                    {p.externalId && (
                                                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                                                            Ref: {p.externalId}
                                                        </div>
                                                    )}
                                                    {p.notes ? (
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.notes}>
                                                            {p.notes}
                                                        </div>
                                                    ) : (!p.externalId ? '---' : null)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {payments.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                No se encontraron pagos
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {payments.length > PAGE_SIZE && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={safePage <= 1}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: safePage <= 1 ? '#f8fafc' : '#fff',
                                        color: safePage <= 1 ? '#94a3b8' : '#475569',
                                        cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                    }}
                                >
                                    Anterior
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        style={{
                                            padding: '0.4rem 0.65rem',
                                            borderRadius: 8,
                                            border: p === safePage ? '1px solid #059669' : '1px solid #e2e8f0',
                                            background: p === safePage ? '#059669' : '#fff',
                                            color: p === safePage ? '#fff' : '#475569',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: p === safePage ? 600 : 400,
                                            minWidth: 36,
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={safePage >= totalPages}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: safePage >= totalPages ? '#f8fafc' : '#fff',
                                        color: safePage >= totalPages ? '#94a3b8' : '#475569',
                                        cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                    }}
                                >
                                    Siguiente
                                </button>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                                    {payments.length} pago(s)
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}