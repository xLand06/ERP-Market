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

    if (loading) return <p style={{ color: '#888' }}>Cargando pagos...</p>;

    return (
        <div>
            {/* Filtros */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                {['', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: 4,
                            border: statusFilter === s ? '1px solid #1a1a2e' : '1px solid #ddd',
                            background: statusFilter === s ? '#1a1a2e' : '#fff',
                            color: statusFilter === s ? '#fff' : '#555',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                        }}
                    >
                        {s || 'Todos'}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 0' }}>Fecha</th>
                            <th>Tenant</th>
                            <th>Monto</th>
                            <th>Moneda</th>
                            <th>Estado</th>
                            <th>Proveedor</th>
                            <th>Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '0.75rem 0', fontSize: '0.8rem' }}>
                                    {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                </td>
                                <td style={{ fontWeight: 600 }}>{p.tenant?.slug || p.tenantId}</td>
                                <td>${(p.amountCents / 100).toFixed(2)}</td>
                                <td>{p.currency}</td>
                                <td>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        background: p.status === 'PAID' ? '#e8f5e9' : p.status === 'PENDING' ? '#fff3e0' : p.status === 'OVERDUE' ? '#fce4ec' : '#f3e5f5',
                                        color: p.status === 'PAID' ? '#2e7d32' : p.status === 'PENDING' ? '#e65100' : p.status === 'OVERDUE' ? '#c62828' : '#6a1b9a',
                                    }}>
                                        {p.status}
                                    </span>
                                </td>
                                <td>{p.provider || '—'}</td>
                                <td style={{ color: '#888', fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.notes || '—'}
                                </td>
                            </tr>
                        ))}
                        {payments.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                    No se encontraron pagos
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
