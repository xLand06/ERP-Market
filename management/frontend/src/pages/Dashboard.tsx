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

function ProgressBar({ percent, color }: { percent: number; color: string }) {
    return (
        <div style={{
            width: '100%',
            height: 8,
            background: '#e2e8f0',
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

function SkeletonCard() {
    return (
        <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderLeft: '4px solid #e2e8f0',
        }}>
            <div style={{ width: '60%', height: 12, background: '#e2e8f0', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ width: '40%', height: 28, background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ width: '50%', height: 12, background: '#f1f5f9', borderRadius: 4 }} />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
            {/* Tarjetas de estadisticas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <StatsCard
                    title="Total Tenants"
                    value={tenantsSummary?.total || 0}
                    subtitle={`${tenantsSummary?.active || 0} activos / ${tenantsSummary?.suspended || 0} suspendidos`}
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

            {/* Estadisticas VPS */}
            {vpsStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* CPU */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>CPU</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: vpsStats.cpu.usagePercent > 80 ? '#dc2626' : vpsStats.cpu.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.cpu.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.cpu.usagePercent}
                            color={vpsStats.cpu.usagePercent > 80 ? '#dc2626' : vpsStats.cpu.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            {vpsStats.cpu.cores} cores
                        </p>
                    </div>

                    {/* Memoria */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Memoria</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: vpsStats.memory.usagePercent > 80 ? '#dc2626' : vpsStats.memory.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.memory.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.memory.usagePercent}
                            color={vpsStats.memory.usagePercent > 80 ? '#dc2626' : vpsStats.memory.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            {vpsStats.memory.usedMb} / {vpsStats.memory.totalMb} MB
                        </p>
                    </div>

                    {/* Disco */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Disco</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: vpsStats.disk.usagePercent > 80 ? '#dc2626' : vpsStats.disk.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.disk.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.disk.usagePercent}
                            color={vpsStats.disk.usagePercent > 80 ? '#dc2626' : vpsStats.disk.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            {vpsStats.disk.usedGb} / {vpsStats.disk.totalGb} GB
                        </p>
                    </div>

                    {/* Docker + Uptime */}
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Docker</h3>
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{vpsStats.docker.running}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Running</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.docker.stopped > 0 ? '#d97706' : '#94a3b8' }}>{vpsStats.docker.stopped}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Stopped</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{vpsStats.docker.containers}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total</div>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            Uptime: {vpsStats.uptime}
                        </p>
                    </div>
                </div>
            )}

            {/* Tabla de salud */}
            <div style={{
                background: '#fff',
                borderRadius: 8,
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                    Estado de Salud Reciente
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Tenant</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Dominio</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Estado</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>API</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>DB</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Contenedor</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Ultimo Check</th>
                            </tr>
                        </thead>
                        <tbody>
                            {health.map((h, idx) => (
                                <tr
                                    key={h.tenantId}
                                    style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                                    }}
                                >
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{h.slug}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{h.domain}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
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
                                    <td style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.apiHealthy ?? null} size="sm" /></td>
                                    <td style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.dbHealthy ?? null} size="sm" /></td>
                                    <td style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.containerUp ?? null} size="sm" /></td>
                                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                                        {h.lastCheck?.checkedAt
                                            ? new Date(h.lastCheck.checkedAt).toLocaleString('es-AR')
                                            : 'Sin datos'}
                                    </td>
                                </tr>
                            ))}
                            {health.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
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
