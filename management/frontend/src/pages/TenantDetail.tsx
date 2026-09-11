import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge';
import Terminal, { TerminalLine } from '../components/Terminal';

/* ── Estilos inyectados ─────────────────────────────────────────────────── */

const globalStyles = `
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes slideIn {
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.toast-msg { animation: slideIn 0.3s ease; }
.tdetail-row:hover { background: #f8fafc !important; }
@media (max-width: 768px) {
    .tdetail-info-grid { grid-template-columns: 1fr !important; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('tenant-detail-styles')) {
    const style = document.createElement('style');
    style.id = 'tenant-detail-styles';
    style.textContent = globalStyles;
    document.head.appendChild(style);
}

/* ── Tipos ──────────────────────────────────────────────────────────────── */

interface TenantDetail {
    id: string;
    slug: string;
    domain: string;
    url: string;
    status: string;
    plan: string;
    product?: string;
    adminEmail: string | null;
    createdAt: string;
    payments: { id: string; amountCents: number; status: string; createdAt: string }[];
    healthChecks: { id: string; apiHealthy: boolean; dbHealthy: boolean; containerUp: boolean; memoryMb: number | null; checkedAt: string }[];
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

/* ── Colores ────────────────────────────────────────────────────────────── */

const COLORS = {
    primary: '#059669',
    primaryHover: '#047857',
    danger: '#dc2626',
    dangerHover: '#b91c1c',
    warning: '#d97706',
    info: '#2563eb',
    dark: '#1a1a2e',
    muted: '#64748b',
    border: '#e2e8f0',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PROVISIONING: { bg: '#eff6ff', text: '#1e40af', dot: '#2563eb' },
    ERROR: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    SUSPENDED: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    DELETED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
};

// Nombres completos de producto para mostrar en el header
const PRODUCT_NAMES: Record<string, string> = {
    market: 'ALL MARKET',
    repair: 'ALL REPAIR',
};

function getProductName(product?: string): string {
    if (!product) return 'ALL MARKET';
    return PRODUCT_NAMES[product] || product;
}

/* ── Componente principal ───────────────────────────────────────────────── */

export default function TenantDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [editingPlan, setEditingPlan] = useState(false);
    const [planValue, setPlanValue] = useState('');

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        variant: 'danger' | 'warning';
        onConfirm: () => Promise<void>;
    } | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [consoleLogs, setConsoleLogs] = useState<TerminalLine[]>([]);
    const [consoleLoading, setConsoleLoading] = useState(false);
    const [activeConsoleTab, setActiveConsoleTab] = useState<'api' | 'db'>('api');
    const [provisionLogs, setProvisionLogs] = useState<TerminalLine[]>([]);

    const token = localStorage.getItem('mgmt_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const fetchTenant = useCallback(() => {
        fetch(`/api/tenants/${slug}`, { headers })
            .then((r) => r.json())
            .then((data) => {
                setTenant(data);
                setPlanValue(data.plan);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [slug]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    /* ── Logs del contenedor ─────────────────────────────────────────── */

    const fetchConsoleLogs = useCallback(async () => {
        if (!slug) return;
        setConsoleLoading(true);
        try {
            const token = localStorage.getItem('mgmt_token');
            const res = await fetch(`/api/tenants/${slug}/logs?tail=50`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Error al obtener logs');
            const data = await res.json();

            const buildLines = (rawLogs: string[]): TerminalLine[] =>
                rawLogs.map((line) => ({
                    timestamp: new Date(),
                    message: line,
                    type: line.toLowerCase().includes('error')
                        ? 'error' as const
                        : line.toLowerCase().includes('warn')
                            ? 'warning' as const
                            : 'info' as const,
                }));

            setConsoleLogs(buildLines(data.api || []));
        } catch {
            setConsoleLogs([{
                timestamp: new Date(),
                message: 'No se pudieron obtener los logs del contenedor',
                type: 'error',
            }]);
        } finally {
            setConsoleLoading(false);
        }
    }, [slug]);

    // Cargar logs cuando se monta la pestana de consola
    useEffect(() => {
        if (slug && tenant?.status === 'ACTIVE') {
            fetchConsoleLogs();
        }
    }, [slug, tenant?.status, fetchConsoleLogs]);

    /* ── Logs de provisioning en vivo ──────────────────────────────────── */

    const buildTerminalLines = (rawLogs: string[]): TerminalLine[] =>
        rawLogs.map((line) => ({
            timestamp: new Date(),
            message: line,
            type: line.toLowerCase().includes('error')
                ? 'error' as const
                : line.toLowerCase().includes('warn')
                    ? 'warning' as const
                    : 'info' as const,
        }));

    // Trae { status, logs } del provisioning en background (o { api, db } si ya no hay estado en memoria)
    const fetchProvisioningLogs = useCallback(async () => {
        if (!slug) return;
        try {
            const token = localStorage.getItem('mgmt_token');
            const res = await fetch(`/api/tenants/${slug}/logs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Error al obtener logs');
            const data = await res.json();

            if (Array.isArray(data.logs)) {
                setProvisionLogs(buildTerminalLines(data.logs));
            }
        } catch {
            // El polling reintenta en el siguiente tick; no romper la UI
        }
    }, [slug]);

    // Polling cada 3s mientras el tenant este en PROVISIONING:
    // actualiza los logs en vivo y refresca el tenant para detectar
    // la transicion a ACTIVE o ERROR (ahi se corta el polling)
    useEffect(() => {
        if (tenant?.status !== 'PROVISIONING') return;
        fetchProvisioningLogs();
        const interval = setInterval(() => {
            fetchProvisioningLogs();
            fetchTenant();
        }, 3000);
        return () => clearInterval(interval);
    }, [tenant?.status, fetchProvisioningLogs, fetchTenant]);

    // Si el provisioning termino en ERROR, capturar los logs finales una vez
    useEffect(() => {
        if (tenant?.status === 'ERROR') {
            fetchProvisioningLogs();
        }
    }, [tenant?.status, fetchProvisioningLogs]);

    /* ── Acciones ──────────────────────────────────────────────────────── */

    async function handleAction(action: 'suspend' | 'resume') {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/tenants/${slug}/${action}`, { method: 'POST', headers });
            if (!res.ok) throw new Error(`Error al ${action === 'suspend' ? 'suspender' : 'reactivar'}`);
            addToast(
                action === 'suspend' ? 'Tenant suspendido' : 'Tenant reactivado',
                'success'
            );
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSavePlan() {
        if (!planValue || planValue === tenant?.plan) {
            setEditingPlan(false);
            return;
        }
        setActionLoading(true);
        try {
            const res = await fetch(`/api/tenants/${slug}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ plan: planValue }),
            });
            if (!res.ok) throw new Error('Error al actualizar plan');
            addToast('Plan actualizado', 'success');
            setEditingPlan(false);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleDelete() {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/tenants/${slug}`, {
                method: 'DELETE',
                headers,
            });
            if (!res.ok) throw new Error('Error al eliminar tenant');
            addToast('Tenant eliminado', 'success');
            setTimeout(() => navigate('/tenants'), 1500);
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setActionLoading(false);
        }
    }

    async function executeConfirmAction() {
        if (!confirmAction) return;
        setConfirmLoading(true);
        try {
            await confirmAction.onConfirm();
            setConfirmAction(null);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setConfirmLoading(false);
        }
    }

    if (loading) return <p style={{ color: '#64748b' }}>Cargando tenant...</p>;
    if (!tenant) return <p style={{ color: '#64748b' }}>Tenant no encontrado</p>;

    const statusStyle = STATUS_STYLES[tenant.status] || STATUS_STYLES.ACTIVE;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{tenant.slug}</h2>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 10px',
                            borderRadius: 999,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                        }}>
                            {getProductName(tenant.product)}
                        </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{tenant.domain}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {tenant.status === 'ACTIVE' ? (
                        <button
                            onClick={() => setConfirmAction({
                                title: `Suspender ${tenant.slug}`,
                                message: `El tenant ${tenant.slug} sera suspendido. Los contenedores se detendran y los usuarios no tendran acceso.`,
                                variant: 'warning',
                                onConfirm: () => handleAction('suspend'),
                            })}
                            disabled={actionLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#fffbeb',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                minHeight: 44,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {actionLoading ? 'Procesando...' : 'Suspender'}
                        </button>
                    ) : tenant.status === 'SUSPENDED' ? (
                        <button
                            onClick={() => setConfirmAction({
                                title: `Reactivar ${tenant.slug}`,
                                message: `El tenant ${tenant.slug} sera reactivado. Los contenedores se iniciaran nuevamente.`,
                                variant: 'warning',
                                onConfirm: () => handleAction('resume'),
                            })}
                            disabled={actionLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                minHeight: 44,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {actionLoading ? 'Procesando...' : 'Reactivar'}
                        </button>
                    ) : null}

                    <button
                        onClick={() => setConfirmAction({
                            title: `Eliminar ${tenant.slug}`,
                            message: `Esta accion eliminara el tenant ${tenant.slug}: contenedores, volumenes, archivos y registro en base de datos. No se puede deshacer.`,
                            variant: 'danger',
                            onConfirm: handleDelete,
                        })}
                        disabled={actionLoading || tenant.status === 'DELETED'}
                        style={{
                            padding: '0.5rem 1rem',
                            background: tenant.status === 'DELETED' ? '#e2e8f0' : '#fef2f2',
                            color: tenant.status === 'DELETED' ? '#94a3b8' : '#991b1b',
                            border: `1px solid ${tenant.status === 'DELETED' ? '#cbd5e1' : '#fecaca'}`,
                            borderRadius: 8,
                            cursor: tenant.status === 'DELETED' ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            minHeight: 44,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        Eliminar
                    </button>

                    <button
                        onClick={() => navigate('/tenants')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#475569',
                            fontWeight: 500,
                            minHeight: 44,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        Volver
                    </button>
                </div>
            </div>

            {/* Info grid */}
            <div className="tdetail-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Informacion general + Plan edit */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                        Informacion General
                    </h3>
                    <dl style={{ margin: 0, fontSize: '0.9rem' }}>
                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>Estado</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: statusStyle.bg,
                                color: statusStyle.text,
                                whiteSpace: 'nowrap',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle.dot, flexShrink: 0 }} />
                                {tenant.status}
                            </span>
                        </dd>

                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>Plan</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>
                            {editingPlan ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        value={planValue}
                                        onChange={(e) => setPlanValue(e.target.value)}
                                        disabled={actionLoading}
                                        style={{
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: 8,
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.85rem',
                                            background: '#fff',
                                            minHeight: 44,
                                            outline: 'none',
                                        }}
                                    >
                                        <option value="free">Free</option>
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                    <button
                                        onClick={handleSavePlan}
                                        disabled={actionLoading || planValue === tenant.plan}
                                        style={{
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: actionLoading || planValue === tenant.plan ? '#94a3b8' : COLORS.primary,
                                            color: '#fff',
                                            cursor: actionLoading || planValue === tenant.plan ? 'not-allowed' : 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            minHeight: 44,
                                        }}
                                    >
                                        {actionLoading ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                        onClick={() => { setEditingPlan(false); setPlanValue(tenant.plan); }}
                                        disabled={actionLoading}
                                        style={{
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: 8,
                                            border: '1px solid #e2e8f0',
                                            background: '#fff',
                                            color: '#475569',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            minHeight: 44,
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ textTransform: 'capitalize', fontWeight: 500, color: '#1e293b' }}>{tenant.plan}</span>
                                    <button
                                        onClick={() => { setEditingPlan(true); setPlanValue(tenant.plan); }}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: 4,
                                            border: '1px solid #e2e8f0',
                                            background: '#fff',
                                            color: COLORS.info,
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            )}
                        </dd>

                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>URL</dt>
                        <dd style={{ margin: '0 0 0.75rem' }}>
                            <a href={tenant.url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.info }}>
                                {tenant.url}
                            </a>
                        </dd>
                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>Admin Email</dt>
                        <dd style={{ margin: '0 0 0.75rem', color: '#1e293b' }}>{tenant.adminEmail || '---'}</dd>
                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>Creado</dt>
                        <dd style={{ margin: 0, color: '#1e293b' }}>{new Date(tenant.createdAt).toLocaleString('es-AR')}</dd>
                    </dl>
                </div>

                {/* Health history */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                        Historial de Salud
                    </h3>
                    {tenant.healthChecks.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin registros de salud</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Fecha</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>API</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>DB</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Cont.</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>RAM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenant.healthChecks.map((hc) => (
                                    <tr key={hc.id} className="tdetail-row" style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s ease' }}>
                                        <td style={{ padding: '0.5rem 0', color: '#475569' }}>
                                            {new Date(hc.checkedAt).toLocaleString('es-AR')}
                                        </td>
                                        <td><HealthBadge healthy={hc.apiHealthy} size="sm" /></td>
                                        <td><HealthBadge healthy={hc.dbHealthy} size="sm" /></td>
                                        <td><HealthBadge healthy={hc.containerUp} size="sm" /></td>
                                        <td style={{ color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{hc.memoryMb ? `${hc.memoryMb} MB` : '---'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Payments */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                    Pagos Recientes
                </h3>
                {tenant.payments.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin pagos registrados</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Fecha</th>
                                <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Monto</th>
                                <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenant.payments.map((p) => (
                                <tr key={p.id} className="tdetail-row" style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s ease' }}>
                                    <td style={{ padding: '0.5rem 0', color: '#475569' }}>
                                        {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                    </td>
                                    <td style={{ color: '#1e293b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${(p.amountCents / 100).toFixed(2)}</td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '2px 10px',
                                            borderRadius: 999,
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: p.status === 'PAID' ? '#ecfdf5' : p.status === 'PENDING' ? '#fffbeb' : '#fef2f2',
                                            color: p.status === 'PAID' ? '#065f46' : p.status === 'PENDING' ? '#92400e' : '#991b1b',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'PAID' ? '#059669' : p.status === 'PENDING' ? '#d97706' : '#dc2626', flexShrink: 0 }} />
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Consola del contenedor ──────────────────────────────────── */}
            {(tenant.status === 'ACTIVE' || tenant.status === 'PROVISIONING' || tenant.status === 'ERROR') && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                                Consola
                            </h3>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: statusStyle.bg,
                                color: statusStyle.text,
                                whiteSpace: 'nowrap',
                            }}>
                                {tenant.status === 'PROVISIONING' ? (
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        border: '2px solid rgba(37,99,235,0.25)',
                                        borderTopColor: '#2563eb',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                ) : (
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle.dot, flexShrink: 0 }} />
                                )}
                                {tenant.status}
                            </span>
                        </div>

                        {tenant.status === 'ACTIVE' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {(['api', 'db'] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => {
                                                setActiveConsoleTab(tab);
                                                fetchConsoleLogs();
                                            }}
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: 8,
                                                border: activeConsoleTab === tab ? `1px solid ${COLORS.dark}` : `1px solid ${COLORS.border}`,
                                                background: activeConsoleTab === tab ? COLORS.dark : '#fff',
                                                color: activeConsoleTab === tab ? '#fff' : '#64748b',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                minHeight: 32,
                                            }}
                                        >
                                            {tab.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={fetchConsoleLogs}
                                    disabled={consoleLoading}
                                    style={{
                                        padding: '0.3rem 0.75rem',
                                        borderRadius: 8,
                                        border: `1px solid ${COLORS.border}`,
                                        background: '#fff',
                                        color: COLORS.info,
                                        cursor: consoleLoading ? 'not-allowed' : 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        minHeight: 32,
                                    }}
                                >
                                    {consoleLoading ? 'Cargando...' : 'Actualizar'}
                                </button>
                            </div>
                        )}
                    </div>

                    {tenant.status === 'PROVISIONING' || tenant.status === 'ERROR' ? (
                        <Terminal lines={provisionLogs} maxHeight={300} />
                    ) : consoleLogs.length === 0 && !consoleLoading ? (
                        <div style={{
                            background: '#1a1a2e',
                            borderRadius: 12,
                            padding: '2rem',
                            textAlign: 'center',
                            color: '#64748b',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.8rem',
                        }}>
                            Sin logs disponibles — el contenedor podria estar detenido
                        </div>
                    ) : (
                        <Terminal lines={consoleLogs} maxHeight={300} />
                    )}
                </div>
            )}

            {/* ── Modal: Confirmar accion ─────────────────────────────────── */}
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
                                    borderRadius: 8,
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
                                    borderRadius: 8,
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

            {/* ── Toast notifications ─────────────────────────────────────── */}
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
                        className="toast-msg"
                        style={{
                            padding: '0.75rem 1.25rem',
                            borderRadius: 12,
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
