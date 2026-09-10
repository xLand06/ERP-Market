import { useState, useEffect } from 'react';

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

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    PAID: { bg: '#ecfdf5', text: '#065f46' },
    PENDING: { bg: '#fffbeb', text: '#92400e' },
    OVERDUE: { bg: '#fef2f2', text: '#991b1b' },
    REFUNDED: { bg: '#f5f3ff', text: '#6d28d9' },
};

export default function Payments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');

    const token = localStorage.getItem('mgmt_token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const params = statusFilter ? `?status=${statusFilter}` : '';
        fetch(`/api/payments${params}`, { headers })
            .then((r) => r.json())
            .then((data) => setPayments(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [statusFilter]);

    if (loading) return <p style={{ color: '#64748b' }}>Cargando pagos...</p>;

    return (
        <div>
            {/* Filtros */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                    { value: '', label: 'Todos' },
                    { value: 'PENDING', label: 'Pendientes' },
                    { value: 'PAID', label: 'Pagados' },
                    { value: 'OVERDUE', label: 'Vencidos' },
                    { value: 'REFUNDED', label: 'Reembolsados' },
                ].map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setStatusFilter(value)}
                        style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: 6,
                            border: statusFilter === value ? '1px solid #1a1a2e' : '1px solid #e2e8f0',
                            background: statusFilter === value ? '#1a1a2e' : '#fff',
                            color: statusFilter === value ? '#fff' : '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            minHeight: 44,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Fecha</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Tenant</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Monto</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Moneda</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Estado</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Proveedor</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, idx) => {
                                const st = STATUS_STYLES[p.status] || STATUS_STYLES.PENDING;
                                return (
                                    <tr key={p.id} style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                                    }}>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                                            {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{p.tenant?.slug || p.tenantId}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#1e293b' }}>${(p.amountCents / 100).toFixed(2)}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{p.currency}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{
                                                padding: '2px 10px',
                                                borderRadius: 12,
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: st.bg,
                                                color: st.text,
                                            }}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{p.provider || '---'}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
