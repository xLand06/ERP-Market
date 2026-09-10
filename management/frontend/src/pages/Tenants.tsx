import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge';
import Terminal, { TerminalLine } from '../components/Terminal';

/* ── Estilos globales inyectados una sola vez ─────────────────────────────── */

const globalStyles = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes slideIn {
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes progressPulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
}

.tenant-toast {
    animation: slideIn 0.3s ease;
}
.tenant-row:hover {
    background: #f8fafc !important;
}
.tenant-action-btn {
    transition: all 0.15s ease;
}
.tenant-action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.tenant-skeleton-pulse {
    animation: progressPulse 1.5s ease-in-out infinite;
}

/* Responsive: cards en mobile */
@media (max-width: 768px) {
    .tenant-desktop-table { display: none !important; }
    .tenant-mobile-cards { display: flex !important; }
    .tenant-toolbar { flex-direction: column !important; align-items: stretch !important; }
    .tenant-toolbar-filters { flex-wrap: wrap !important; }
    .tenant-vps-grid { grid-template-columns: 1fr !important; }
    .tenant-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
}
@media (min-width: 769px) {
    .tenant-mobile-cards { display: none !important; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('tenant-page-styles')) {
    const style = document.createElement('style');
    style.id = 'tenant-page-styles';
    style.textContent = globalStyles;
    document.head.appendChild(style);
}

/* ── Tipos ────────────────────────────────────────────────────────────────── */

interface Tenant {
    id: string;
    slug: string;
    domain: string;
    url: string;
    status: string;
    plan: string;
    adminEmail: string | null;
    createdAt: string;
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

interface CreateTenantResponse {
    slug: string;
    domain: string;
    adminEmail: string | null;
    adminPasswordPlain: string;
    dbPassword: string;
}

interface VpsStats {
    cpu: { cores: number; usagePercent: number };
    memory: { totalMb: number; usedMb: number; freeMb: number; usagePercent: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; usagePercent: number };
    docker: { containers: number; running: number; stopped: number };
    uptime: string;
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

/* ── Constantes de color ──────────────────────────────────────────────────── */

const COLORS = {
    primary: '#059669',
    primaryHover: '#047857',
    danger: '#dc2626',
    dangerHover: '#b91c1c',
    warning: '#d97706',
    info: '#2563eb',
    dark: '#1a1a2e',
    darkHover: '#16213e',
    muted: '#64748b',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    bg: '#f8fafc',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    SUSPENDED: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    DELETED: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    PROVISIONING: { bg: '#eff6ff', text: '#1e40af', dot: '#2563eb' },
};

const HEALTH_STATUS = {
    running: { label: 'Running', color: '#059669', bg: '#ecfdf5' },
    stopped: { label: 'Detenido', color: '#dc2626', bg: '#fef2f2' },
    unknown: { label: 'Desconocido', color: '#64748b', bg: '#f1f5f9' },
    partial: { label: 'Parcial', color: '#d97706', bg: '#fffbeb' },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

let toastCounter = 0;

function getHealthStatus(lastCheck: TenantHealth['lastCheck']): keyof typeof HEALTH_STATUS {
    if (!lastCheck) return 'unknown';
    if (lastCheck.containerUp && lastCheck.apiHealthy && lastCheck.dbHealthy) return 'running';
    if (lastCheck.containerUp) return 'partial';
    return 'stopped';
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

function ActionButton({
    onClick,
    color,
    hoverColor,
    disabled,
    title,
    children,
}: {
    onClick: () => void;
    color: string;
    hoverColor: string;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            className="tenant-action-btn"
            onClick={onClick}
            disabled={disabled}
            title={title}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 6,
                border: 'none',
                background: disabled ? '#e2e8f0' : hovered ? hoverColor : color,
                color: disabled ? '#94a3b8' : '#fff',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                minHeight: 44,
                minWidth: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s ease',
            }}
        >
            {children}
        </button>
    );
}

/* ── Componente principal ─────────────────────────────────────────────────── */

export default function Tenants() {
    const navigate = useNavigate();

    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [healthMap, setHealthMap] = useState<Map<string, TenantHealth>>(new Map());
    const [vpsStats, setVpsStats] = useState<VpsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [toasts, setToasts] = useState<Toast[]>([]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [provisioning, setProvisioning] = useState(false);
    const [createdTenant, setCreatedTenant] = useState<CreateTenantResponse | null>(null);
    const [formSlug, setFormSlug] = useState('');
    const [formDomain, setFormDomain] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formUser, setFormUser] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formPlan, setFormPlan] = useState('free');
    const [formError, setFormError] = useState<string | null>(null);
    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [provisionStatus, setProvisionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        variant: 'danger' | 'warning';
        onConfirm: () => Promise<void>;
    } | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        const id = ++toastCounter;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const fetchTenants = useCallback(() => {
        const token = localStorage.getItem('mgmt_token');
        const headers = { Authorization: `Bearer ${token}` };

        return Promise.all([
            fetch('/api/tenants', { headers }).then((r) => r.json()),
            fetch('/api/health/tenants', { headers }).then((r) => r.json()),
            fetch('/api/vps/stats', { headers }).then((r) => r.json()),
        ])
            .then(([tenantsData, healthData, vpsData]) => {
                setTenants(Array.isArray(tenantsData) ? tenantsData : []);

                const map = new Map<string, TenantHealth>();
                if (Array.isArray(healthData)) {
                    for (const h of healthData) {
                        map.set(h.slug, h);
                    }
                }
                setHealthMap(map);
                setVpsStats(vpsData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const resetForm = useCallback(() => {
        setFormSlug('');
        setFormDomain('');
        setFormEmail('');
        setFormUser('');
        setFormPassword('');
        setFormPlan('free');
        setFormError(null);
    }, []);

    const handleCreate = useCallback(async () => {
        setFormError(null);

        if (!formSlug || !/^[a-z0-9-]+$/.test(formSlug)) {
            setFormError('El slug solo puede contener minusculas, numeros y guiones');
            return;
        }
        if (formPassword && formPassword.length < 8) {
            setFormError('La contrasena debe tener al menos 8 caracteres');
            return;
        }

        setCreating(true);
        setProvisioning(true);
        setProvisionStatus('running');
        setTerminalLines([]);

        try {
            const token = localStorage.getItem('mgmt_token');
                const body: Record<string, string> = {
                    slug: formSlug,
                    domain: formDomain,
                };
                if (formEmail) body.adminEmail = formEmail;
                if (formUser) body.adminUser = formUser;
                if (formPassword) body.adminPassword = formPassword;
                if (formPlan) body.plan = formPlan;

            // Usar fetch con POST para SSE (no soporta Authorization header directo con EventSource)
            const res = await fetch('/api/tenants/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                setFormError(data.error || 'Error al crear tenant');
                setProvisionStatus('error');
                setCreating(false);
                setProvisioning(false);
                return;
            }

            // Leer stream de SSE
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (!reader) {
                setFormError('No se pudo leer el stream de respuesta');
                setProvisionStatus('error');
                setCreating(false);
                setProvisioning(false);
                return;
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Procesar eventos SSE completos (separados por doble newline)
                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const event of events) {
                    const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
                    if (!dataLine) continue;

                    try {
                        const payload = JSON.parse(dataLine.slice(6));

                        if (payload.type === 'log') {
                            setTerminalLines((prev) => [
                                ...prev,
                                {
                                    timestamp: new Date(),
                                    message: payload.message,
                                    type: 'info',
                                },
                            ]);
                        } else if (payload.type === 'done') {
                            setProvisionStatus('success');
                            setCreatedTenant(payload.tenant);
                            setTerminalLines((prev) => [
                                ...prev,
                                {
                                    timestamp: new Date(),
                                    message: 'Tenant provisionado exitosamente!',
                                    type: 'success',
                                },
                            ]);
                            resetForm();
                            fetchTenants();
                        } else if (payload.type === 'error') {
                            setProvisionStatus('error');
                            setFormError(payload.error);
                            setTerminalLines((prev) => [
                                ...prev,
                                {
                                    timestamp: new Date(),
                                    message: payload.error,
                                    type: 'error',
                                },
                            ]);
                        }
                    } catch {
                        // Ignorar lineas SSE malformadas
                    }
                }
            }
        } catch {
            setFormError('Error de conexion al crear tenant');
            setProvisionStatus('error');
        } finally {
            setCreating(false);
            setProvisioning(false);
        }
    }, [formSlug, formDomain, formEmail, formPassword, formPlan, resetForm, fetchTenants]);

    const handleSuspend = useCallback(async (slug: string) => {
        const token = localStorage.getItem('mgmt_token');
        const res = await fetch(`/api/tenants/${slug}/suspend`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al suspender');
    }, []);

    const handleResume = useCallback(async (slug: string) => {
        const token = localStorage.getItem('mgmt_token');
        const res = await fetch(`/api/tenants/${slug}/resume`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al reactivar');
    }, []);

    const handleDelete = useCallback(async (slug: string) => {
        const token = localStorage.getItem('mgmt_token');
        const res = await fetch(`/api/tenants/${slug}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al eliminar');
    }, []);

    const executeConfirmAction = useCallback(async () => {
        if (!confirmAction) return;
        setConfirmLoading(true);
        try {
            await confirmAction.onConfirm();
            addToast(
                confirmAction.variant === 'danger'
                    ? 'Accion ejecutada exitosamente'
                    : 'Tenant actualizado',
                'success'
            );
            setConfirmAction(null);
            fetchTenants();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setConfirmLoading(false);
        }
    }, [confirmAction, addToast, fetchTenants]);

    const filtered = filter ? tenants.filter((t) => t.status === filter) : tenants;

    const healthyTenants = tenants.filter((t) => {
        const h = healthMap.get(t.slug);
        return h?.lastCheck?.apiHealthy && h?.lastCheck?.dbHealthy && h?.lastCheck?.containerUp;
    }).length;

    /* ── Loading skeleton ──────────────────────────────────────────────────── */

    if (loading) {
        return (
            <div>
                <div className="tenant-vps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="tenant-skeleton-pulse" style={{
                            background: '#fff',
                            borderRadius: 8,
                            padding: '1.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}>
                            <div style={{ width: '40%', height: 12, background: '#e2e8f0', borderRadius: 4, marginBottom: 12 }} />
                            <div style={{ width: '60%', height: 28, background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
                            <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4 }} />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="tenant-skeleton-pulse" style={{
                            width: 80,
                            height: 36,
                            background: '#e2e8f0',
                            borderRadius: 6,
                        }} />
                    ))}
                </div>

                <div style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="tenant-skeleton-pulse" style={{
                            height: 52,
                            background: i % 2 === 0 ? '#f8fafc' : '#fff',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 1rem',
                            gap: '2rem',
                        }}>
                            <div style={{ width: 120, height: 14, background: '#e2e8f0', borderRadius: 4 }} />
                            <div style={{ width: 100, height: 14, background: '#e2e8f0', borderRadius: 4 }} />
                            <div style={{ width: 60, height: 20, background: '#e2e8f0', borderRadius: 10 }} />
                            <div style={{ width: 50, height: 14, background: '#e2e8f0', borderRadius: 4 }} />
                            <div style={{ flex: 1 }} />
                            <div style={{ width: 80, height: 14, background: '#e2e8f0', borderRadius: 4 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    /* ── Render principal ──────────────────────────────────────────────────── */

    return (
        <div>
            {/* ── Estadisticas VPS ──────────────────────────────────────────────── */}
            {vpsStats && (
                <div className="tenant-vps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>CPU</h3>
                            <span style={{
                                fontSize: '1.4rem',
                                fontWeight: 700,
                                color: vpsStats.cpu.usagePercent > 80 ? COLORS.danger : vpsStats.cpu.usagePercent > 60 ? COLORS.warning : COLORS.primary,
                            }}>
                                {vpsStats.cpu.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.cpu.usagePercent}
                            color={vpsStats.cpu.usagePercent > 80 ? COLORS.danger : vpsStats.cpu.usagePercent > 60 ? COLORS.warning : COLORS.primary}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: COLORS.muted }}>
                            {vpsStats.cpu.cores} cores
                        </p>
                    </div>

                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Memoria</h3>
                            <span style={{
                                fontSize: '1.4rem',
                                fontWeight: 700,
                                color: vpsStats.memory.usagePercent > 80 ? COLORS.danger : vpsStats.memory.usagePercent > 60 ? COLORS.warning : COLORS.primary,
                            }}>
                                {vpsStats.memory.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.memory.usagePercent}
                            color={vpsStats.memory.usagePercent > 80 ? COLORS.danger : vpsStats.memory.usagePercent > 60 ? COLORS.warning : COLORS.primary}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: COLORS.muted }}>
                            {vpsStats.memory.usedMb} / {vpsStats.memory.totalMb} MB
                        </p>
                    </div>

                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Disco</h3>
                            <span style={{
                                fontSize: '1.4rem',
                                fontWeight: 700,
                                color: vpsStats.disk.usagePercent > 80 ? COLORS.danger : vpsStats.disk.usagePercent > 60 ? COLORS.warning : COLORS.primary,
                            }}>
                                {vpsStats.disk.usagePercent}%
                            </span>
                        </div>
                        <ProgressBar
                            percent={vpsStats.disk.usagePercent}
                            color={vpsStats.disk.usagePercent > 80 ? COLORS.danger : vpsStats.disk.usagePercent > 60 ? COLORS.warning : COLORS.primary}
                        />
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: COLORS.muted }}>
                            {vpsStats.disk.usedGb} / {vpsStats.disk.totalGb} GB
                        </p>
                    </div>

                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Docker</h3>
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.5rem' }}>
                            <div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: COLORS.primary }}>{vpsStats.docker.running}</div>
                                <div style={{ fontSize: '0.7rem', color: COLORS.muted }}>Running</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: vpsStats.docker.stopped > 0 ? COLORS.warning : COLORS.muted }}>{vpsStats.docker.stopped}</div>
                                <div style={{ fontSize: '0.7rem', color: COLORS.muted }}>Stopped</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>{vpsStats.docker.containers}</div>
                                <div style={{ fontSize: '0.7rem', color: COLORS.muted }}>Total</div>
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: COLORS.muted }}>
                            Uptime: {vpsStats.uptime}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Resumen rapido ─────────────────────────────────────────────── */}
            <div className="tenant-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${COLORS.dark}` }}>
                    <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{tenants.length}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${COLORS.primary}` }}>
                    <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Activos</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.primary }}>{tenants.filter((t) => t.status === 'ACTIVE').length}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${COLORS.warning}` }}>
                    <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Suspendidos</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.warning }}>{tenants.filter((t) => t.status === 'SUSPENDED').length}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${healthyTenants === tenants.filter((t) => t.status === 'ACTIVE').length && tenants.length > 0 ? COLORS.primary : COLORS.warning}` }}>
                    <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Saludables</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: healthyTenants === tenants.filter((t) => t.status === 'ACTIVE').length && tenants.length > 0 ? COLORS.primary : COLORS.warning }}>
                        {healthyTenants}/{tenants.filter((t) => t.status === 'ACTIVE').length}
                    </div>
                </div>
            </div>

            {/* ── Toolbar: filtros + boton crear ────────────────────────────── */}
            <div className="tenant-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div className="tenant-toolbar-filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                        { value: '', label: 'Todos' },
                        { value: 'ACTIVE', label: 'Activos' },
                        { value: 'SUSPENDED', label: 'Suspendidos' },
                        { value: 'DELETED', label: 'Eliminados' },
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setFilter(value)}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 6,
                                border: filter === value ? `1px solid ${COLORS.dark}` : `1px solid ${COLORS.border}`,
                                background: filter === value ? COLORS.dark : '#fff',
                                color: filter === value ? '#fff' : '#64748b',
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
                <button
                    onClick={() => { resetForm(); setShowCreateModal(true); }}
                    style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 6,
                        border: 'none',
                        background: COLORS.primary,
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        minHeight: 44,
                        transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.primaryHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.primary; }}
                >
                    Nuevo Tenant
                </button>
            </div>

            {/* ── Tabla desktop ─────────────────────────────────────────────── */}
            <div className="tenant-desktop-table" style={{
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                animation: 'fadeIn 0.3s ease',
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${COLORS.border}`, textAlign: 'left' }}>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Tenant</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Estado</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Plan</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Docker</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>API</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>DB</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Creado</th>
                                <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => {
                                const health = healthMap.get(t.slug);
                                const lastCheck = health?.lastCheck ?? null;
                                const dockerStatus = getHealthStatus(lastCheck);
                                const colors = STATUS_STYLES[t.status] || STATUS_STYLES.ACTIVE;
                                const hs = HEALTH_STATUS[dockerStatus];

                                return (
                                    <tr
                                        key={t.id}
                                        className="tenant-row"
                                        style={{
                                            borderBottom: `1px solid ${COLORS.borderLight}`,
                                            transition: 'background 0.1s ease',
                                        }}
                                    >
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div>
                                                <span
                                                    onClick={() => navigate(`/tenants/${t.slug}`)}
                                                    style={{
                                                        color: COLORS.info,
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {t.slug}
                                                </span>
                                                <div style={{ fontSize: '0.75rem', color: COLORS.muted, marginTop: 2 }}>
                                                    {t.domain}
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '3px 10px',
                                                    borderRadius: 12,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    background: colors.bg,
                                                    color: colors.text,
                                                    alignSelf: 'flex-start',
                                                }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
                                                    {t.status}
                                                </span>
                                            </div>
                                        </td>

                                        <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize' }}>{t.plan}</td>

                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                padding: '2px 8px',
                                                borderRadius: 8,
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: hs.bg,
                                                color: hs.color,
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hs.color, flexShrink: 0 }} />
                                                {hs.label}
                                            </span>
                                        </td>

                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <HealthBadge healthy={lastCheck?.apiHealthy ?? null} size="sm" />
                                        </td>

                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <HealthBadge healthy={lastCheck?.dbHealthy ?? null} size="sm" />
                                        </td>

                                        <td style={{ padding: '0.85rem 1rem', color: COLORS.muted, fontSize: '0.8rem' }}>
                                            {new Date(t.createdAt).toLocaleDateString('es-AR')}
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <ActionButton
                                                    onClick={() => navigate(`/tenants/${t.slug}`)}
                                                    color={COLORS.info}
                                                    hoverColor="#1d4ed8"
                                                    title="Ver detalle"
                                                >
                                                    Ver
                                                </ActionButton>

                                                {t.status === 'ACTIVE' ? (
                                                    <ActionButton
                                                        onClick={() => setConfirmAction({
                                                            title: `Suspender ${t.slug}`,
                                                            message: `El tenant ${t.slug} sera suspendido. Los contenedores se detendran y los usuarios no tendran acceso.`,
                                                            variant: 'warning',
                                                            onConfirm: () => handleSuspend(t.slug),
                                                        })}
                                                        color={COLORS.warning}
                                                        hoverColor="#b45309"
                                                        title="Suspender tenant"
                                                    >
                                                        Suspender
                                                    </ActionButton>
                                                ) : t.status === 'SUSPENDED' ? (
                                                    <ActionButton
                                                        onClick={() => setConfirmAction({
                                                            title: `Reactivar ${t.slug}`,
                                                            message: `El tenant ${t.slug} sera reactivado. Los contenedores se iniciaran nuevamente.`,
                                                            variant: 'warning',
                                                            onConfirm: () => handleResume(t.slug),
                                                        })}
                                                        color={COLORS.primary}
                                                        hoverColor={COLORS.primaryHover}
                                                        title="Reactivar tenant"
                                                    >
                                                        Reactivar
                                                    </ActionButton>
                                                ) : null}

                                                <ActionButton
                                                    onClick={() => setConfirmAction({
                                                        title: `Eliminar ${t.slug}`,
                                                        message: `Esta accion marcara el tenant ${t.slug} como eliminado. Esta accion puede ser revertida contactando soporte.`,
                                                        variant: 'danger',
                                                        onConfirm: () => handleDelete(t.slug),
                                                    })}
                                                    color={COLORS.danger}
                                                    hoverColor={COLORS.dangerHover}
                                                    disabled={t.status === 'DELETED'}
                                                    title="Eliminar tenant"
                                                >
                                                    Eliminar
                                                </ActionButton>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center' }}>
                                        <div style={{ color: COLORS.muted }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>No se encontraron tenants</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                                {filter ? `No hay tenants con estado "${filter}"` : 'Crea tu primer tenant para comenzar'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Cards mobile ──────────────────────────────────────────────── */}
            <div className="tenant-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map((t) => {
                    const health = healthMap.get(t.slug);
                    const lastCheck = health?.lastCheck ?? null;
                    const dockerStatus = getHealthStatus(lastCheck);
                    const colors = STATUS_STYLES[t.status] || STATUS_STYLES.ACTIVE;
                    const hs = HEALTH_STATUS[dockerStatus];

                    return (
                        <div
                            key={t.id}
                            style={{
                                background: '#fff',
                                borderRadius: 8,
                                padding: '1rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                animation: 'fadeIn 0.3s ease',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div>
                                    <span
                                        onClick={() => navigate(`/tenants/${t.slug}`)}
                                        style={{ color: COLORS.info, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                                    >
                                        {t.slug}
                                    </span>
                                    <div style={{ fontSize: '0.75rem', color: COLORS.muted }}>{t.domain}</div>
                                </div>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    fontSize: '0.7rem',
                                    fontWeight: 500,
                                    background: colors.bg,
                                    color: colors.text,
                                }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.dot }} />
                                    {t.status}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', padding: '2px 6px', borderRadius: 6, background: hs.bg, color: hs.color }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: hs.color }} />
                                    Docker: {hs.label}
                                </span>
                                <HealthBadge healthy={lastCheck?.apiHealthy ?? null} size="sm" />
                                <HealthBadge healthy={lastCheck?.dbHealthy ?? null} size="sm" />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'capitalize' }}>
                                    {t.plan} · {new Date(t.createdAt).toLocaleDateString('es-AR')}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <ActionButton onClick={() => navigate(`/tenants/${t.slug}`)} color={COLORS.info} hoverColor="#1d4ed8" title="Ver">
                                        Ver
                                    </ActionButton>
                                    {t.status === 'ACTIVE' && (
                                        <ActionButton
                                            onClick={() => setConfirmAction({
                                                title: `Suspender ${t.slug}`,
                                                message: `El tenant ${t.slug} sera suspendido.`,
                                                variant: 'warning',
                                                onConfirm: () => handleSuspend(t.slug),
                                            })}
                                            color={COLORS.warning}
                                            hoverColor="#b45309"
                                            title="Suspender"
                                        >
                                            Suspender
                                        </ActionButton>
                                    )}
                                    {t.status === 'SUSPENDED' && (
                                        <ActionButton
                                            onClick={() => setConfirmAction({
                                                title: `Reactivar ${t.slug}`,
                                                message: `El tenant ${t.slug} sera reactivado.`,
                                                variant: 'warning',
                                                onConfirm: () => handleResume(t.slug),
                                            })}
                                            color={COLORS.primary}
                                            hoverColor={COLORS.primaryHover}
                                            title="Reactivar"
                                        >
                                            Reactivar
                                        </ActionButton>
                                    )}
                                    <ActionButton
                                        onClick={() => setConfirmAction({
                                            title: `Eliminar ${t.slug}`,
                                            message: `El tenant ${t.slug} sera eliminado.`,
                                            variant: 'danger',
                                            onConfirm: () => handleDelete(t.slug),
                                        })}
                                        color={COLORS.danger}
                                        hoverColor={COLORS.dangerHover}
                                        disabled={t.status === 'DELETED'}
                                        title="Eliminar"
                                    >
                                        Eliminar
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '3rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        textAlign: 'center',
                        color: COLORS.muted,
                    }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>No se encontraron tenants</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {filter ? `No hay tenants con estado "${filter}"` : 'Crea tu primer tenant para comenzar'}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal: Crear Tenant ───────────────────────────────────────── */}
            {showCreateModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 480,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Crear Nuevo Tenant
                        </h2>

                        {formError && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 6,
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontSize: '0.85rem',
                                marginBottom: '1rem',
                                border: '1px solid #fecaca',
                            }}>
                                {formError}
                            </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Slug *
                            </label>
                            <input
                                type="text"
                                value={formSlug}
                                onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="mi-tenant"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>
                                Solo minusculas, numeros y guiones
                            </span>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Dominio (opcional)
                            </label>
                            <input
                                type="text"
                                value={formDomain}
                                onChange={(e) => setFormDomain(e.target.value)}
                                placeholder="Se genera automaticamente si se deja vacio"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Email del Admin
                            </label>
                            <input
                                type="email"
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                                placeholder="admin@ejemplo.com"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Usuario (opcional)
                            </label>
                            <input
                                type="text"
                                value={formUser}
                                onChange={(e) => setFormUser(e.target.value)}
                                placeholder="admin"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                Default: admin
                            </span>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Contrasena (opcional)
                            </label>
                            <input
                                type="password"
                                value={formPassword}
                                onChange={(e) => setFormPassword(e.target.value)}
                                placeholder="Se genera automaticamente si se deja vacio"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Plan
                            </label>
                            <select
                                value={formPlan}
                                onChange={(e) => setFormPlan(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                    background: '#fff',
                                }}
                            >
                                <option value="free">Free</option>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>

                        {provisioning && terminalLines.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: '0.5rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: provisionStatus === 'success' ? '#059669'
                                        : provisionStatus === 'error' ? '#dc2626'
                                        : '#1e40af',
                                }}>
                                    {provisionStatus === 'running' && (
                                        <div style={{
                                            width: 12,
                                            height: 12,
                                            border: '2px solid rgba(30,64,175,0.3)',
                                            borderTopColor: '#1e40af',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                        }} />
                                    )}
                                    {provisionStatus === 'success' ? 'Completado' : provisionStatus === 'error' ? 'Error' : 'Provisionando...'}
                                </div>
                                <Terminal lines={terminalLines} maxHeight={260} />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    minHeight: 44,
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !formSlug}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: creating || !formSlug ? '#94a3b8' : COLORS.primary,
                                    color: '#fff',
                                    cursor: creating || !formSlug ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    minHeight: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {creating && (
                                    <div style={{
                                        width: 16,
                                        height: 16,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                )}
                                {creating ? 'Provisionando...' : 'Crear Tenant'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Credenciales generadas ──────────────────────────────── */}
            {createdTenant && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setCreatedTenant(null); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 520,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                background: '#ecfdf5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.75rem',
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                Tenant Provisionado
                            </h2>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: COLORS.muted }}>
                                {createdTenant.slug} · {createdTenant.domain}
                            </p>
                        </div>

                        <div style={{
                            background: '#f0fdf4',
                            borderRadius: 8,
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem',
                            fontSize: '0.8rem',
                            color: '#065f46',
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Infraestructura creada:</div>
                            <div>- Contenedor PostgreSQL (db-{createdTenant.slug})</div>
                            <div>- Contenedor API (api-{createdTenant.slug})</div>
                            <div>- Volumen de datos persistente</div>
                            <div>- Certificado TLS auto-firmado</div>
                            <div>- Configuracion Caddy (routing HTTPS)</div>
                        </div>

                        <div style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: '1rem',
                            marginBottom: '1.5rem',
                        }}>
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                Credenciales de administrador
                            </p>
                            {createdTenant.adminEmail && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>Email: </span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1e293b' }}>{createdTenant.adminEmail}</span>
                                </div>
                            )}
                            <div>
                                <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>Contrasena: </span>
                                <code style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    background: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #e2e8f0',
                                }}>
                                    {createdTenant.adminPasswordPlain}
                                </code>
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>URL: </span>
                                <a
                                    href={`https://${createdTenant.domain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.85rem', color: COLORS.info }}
                                >
                                    https://{createdTenant.domain}
                                </a>
                            </div>
                        </div>

                        <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 6,
                            background: '#fffbeb',
                            color: '#92400e',
                            fontSize: '0.8rem',
                            marginBottom: '1.5rem',
                            border: '1px solid #fde68a',
                        }}>
                            Guarda estas credenciales. No se van a mostrar de nuevo.
                        </div>

                        <button
                            onClick={() => setCreatedTenant(null)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: 6,
                                border: 'none',
                                background: COLORS.dark,
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                minHeight: 44,
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal: Confirmar accion ───────────────────────────────────── */}
            {confirmAction && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget && !confirmLoading) setConfirmAction(null); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 420,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                background: confirmAction.variant === 'danger' ? '#fef2f2' : '#fffbeb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.75rem',
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: confirmAction.variant === 'danger' ? '#dc2626' : '#d97706',
                            }}>
                                {confirmAction.variant === 'danger' ? 'X' : '!'}
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                                {confirmAction.title}
                            </h2>
                            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                                {confirmAction.message}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setConfirmAction(null)}
                                disabled={confirmLoading}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: confirmLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    minHeight: 44,
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeConfirmAction}
                                disabled={confirmLoading}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: confirmAction.variant === 'danger' ? COLORS.danger : COLORS.warning,
                                    color: '#fff',
                                    cursor: confirmLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    minHeight: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {confirmLoading && (
                                    <div style={{
                                        width: 14,
                                        height: 14,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                )}
                                {confirmLoading ? 'Procesando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast notifications ─────────────────────────────────────────── */}
            <div style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                pointerEvents: 'none',
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="tenant-toast"
                        style={{
                            padding: '0.75rem 1.25rem',
                            borderRadius: 8,
                            background: toast.type === 'success' ? '#065f46' : '#991b1b',
                            color: '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            maxWidth: 360,
                            pointerEvents: 'auto',
                        }}
                    >
                        {toast.type === 'success' ? '[OK] ' : '[ERROR] '}{toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
