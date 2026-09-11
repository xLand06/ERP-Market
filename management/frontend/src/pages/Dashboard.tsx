import { useState, useEffect } from 'react';
import StatsCard from '../components/StatsCard';
import HealthBadge from '../components/HealthBadge';

/* ── Estilos inyectados ─────────────────────────────────────────────────── */

const dashboardStyles = `
@keyframes dashPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
.dash-row:hover {
    background: #f8fafc !important;
}
@media (max-width: 768px) {
    .dash-table thead { display: none; }
    .dash-table tbody { display: flex; flex-direction: column; gap: 0.75rem; }
    .dash-table tr {
        display: block;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 0.5rem 1rem;
        background: #fff !important;
    }
    .dash-table td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.4rem 0 !important;
        border-bottom: 1px dashed #f1f5f9;
    }
    .dash-table td:last-child { border-bottom: none; }
    .dash-table td::before {
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

if (typeof document !== 'undefined' && !document.getElementById('dashboard-page-styles')) {
    const style = document.createElement('style');
    style.id = 'dashboard-page-styles';
    style.textContent = dashboardStyles;
    document.head.appendChild(style);
}

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

const STATUS_PALETTE: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PROVISIONING: { bg: '#eff6ff', text: '#1e40af', dot: '#2563eb' },
    ERROR: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    SUSPENDED: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    DELETED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
};

function ProgressBar({ percent, color }: { percent: number; color: string }) {
    return (
        <div style={{
            width: '100%',
            height: 8,
            background: '#e2e8f0',
            borderRadius: 999,
            overflow: 'hidden',
        }}>
            <div style={{
                width: `${Math.min(percent, 100)}%`,
                height: '100%',
                background: color,
                borderRadius: 999,
                transition: 'width 0.3s ease',
            }} />
        </div>
    );
}

function SkeletonCard() {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
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
            {/* ── Hero de marca ALLCODE ─────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #065f46 100%)',
                borderRadius: 12,
                padding: '1.5rem 2rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 8px 24px rgba(26,26,46,0.25)',
            }}>
                <div>
                    <div style={{
                        fontSize: '0.68rem',
                        letterSpacing: '0.14em',
                        color: '#a7f3d0',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        marginBottom: '0.35rem',
                    }}>
                        ALLCODE · ALL MARKET
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                        Panel de Gestion
                    </h2>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                        Estado de la infraestructura y los tenants en tiempo real
                    </p>
                </div>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: 'rgba(5,150,105,0.2)',
                    border: '1px solid rgba(5,150,105,0.4)',
                    color: '#a7f3d0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#34d399',
                        animation: 'dashPulse 2s ease-in-out infinite',
                        flexShrink: 0,
                    }} />
                    En vivo
                </span>
            </div>

            {/* Tarjetas de estadisticas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* CPU */}
                    <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>CPU</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: vpsStats.cpu.usagePercent > 80 ? '#dc2626' : vpsStats.cpu.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.cpu.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.cpu.usagePercent}
                            color={vpsStats.cpu.usagePercent > 80 ? '#dc2626' : vpsStats.cpu.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                            {vpsStats.cpu.cores} cores
                        </p>
                    </div>

                    {/* Memoria */}
                    <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Memoria</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: vpsStats.memory.usagePercent > 80 ? '#dc2626' : vpsStats.memory.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.memory.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.memory.usagePercent}
                            color={vpsStats.memory.usagePercent > 80 ? '#dc2626' : vpsStats.memory.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {vpsStats.memory.usedMb} / {vpsStats.memory.totalMb} MB
                        </p>
                    </div>

                    {/* Disco */}
                    <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Disco</h3>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: vpsStats.disk.usagePercent > 80 ? '#dc2626' : vpsStats.disk.usagePercent > 60 ? '#d97706' : '#059669',
                            }}>
                                {vpsStats.disk.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.disk.usagePercent}
                            color={vpsStats.disk.usagePercent > 80 ? '#dc2626' : vpsStats.disk.usagePercent > 60 ? '#d97706' : '#059669'}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {vpsStats.disk.usedGb} / {vpsStats.disk.totalGb} GB
                        </p>
                    </div>

                    {/* Docker + Uptime */}
                    <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Docker</h3>
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{vpsStats.docker.running}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Running</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: vpsStats.docker.stopped > 0 ? '#d97706' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{vpsStats.docker.stopped}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Stopped</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{vpsStats.docker.containers}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Total</div>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                            Uptime: {vpsStats.uptime}
                        </p>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                            Incluye infraestructura (mgmt-api, mgmt-db, caddy)
                        </p>
                    </div>
                </div>
            )}

            {/* Tabla de salud */}
            <div style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                    Estado de Salud Reciente
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="dash-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Tenant</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Dominio</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Estado</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>API</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>DB</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Contenedor</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>Ultimo Check</th>
                            </tr>
                        </thead>
                        <tbody>
                            {health.map((h) => {
                                const st = STATUS_PALETTE[h.status] || STATUS_PALETTE.ACTIVE;
                                return (
                                    <tr
                                        key={h.tenantId}
                                        className="dash-row"
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            background: '#fff',
                                            transition: 'background 0.1s ease',
                                        }}
                                    >
                                        <td data-label="Tenant" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{h.slug}</td>
                                        <td data-label="Dominio" style={{ padding: '0.75rem 1rem', color: '#475569' }}>{h.domain}</td>
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
                                                {h.status}
                                            </span>
                                        </td>
                                        <td data-label="API" style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.apiHealthy ?? null} size="sm" /></td>
                                        <td data-label="DB" style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.dbHealthy ?? null} size="sm" /></td>
                                        <td data-label="Contenedor" style={{ padding: '0.75rem 1rem' }}><HealthBadge healthy={h.lastCheck?.containerUp ?? null} size="sm" /></td>
                                        <td data-label="Ultimo Check" style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                                            {h.lastCheck?.checkedAt
                                                ? new Date(h.lastCheck.checkedAt).toLocaleString('es-AR')
                                                : 'Sin datos'}
                                        </td>
                                    </tr>
                                );
                            })}
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