import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge';

interface TenantDetail {
    id: string;
    slug: string;
    domain: string;
    url: string;
    status: string;
    plan: string;
    adminEmail: string | null;
    createdAt: string;
    payments: { id: string; amountCents: number; status: string; createdAt: string }[];
    healthChecks: { id: string; apiHealthy: boolean; dbHealthy: boolean; containerUp: boolean; memoryMb: number | null; checkedAt: string }[];
}

export default function TenantDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const token = localStorage.getItem('mgmt_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        fetch(`/api/tenants/${slug}`, { headers })
            .then((r) => r.json())
            .then(setTenant)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [slug]);

    async function handleAction(action: 'suspend' | 'resume') {
        setActionLoading(true);
        try {
            await fetch(`/api/tenants/${slug}/${action}`, { method: 'POST', headers });
            // Recargar datos
            const res = await fetch(`/api/tenants/${slug}`, { headers });
            setTenant(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) return <p style={{ color: '#888' }}>Cargando tenant...</p>;
    if (!tenant) return <p style={{ color: '#888' }}>Tenant no encontrado</p>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{tenant.slug}</h2>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>{tenant.domain}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {tenant.status === 'ACTIVE' ? (
                        <button
                            onClick={() => handleAction('suspend')}
                            disabled={actionLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#fff3e0',
                                color: '#e65100',
                                border: '1px solid #ffcc80',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                            }}
                        >
                            {actionLoading ? 'Procesando...' : 'Suspender'}
                        </button>
                    ) : tenant.status === 'SUSPENDED' ? (
                        <button
                            onClick={() => handleAction('resume')}
                            disabled={actionLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#e8f5e9',
                                color: '#2e7d32',
                                border: '1px solid #a5d6a7',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                            }}
                        >
                            {actionLoading ? 'Procesando...' : 'Reactivar'}
                        </button>
                    ) : null}
                    <button
                        onClick={() => navigate('/tenants')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        Volver
                    </button>
                </div>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Información General</h3>
                    <dl style={{ margin: 0, fontSize: '0.9rem' }}>
                        <dt style={{ color: '#888', marginBottom: 2 }}>Estado</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                background: tenant.status === 'ACTIVE' ? '#e8f5e9' : '#fff3e0',
                                color: tenant.status === 'ACTIVE' ? '#2e7d32' : '#e65100',
                            }}>
                                {tenant.status}
                            </span>
                        </dd>
                        <dt style={{ color: '#888', marginBottom: 2 }}>Plan</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>{tenant.plan}</dd>
                        <dt style={{ color: '#888', marginBottom: 2 }}>URL</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>
                            <a href={tenant.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8' }}>
                                {tenant.url}
                            </a>
                        </dd>
                        <dt style={{ color: '#888', marginBottom: 2 }}>Admin Email</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>{tenant.adminEmail || '—'}</dd>
                        <dt style={{ color: '#888', marginBottom: 2 }}>Creado</dt>
                        <dd style={{ margin: 0 }}>{new Date(tenant.createdAt).toLocaleString('es-AR')}</dd>
                    </dl>
                </div>

                {/* Health history */}
                <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Historial de Salud</h3>
                    {tenant.healthChecks.length === 0 ? (
                        <p style={{ color: '#888', fontSize: '0.85rem' }}>Sin registros de salud</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0' }}>Fecha</th>
                                    <th>API</th>
                                    <th>DB</th>
                                    <th>Cont.</th>
                                    <th>RAM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenant.healthChecks.map((hc) => (
                                    <tr key={hc.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '0.5rem 0' }}>
                                            {new Date(hc.checkedAt).toLocaleString('es-AR')}
                                        </td>
                                        <td><HealthBadge healthy={hc.apiHealthy} size="sm" /></td>
                                        <td><HealthBadge healthy={hc.dbHealthy} size="sm" /></td>
                                        <td><HealthBadge healthy={hc.containerUp} size="sm" /></td>
                                        <td>{hc.memoryMb ? `${hc.memoryMb} MB` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Payments */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Pagos Recientes</h3>
                {tenant.payments.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>Sin pagos registrados</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0' }}>Fecha</th>
                                <th>Monto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenant.payments.map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                    </td>
                                    <td>${(p.amountCents / 100).toFixed(2)}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.75rem',
                                            background: p.status === 'PAID' ? '#e8f5e9' : p.status === 'PENDING' ? '#fff3e0' : '#fce4ec',
                                            color: p.status === 'PAID' ? '#2e7d32' : p.status === 'PENDING' ? '#e65100' : '#c62828',
                                        }}>
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
