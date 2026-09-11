import { useState, useEffect } from 'react';

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
    notes: string | null;
    createdAt: string;
    tenant: { slug: string; domain: string };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PENDING: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    OVERDUE: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    FAILED: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    REFUNDED: { bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6' },
    CANCELLED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
};

const PROVIDER_LABELS: Record<string, string> = {
    zelle: 'Zelle',
    pago_movil: 'Pago Movil',
    binance: 'Binance',
    cash: 'Efectivo',
    other: 'Otro',
};

const PROVIDER_FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'pago_movil', label: 'Pago Movil' },
    { value: 'binance', label: 'Binance' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'other', label: 'Otro' },
];

export default function Payments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [providerFilter, setProviderFilter] = useState<string>('');

    const token = localStorage.getItem('mgmt_token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (providerFilter) params.set('provider', providerFilter);
        const qs = params.toString();

        fetch(`/api/payments${qs ? `?${qs}` : ''}`, { headers })
            .then((r) => r.json())
            .then((data) => setPayments(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [statusFilter, providerFilter]);

    if (loading) return <p style={{ color: '#64748b' }}>Cargando pagos...</p>;

    return (
        <div>
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

            {/* Tabla */}
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
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p) => {
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
                                        <td data-label="Monto" style={{ padding: '0.75rem 1rem', color: '#1e293b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${(p.amountCents / 100).toFixed(2)}</td>
                                        <td data-label="Moneda" style={{ padding: '0.75rem 1rem', color: '#475569' }}>{p.currency}</td>
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
                                        <td data-label="Notas" style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.notes || '---'}
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
            </div>
        </div>
    );
}