import { useState, useEffect } from 'react';
import StatsCard from '../components/StatsCard';
import HealthBadge from '../components/HealthBadge';

interface TenantHealth {
    tenantId: string;
    slug: string;
    domain: string;
    status: string;
    lastCheck: {
        apiHealthy: boolean;
        dbHealthy: boolean;
        containerUp: boolean;
        checkedAt: string;
    } | null;
}

interface PaymentStats {
    totalRevenueCents: number;
    totalCount: number;
    paidCount: number;
    overdueCount: number;
}

interface TenantsSummary {
    total: number;
    active: number;
    suspended: number;
}

export default function Dashboard() {
    const [health, setHealth] = useState<TenantHealth[]>([]);
    const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
    const [tenantsSummary, setTenantsSummary] = useState<TenantsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('mgmt_token');
        const headers = { Authorization: `Bearer ${token}` };

        Promise.all([
            fetch('/api/health/tenants', { headers }).then((r) => r.json()),
            fetch('/api/payments/stats', { headers }).then((r) => r.json()),
            fetch('/api/tenants', { headers }).then((r) => r.json()),
        ])
            .then(([healthData, statsData, tenantsData]) => {
                setHealth(healthData);
                setPaymentStats(statsData);

                const tenants = Array.isArray(tenantsData) ? tenantsData : [];
                setTenantsSummary({
                    total: tenants.length,
                    active: tenants.filter((t: { status: string }) => t.status === 'ACTIVE').length,
                    suspended: tenants.filter((t: { status: string }) => t.status === 'SUSPENDED').length,
                });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <p style={{ color: '#888' }}>Cargando dashboard...</p>;
    }

    const healthyCount = health.filter(
        (h) => h.lastCheck?.apiHealthy && h.lastCheck?.dbHealthy && h.lastCheck?.containerUp
    ).length;

    return (
        <div>
            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatsCard
                    title="Total Tenants"
                    value={tenantsSummary?.total || 0}
                    subtitle={`${tenantsSummary?.active || 0} activos`}
                    color="#1a1a2e"
                />
                <StatsCard
                    title="Ingresos Totales"
                    value={`$${((paymentStats?.totalRevenueCents || 0) / 100).toFixed(2)}`}
                    subtitle={`${paymentStats?.paidCount || 0} pagos`}
                    color="#4caf50"
                />
                <StatsCard
                    title="Pagos Vencidos"
                    value={paymentStats?.overdueCount || 0}
                    color="#f44336"
                />
                <StatsCard
                    title="Salud del Sistema"
                    value={`${healthyCount}/${health.length}`}
                    subtitle="tenants saludables"
                    color={healthyCount === health.length ? '#4caf50' : '#ff9800'}
                />
            </div>

            {/* Tabla de salud */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Estado de Salud Reciente
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 0' }}>Tenant</th>
                            <th>Dominio</th>
                            <th>Estado</th>
                            <th>API</th>
                            <th>DB</th>
                            <th>Contenedor</th>
                            <th>Último Check</th>
                        </tr>
                    </thead>
                    <tbody>
                        {health.map((h) => (
                            <tr key={h.tenantId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{h.slug}</td>
                                <td>{h.domain}</td>
                                <td>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        background: h.status === 'ACTIVE' ? '#e8f5e9' : '#fff3e0',
                                        color: h.status === 'ACTIVE' ? '#2e7d32' : '#e65100',
                                    }}>
                                        {h.status}
                                    </span>
                                </td>
                                <td><HealthBadge healthy={h.lastCheck?.apiHealthy ?? null} size="sm" /></td>
                                <td><HealthBadge healthy={h.lastCheck?.dbHealthy ?? null} size="sm" /></td>
                                <td><HealthBadge healthy={h.lastCheck?.containerUp ?? null} size="sm" /></td>
                                <td style={{ color: '#888', fontSize: '0.8rem' }}>
                                    {h.lastCheck?.checkedAt
                                        ? new Date(h.lastCheck.checkedAt).toLocaleString('es-AR')
                                        : 'Nunca'}
                                </td>
                            </tr>
                        ))}
                        {health.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                    No hay tenants activos
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
