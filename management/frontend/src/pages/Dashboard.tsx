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

interface VpsStats {
    cpu: { cores: number; usagePercent: number };
    memory: { totalMb: number; usedMb: number; freeMb: number; usagePercent: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; usagePercent: number };
    docker: { containers: number; running: number; stopped: number };
    uptime: string;
}

/** Barra de progreso con porcentaje */
function ProgressBar({ percent, color }: { percent: number; color: string }) {
    return (
        <div style={{
            width: '100%',
            height: 8,
            background: '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden',
        }}>
            <div style={{
                width: `${Math.min(percent, 100)}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                transition: 'width 0.3s ease',
            }} />
        </div>
    );
}

/** Skeleton loader para las cards */
function SkeletonCard() {
    return (
        <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #e5e7eb',
        }}>
            <div style={{
                width: '60%',
                height: 12,
                background: '#e5e7eb',
                borderRadius: 4,
                marginBottom: 12,
            }} />
            <div style={{
                width: '40%',
                height: 28,
                background: '#e5e7eb',
                borderRadius: 4,
                marginBottom: 8,
            }} />
            <div style={{
                width: '50%',
                height: 12,
                background: '#f3f4f6',
                borderRadius: 4,
            }} />
        </div>
    );
}

export default function Dashboard() {
    const [health, setHealth] = useState<TenantHealth[]>([]);
    const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
    const [tenantsSummary, setTenantsSummary] = useState<TenantsSummary | null>(null);
    const [vpsStats, setVpsStats] = useState<VpsStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('mgmt_token');
        const headers = { Authorization: `Bearer ${token}` };

        Promise.all([
            fetch('/api/health/tenants', { headers }).then((r) => r.json()),
            fetch('/api/payments/stats', { headers }).then((r) => r.json()),
            fetch('/api/tenants', { headers }).then((r) => r.json()),
            fetch('/api/vps/stats', { headers }).then((r) => r.json()),
        ])
            .then(([healthData, statsData, tenantsData, vpsData]) => {
                setHealth(healthData);
                setPaymentStats(statsData);

                const tenants = Array.isArray(tenantsData) ? tenantsData : [];
                setTenantsSummary({
                    total: tenants.length,
                    active: tenants.filter((t: { status: string }) => t.status === 'ACTIVE').length,
                    suspended: tenants.filter((t: { status: string }) => t.status === 'SUSPENDED').length,
                });

                setVpsStats(vpsData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonCard key={`vps-${i}`} />
                    ))}
                </div>
            </div>
        );
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
                    subtitle={`${tenantsSummary?.active || 0} activos · ${tenantsSummary?.suspended || 0} suspendidos`}
                    color="#1a1a2e"
                />
                <StatsCard
                    title="Ingresos Totales"
                    value={`$${((paymentStats?.totalRevenueCents || 0) / 100).toFixed(2)}`}
                    subtitle={`${paymentStats?.paidCount || 0} pagos`}
                    color="#059669"
                />
                <StatsCard
                    title="Pagos Vencidos"
                    value={paymentStats?.overdueCount || 0}
                    color="#dc2626"
                />
                <StatsCard
                    title="Salud del Sistema"
                    value={`${healthyCount}/${health.length}`}
                    subtitle="tenants saludables"
                    color={healthyCount === health.length ? '#059669' : '#d97706'}
                />
            </div>

            {/* VPS Stats */}
            {vpsStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {/* CPU */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>CPU</h3>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.cpu.usagePercent > 80 ? '#dc2626' : '#059669' }}>
                                {vpsStats.cpu.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.cpu.usagePercent}
                            color={vpsStats.cpu.usagePercent > 80 ? '#dc2626' : vpsStats.cpu.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#888' }}>
                            {vpsStats.cpu.cores} cores
                        </p>
                    </div>

                    {/* Memory */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Memoria</h3>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.memory.usagePercent > 80 ? '#dc2626' : '#059669' }}>
                                {vpsStats.memory.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.memory.usagePercent}
                            color={vpsStats.memory.usagePercent > 80 ? '#dc2626' : vpsStats.memory.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#888' }}>
                            {vpsStats.memory.usedMb} / {vpsStats.memory.totalMb} MB
                        </p>
                    </div>

                    {/* Disk */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Disco</h3>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.disk.usagePercent > 80 ? '#dc2626' : '#059669' }}>
                                {vpsStats.disk.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.disk.usagePercent}
                            color={vpsStats.disk.usagePercent > 80 ? '#dc2626' : vpsStats.disk.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#888' }}>
                            {vpsStats.disk.usedGb} / {vpsStats.disk.totalGb} GB
                        </p>
                    </div>

                    {/* Docker + Uptime */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Docker</h3>
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{vpsStats.docker.running}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>Running</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.docker.stopped > 0 ? '#d97706' : '#888' }}>{vpsStats.docker.stopped}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>Stopped</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>{vpsStats.docker.containers}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>Total</div>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>
                            Uptime: {vpsStats.uptime}
                        </p>
                    </div>
                </div>
            )}

            {/* Tabla de salud */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
                    Estado de Salud Reciente
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
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
                            {health.map((h, idx) => (
                                <tr
                                    key={h.tenantId}
                                    style={{
                                        borderBottom: '1px solid #f3f4f6',
                                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                                    }}
                                >
                                    <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{h.slug}</td>
                                    <td>{h.domain}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 10px',
                                            borderRadius: 12,
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: h.status === 'ACTIVE' ? '#ecfdf5' : h.status === 'SUSPENDED' ? '#fffbeb' : '#fef2f2',
                                            color: h.status === 'ACTIVE' ? '#065f46' : h.status === 'SUSPENDED' ? '#92400e' : '#991b1b',
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
        </div>
    );
}
