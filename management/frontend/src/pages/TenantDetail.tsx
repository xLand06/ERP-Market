import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge';
import Terminal, { TerminalLine } from '../components/Terminal';
import { apiFetch } from '../api';

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
    billingCycle?: string;
    product?: string;
    adminEmail: string | null;
    subscriptionStartedAt?: string | null;
    lastPaymentAt: string | null;
    nextPaymentDue: string | null;
    discountPercent?: number;
    customPriceCents?: number | null;
    systemNotice?: string | null;
    noticeLevel?: string;
    createdAt: string;
    payments: {
        id: string;
        amountCents: number;
        currency: string;
        status: string;
        provider: string | null;
        billingCycle?: string | null;
        periodMonths?: number | null;
        paymentCode: string | null;
        externalId: string | null;
        dueDate: string | null;
        paidAt: string | null;
        createdAt: string;
    }[];
    healthChecks: { id: string; apiHealthy: boolean; dbHealthy: boolean; containerUp: boolean; memoryMb: number | null; checkedAt: string }[];
}

interface UsageMetrics {
    usersCount: number;
    productsCount: number;
    branchesCount: number;
}

interface BackupItem {
    filename: string;
    sizeBytes: number;
    createdAt: string;
}

interface AuditLogItem {
    id: string;
    actor: string;
    action: string;
    tenantId: string | null;
    details: any;
    createdAt: string;
}

const PLAN_CANONICAL_LIMITS: Record<string, { maxUsers: number; maxBranches: number; maxProducts: number }> = {
    free: { maxUsers: 1, maxBranches: 1, maxProducts: 50 },
    basic: { maxUsers: 3, maxBranches: 1, maxProducts: 250 },
    pro: { maxUsers: 10, maxBranches: 2, maxProducts: 1000 },
    premium: { maxUsers: 999, maxBranches: 5, maxProducts: 99999 },
};

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

function KeyIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
    );
}

function DatabaseIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
    );
}

function ZapIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}

function RefreshIcon({ size = 14, color = 'currentColor', spin = false }: { size?: number; color?: string; spin?: boolean }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={spin ? { animation: 'spin 1s linear infinite' } : undefined}
        >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
        </svg>
    );
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

// Metodos de pago disponibles
const PAYMENT_PROVIDERS = ['zelle', 'pago_movil', 'binance', 'cash', 'other'] as const;

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
    zelle: 'Zelle',
    pago_movil: 'Pago Movil',
    binance: 'Binance',
    cash: 'Efectivo',
    other: 'Otro',
};

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PENDING: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    OVERDUE: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    FAILED: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    REFUNDED: { bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6' },
    CANCELLED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
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
    const [cycleValue, setCycleValue] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

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

    // Estado del registro de pagos
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        provider: 'zelle' as string,
        billingCycle: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
        externalId: '',
        dueDate: '',
    });
    const [lastPaymentCode, setLastPaymentCode] = useState<string | null>(null);
    const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);

    // Estados de Control Total: Extender, Fechas, Descuentos y Avisos
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendDays, setExtendDays] = useState('7');
    const [extendReason, setExtendReason] = useState('Cortesía administrativa');
    const [extendSubmitting, setExtendSubmitting] = useState(false);

    const [showDatesModal, setShowDatesModal] = useState(false);
    const [datesStartedAt, setDatesStartedAt] = useState('');
    const [datesNextDue, setDatesNextDue] = useState('');
    const [datesReason, setDatesReason] = useState('Ajuste manual de fechas');
    const [datesSubmitting, setDatesSubmitting] = useState(false);

    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [noticeText, setNoticeText] = useState('');
    const [noticeLevel, setNoticeLevel] = useState<'INFO' | 'WARNING' | 'DANGER'>('INFO');
    const [noticeSubmitting, setNoticeSubmitting] = useState(false);

    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountPercentVal, setDiscountPercentVal] = useState('0');
    const [customPriceVal, setCustomPriceVal] = useState('');
    const [discountSubmitting, setDiscountSubmitting] = useState(false);

    // Telemetría, Backups, Auditoría e Impersonación
    const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);

    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [backupsLoading, setBackupsLoading] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);

    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const [impersonating, setImpersonating] = useState(false);

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const [auditFilter, setAuditFilter] = useState('');
    const [backupFilter, setBackupFilter] = useState('');

    const filteredBackups = useMemo(() => {
        if (!backupFilter.trim()) return backups;
        const q = backupFilter.toLowerCase().trim();
        return backups.filter((b) => b.filename.toLowerCase().includes(q));
    }, [backups, backupFilter]);

    const filteredAuditLogs = useMemo(() => {
        if (!auditFilter.trim()) return auditLogs;
        const q = auditFilter.toLowerCase().trim();
        return auditLogs.filter(
            (l) =>
                l.action.toLowerCase().includes(q) ||
                l.actor.toLowerCase().includes(q) ||
                (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
        );
    }, [auditLogs, auditFilter]);

    const fetchMetrics = useCallback(async (force = false) => {
        if (!slug) return;
        setMetricsLoading(true);
        try {
            const url = force ? `/api/tenants/${slug}/metrics?force=true` : `/api/tenants/${slug}/metrics`;
            const res = await apiFetch<{ metrics: UsageMetrics }>(url);
            setMetrics(res.metrics || null);
        } catch {
            setMetrics(null);
        } finally {
            setMetricsLoading(false);
        }
    }, [slug]);

    const fetchBackups = useCallback(async () => {
        if (!slug) return;
        setBackupsLoading(true);
        try {
            const res = await apiFetch<BackupItem[]>(`/api/tenants/${slug}/backups`);
            setBackups(Array.isArray(res) ? res : []);
        } catch {
            setBackups([]);
        } finally {
            setBackupsLoading(false);
        }
    }, [slug]);

    const fetchAudit = useCallback(async (tId?: string) => {
        const targetId = tId || tenant?.id;
        if (!targetId) return;
        setAuditLoading(true);
        try {
            const res = await apiFetch<AuditLogItem[]>(`/api/audit?tenantId=${targetId}&limit=50`);
            setAuditLogs(Array.isArray(res) ? res : []);
        } catch {
            setAuditLogs([]);
        } finally {
            setAuditLoading(false);
        }
    }, [tenant?.id]);

    async function handleCreateBackup() {
        if (!slug) return;
        setCreatingBackup(true);
        try {
            const res = await apiFetch<BackupItem>(`/api/tenants/${slug}/backups`, { method: 'POST' });
            addToast(`Respaldo generado con éxito (${(res.sizeBytes / 1024).toFixed(1)} KB)`, 'success');
            fetchBackups();
            if (tenant?.id) fetchAudit(tenant.id);
        } catch (e: any) {
            addToast(e.message || 'Error al generar respaldo', 'error');
        } finally {
            setCreatingBackup(false);
        }
    }

    async function handleImpersonate() {
        if (!slug) return;
        setImpersonating(true);
        try {
            const res = await apiFetch<{ launchUrl: string; user: any }>(`/api/tenants/${slug}/impersonate`, { method: 'POST' });
            addToast(`Sesión de soporte iniciada para ${res.user?.nombre || res.user?.username}. Abriendo ERP...`, 'success');
            window.open(res.launchUrl, '_blank', 'noopener,noreferrer');
            if (tenant?.id) fetchAudit(tenant.id);
        } catch (e: any) {
            addToast(e.message || 'Error al generar sesión de soporte', 'error');
        } finally {
            setImpersonating(false);
        }
    }

    const fetchTenant = useCallback(() => {
        apiFetch<TenantDetail>(`/api/tenants/${slug}`)
            .then((data) => {
                setTenant(data);
                setPlanValue(data.plan);
                setCycleValue(data.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY');
                setDiscountPercentVal(String(data.discountPercent ?? 0));
                setCustomPriceVal(data.customPriceCents ? (data.customPriceCents / 100).toFixed(2) : '');
                setNoticeText(data.systemNotice || '');
                setNoticeLevel((data.noticeLevel as any) || 'INFO');
                if (data.subscriptionStartedAt) {
                    setDatesStartedAt(new Date(data.subscriptionStartedAt).toISOString().split('T')[0]);
                }
                if (data.nextPaymentDue) {
                    setDatesNextDue(new Date(data.nextPaymentDue).toISOString().split('T')[0]);
                }
                fetchMetrics();
                fetchBackups();
                fetchAudit(data.id);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [slug, fetchMetrics, fetchBackups, fetchAudit]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    /* ── Logs del contenedor ─────────────────────────────────────────── */

    const fetchConsoleLogs = useCallback(async () => {
        if (!slug) return;
        setConsoleLoading(true);
        try {
            const data = await apiFetch<{ api?: string[] }>(`/api/tenants/${slug}/logs?tail=50`);

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
            const data = await apiFetch<{ logs?: string[] }>(`/api/tenants/${slug}/logs`);

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
            await apiFetch(`/api/tenants/${slug}/${action}`, { method: 'POST' });
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
        if (!planValue || (planValue === tenant?.plan && cycleValue === (tenant?.billingCycle || 'MONTHLY'))) {
            setEditingPlan(false);
            return;
        }
        setActionLoading(true);
        try {
            await apiFetch(`/api/tenants/${slug}`, {
                method: 'PATCH',
                body: { plan: planValue, billingCycle: cycleValue },
            });
            addToast('Plan y ciclo actualizados', 'success');
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
            await apiFetch(`/api/tenants/${slug}`, {
                method: 'DELETE',
            });
            addToast('Tenant eliminado', 'success');
            setTimeout(() => navigate('/tenants'), 1500);
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setActionLoading(false);
        }
    }

    /* ── Control Total: Extensión, Fechas, Avisos y Descuentos ─────────── */

    async function handleExtendSubscription() {
        const daysNum = parseInt(extendDays, 10);
        if (!daysNum || daysNum <= 0) {
            addToast('Ingresá una cantidad de días válida', 'error');
            return;
        }
        setExtendSubmitting(true);
        try {
            await apiFetch(`/api/tenants/${slug}/extend`, {
                method: 'POST',
                body: { days: daysNum, reason: extendReason },
            });
            addToast(`Suscripción extendida por ${daysNum} días`, 'success');
            setShowExtendModal(false);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error al extender suscripción', 'error');
        } finally {
            setExtendSubmitting(false);
        }
    }

    async function handleSetDates() {
        if (!datesNextDue) {
            addToast('La fecha de vencimiento es obligatoria', 'error');
            return;
        }
        setDatesSubmitting(true);
        try {
            await apiFetch(`/api/tenants/${slug}/set-subscription`, {
                method: 'POST',
                body: {
                    startedAt: datesStartedAt ? new Date(datesStartedAt + 'T00:00:00').toISOString() : undefined,
                    nextPaymentDue: new Date(datesNextDue + 'T23:59:59').toISOString(),
                    reason: datesReason,
                },
            });
            addToast('Fechas de suscripción actualizadas', 'success');
            setShowDatesModal(false);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error al fijar fechas', 'error');
        } finally {
            setDatesSubmitting(false);
        }
    }

    async function handleSaveNotice(clear: boolean = false) {
        setNoticeSubmitting(true);
        try {
            await apiFetch(`/api/tenants/${slug}/notice`, {
                method: 'PATCH',
                body: {
                    notice: clear ? null : (noticeText.trim() || null),
                    level: noticeLevel,
                },
            });
            addToast(clear ? 'Aviso eliminado' : 'Aviso actualizado y sincronizado', 'success');
            if (clear) setNoticeText('');
            setShowNoticeModal(false);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error al guardar aviso', 'error');
        } finally {
            setNoticeSubmitting(false);
        }
    }

    async function handleSaveDiscount() {
        const discountNum = parseInt(discountPercentVal, 10);
        if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
            addToast('El descuento debe estar entre 0 y 100%', 'error');
            return;
        }
        const customPriceNum = customPriceVal.trim() !== '' ? parseFloat(customPriceVal) : null;
        if (customPriceNum !== null && (isNaN(customPriceNum) || customPriceNum < 0)) {
            addToast('El precio personalizado no es válido', 'error');
            return;
        }

        setDiscountSubmitting(true);
        try {
            await apiFetch(`/api/tenants/${slug}`, {
                method: 'PATCH',
                body: {
                    discountPercent: discountNum,
                    customPriceCents: customPriceNum !== null ? Math.round(customPriceNum * 100) : null,
                },
            });
            addToast('Descuentos y tarifas actualizados', 'success');
            setShowDiscountModal(false);
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error al actualizar descuento', 'error');
        } finally {
            setDiscountSubmitting(false);
        }
    }

    /* ── Pagos ─────────────────────────────────────────────────────────── */

    async function handleRegisterPayment() {
        setPaymentError(null);
        if (!tenant) return;

        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0) {
            setPaymentError('Ingresa un monto mayor a 0');
            return;
        }

        const amountCents = Math.round(amount * 100);
        setPaymentSubmitting(true);
        try {
            const data = await apiFetch<any>('/api/payments', {
                method: 'POST',
                body: {
                    tenantId: tenant.id,
                    amountCents,
                    provider: paymentForm.provider,
                    billingCycle: paymentForm.billingCycle,
                    periodMonths: paymentForm.billingCycle === 'ANNUAL' ? 12 : 1,
                    externalId: paymentForm.externalId || undefined,
                    dueDate: paymentForm.dueDate
                        ? new Date(paymentForm.dueDate + 'T12:00:00').toISOString()
                        : undefined,
                },
            });

            setLastPaymentCode(data.paymentCode || null);
            addToast('Pago registrado', 'success');
            setPaymentForm({ amount: '', provider: 'zelle', billingCycle: 'MONTHLY', externalId: '', dueDate: '' });
            fetchTenant();
        } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Error de conexion');
        } finally {
            setPaymentSubmitting(false);
        }
    }

    async function handleConfirmPayment(paymentId: string) {
        setConfirmingPaymentId(paymentId);
        try {
            await apiFetch(`/api/payments/${paymentId}/confirm`, {
                method: 'POST',
            });
            addToast('Pago confirmado', 'success');
            fetchTenant();
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Error desconocido', 'error');
        } finally {
            setConfirmingPaymentId(null);
        }
    }

    async function copyPaymentCode(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            addToast('Codigo copiado al portapapeles', 'success');
        } catch {
            addToast('No se pudo copiar el codigo', 'error');
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
                    {/* Botón de Acceso de Soporte (Login As) */}
                    <button
                        onClick={handleImpersonate}
                        disabled={impersonating || tenant.status !== 'ACTIVE'}
                        title={tenant.status !== 'ACTIVE' ? 'El tenant debe estar activo para entrar' : 'Iniciar sesión en el ERP como soporte'}
                        style={{
                            padding: '0.5rem 1rem',
                            background: tenant.status !== 'ACTIVE' ? '#f1f5f9' : '#eef2ff',
                            color: tenant.status !== 'ACTIVE' ? '#94a3b8' : '#4338ca',
                            border: `1px solid ${tenant.status !== 'ACTIVE' ? '#cbd5e1' : '#c7d2fe'}`,
                            borderRadius: 8,
                            cursor: tenant.status !== 'ACTIVE' || impersonating ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <KeyIcon size={15} color={tenant.status !== 'ACTIVE' ? '#94a3b8' : '#4338ca'} />
                        {impersonating ? 'Iniciando...' : 'Acceso Soporte'}
                    </button>

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

                        <dt style={{ color: '#64748b', marginBottom: 2, fontWeight: 600, fontSize: '0.8rem' }}>Plan y Facturación</dt>
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
                                        <option value="basic">Basic ($10/m | $100/a)</option>
                                        <option value="pro">Pro ($20/m | $200/a)</option>
                                        <option value="premium">Premium ($30/m | $300/a)</option>
                                    </select>
                                    <select
                                        value={cycleValue}
                                        onChange={(e) => setCycleValue(e.target.value as 'MONTHLY' | 'ANNUAL')}
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
                                        <option value="MONTHLY">Mensual (30 días)</option>
                                        <option value="ANNUAL">Anual (365 días)</option>
                                    </select>
                                    <button
                                        onClick={handleSavePlan}
                                        disabled={actionLoading || (planValue === tenant.plan && cycleValue === (tenant.billingCycle || 'MONTHLY'))}
                                        style={{
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: actionLoading || (planValue === tenant.plan && cycleValue === (tenant.billingCycle || 'MONTHLY')) ? '#94a3b8' : COLORS.primary,
                                            color: '#fff',
                                            cursor: actionLoading || (planValue === tenant.plan && cycleValue === (tenant.billingCycle || 'MONTHLY')) ? 'not-allowed' : 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            minHeight: 44,
                                        }}
                                    >
                                        {actionLoading ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingPlan(false);
                                            setPlanValue(tenant.plan);
                                            setCycleValue(tenant.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY');
                                        }}
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
                                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#1e293b' }}>{tenant.plan}</span>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: 4,
                                        background: tenant.billingCycle === 'ANNUAL' ? '#ede9fe' : '#e0f2fe',
                                        color: tenant.billingCycle === 'ANNUAL' ? '#6d28d9' : '#0369a1',
                                        fontWeight: 600,
                                    }}>
                                        {tenant.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensual'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setEditingPlan(true);
                                            setPlanValue(tenant.plan);
                                            setCycleValue(tenant.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY');
                                        }}
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

                {/* Control Total de Suscripción, Fechas, Descuentos y Avisos */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 4, height: 16, borderRadius: 2, background: '#6366f1', flexShrink: 0 }} />
                            Control de Suscripción y Políticas
                        </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Próximo Vencimiento</span>
                            <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                                {tenant.nextPaymentDue
                                    ? new Date(tenant.nextPaymentDue).toLocaleDateString('es-AR')
                                    : 'Sin fecha'}
                            </span>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Descuento / Tarifa</span>
                            <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: tenant.discountPercent ? '#059669' : '#1e293b', marginTop: 2 }}>
                                {tenant.customPriceCents
                                    ? `$${(tenant.customPriceCents / 100).toFixed(2)} USD`
                                    : tenant.discountPercent
                                        ? `${tenant.discountPercent}% OFF`
                                        : 'Estándar'}
                            </span>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Aviso al Tenant</span>
                            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: tenant.systemNotice ? '#d97706' : '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tenant.systemNotice ? `[${tenant.noticeLevel || 'INFO'}] Activo` : 'Sin aviso'}
                            </span>
                        </div>
                    </div>

                    {tenant.systemNotice && (
                        <div style={{
                            padding: '0.6rem 0.8rem',
                            borderRadius: 8,
                            marginBottom: '1rem',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: tenant.noticeLevel === 'DANGER' ? '#fef2f2' : tenant.noticeLevel === 'WARNING' ? '#fffbeb' : '#eff6ff',
                            border: `1px solid ${tenant.noticeLevel === 'DANGER' ? '#fecaca' : tenant.noticeLevel === 'WARNING' ? '#fde68a' : '#bfdbfe'}`,
                            color: tenant.noticeLevel === 'DANGER' ? '#991b1b' : tenant.noticeLevel === 'WARNING' ? '#92400e' : '#1e40af',
                        }}>
                            <span><strong>Aviso visible:</strong> {tenant.systemNotice}</span>
                            <button
                                onClick={() => handleSaveNotice(true)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                }}
                            >
                                Quitar
                            </button>
                        </div>
                    )}

                    {/* Botones de acción administrativa */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setShowExtendModal(true)}
                            style={{
                                flex: 1,
                                minWidth: 120,
                                padding: '0.45rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #c7d2fe',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            + Extender Días
                        </button>
                        <button
                            onClick={() => setShowDatesModal(true)}
                            style={{
                                flex: 1,
                                minWidth: 120,
                                padding: '0.45rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            Fijar Fechas
                        </button>
                        <button
                            onClick={() => setShowDiscountModal(true)}
                            style={{
                                flex: 1,
                                minWidth: 120,
                                padding: '0.45rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #a7f3d0',
                                background: '#ecfdf5',
                                color: '#065f46',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            Descuento / Precio
                        </button>
                        <button
                            onClick={() => setShowNoticeModal(true)}
                            style={{
                                flex: 1,
                                minWidth: 120,
                                padding: '0.45rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #fde68a',
                                background: '#fffbeb',
                                color: '#92400e',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}
                        >
                            Emitir Aviso
                        </button>
                    </div>
                </div>

                {/* Telemetría y Consumo Real vs Límites del Plan */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 4, height: 16, borderRadius: 2, background: '#10b981', flexShrink: 0 }} />
                            Telemetría de Consumo vs Límites
                        </h3>
                        <button
                            onClick={() => fetchMetrics(true)}
                            disabled={metricsLoading}
                            style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#475569',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            <RefreshIcon size={13} color="#475569" spin={metricsLoading} />
                            {metricsLoading ? 'Cargando...' : 'Refrescar'}
                        </button>
                    </div>

                    {(() => {
                        const planKey = (tenant.plan || 'basic').toLowerCase();
                        const normalized = planKey === 'basico' ? 'basic' : planKey;
                        const limits = PLAN_CANONICAL_LIMITS[normalized] || PLAN_CANONICAL_LIMITS.basic;
                        const uCount = metrics?.usersCount ?? 0;
                        const pCount = metrics?.productsCount ?? 0;
                        const bCount = metrics?.branchesCount ?? 0;

                        const uPct = Math.min(100, Math.round((uCount / limits.maxUsers) * 100));
                        const pPct = Math.min(100, Math.round((pCount / limits.maxProducts) * 100));
                        const bPct = Math.min(100, Math.round((bCount / limits.maxBranches) * 100));

                        const isHighUsage = uPct >= 80 || pPct >= 80 || bPct >= 80;

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {isHighUsage && (
                                    <div style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: 8,
                                        background: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        color: '#92400e',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}>
                                        <ZapIcon size={14} color="#b45309" />
                                        <span>Oportunidad de Upselling: El cliente está alcanzando el límite de su plan.</span>
                                    </div>
                                )}

                                {/* Usuarios */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#475569' }}>Usuarios Activos</span>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                            {uCount} / {limits.maxUsers >= 900 ? 'Ilimitados' : limits.maxUsers}
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ width: `${uPct}%`, height: '100%', background: uPct > 85 ? '#ef4444' : uPct > 60 ? '#f59e0b' : '#10b981', borderRadius: 999, transition: 'width 0.3s' }} />
                                    </div>
                                </div>

                                {/* Productos */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#475569' }}>Productos Registrados</span>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                            {pCount} / {limits.maxProducts >= 90000 ? 'Ilimitados' : limits.maxProducts}
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ width: `${pPct}%`, height: '100%', background: pPct > 85 ? '#ef4444' : pPct > 60 ? '#f59e0b' : '#10b981', borderRadius: 999, transition: 'width 0.3s' }} />
                                    </div>
                                </div>

                                {/* Sucursales */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: '#475569' }}>Sucursales</span>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                            {bCount} / {limits.maxBranches}
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ width: `${bPct}%`, height: '100%', background: bPct > 85 ? '#ef4444' : bPct > 60 ? '#f59e0b' : '#10b981', borderRadius: 999, transition: 'width 0.3s' }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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

            {/* QR Code for APK Connection */}
            {tenant.url && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                        Conexion APK
                    </h3>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`allmarket://connect?server=${encodeURIComponent(tenant.url)}`)}&color=1e293b&bgcolor=ffffff`}
                                alt={`QR para conectar ${tenant.slug}`}
                                style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid #e2e8f0' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                                Escaneá con la APK para conectar
                            </p>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                                Mostrale este QR al usuario para que conecte su celular con este negocio. La APK se descarga desde el link de abajo.
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <a
                                    href={tenant.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: 6,
                                        border: '1px solid #e2e8f0',
                                        background: '#fff',
                                        color: COLORS.info,
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        minHeight: 36,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    Abrir panel web
                                </a>
                                <a
                                    href={`${tenant.url}/apk/app.apk`}
                                    download
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: 6,
                                        border: '1px solid #a7f3d0',
                                        background: '#ecfdf5',
                                        color: '#065f46',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        minHeight: 36,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    Descargar APK
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payments */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 4, height: 16, borderRadius: 2, background: '#059669', flexShrink: 0 }} />
                        Pagos
                    </h3>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {tenant.nextPaymentDue && (
                            <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>
                                Proximo vencimiento: <strong>{new Date(tenant.nextPaymentDue).toLocaleDateString('es-AR')}</strong>
                            </span>
                        )}
                        <button
                            onClick={() => { setPaymentError(null); setLastPaymentCode(null); setShowPaymentModal(true); }}
                            style={{
                                padding: '0.4rem 0.9rem',
                                borderRadius: 8,
                                border: 'none',
                                background: COLORS.primary,
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                minHeight: 44,
                                transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.primaryHover; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.primary; }}
                        >
                            + Registrar Pago
                        </button>
                    </div>
                </div>

                {tenant.payments.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin pagos registrados</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Fecha</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Monto</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Metodo</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Codigo</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Vencimiento</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Estado</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', textAlign: 'right' }}>Accion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenant.payments.map((p) => {
                                    const pst = PAYMENT_STATUS_STYLES[p.status] || PAYMENT_STATUS_STYLES.PENDING;
                                    return (
                                        <tr key={p.id} className="tdetail-row" style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s ease' }}>
                                            <td style={{ padding: '0.5rem 0', color: '#475569' }}>
                                                {new Date(p.createdAt).toLocaleDateString('es-AR')}
                                            </td>
                                            <td style={{ color: '#1e293b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                                ${(p.amountCents / 100).toFixed(2)} {p.currency || 'USD'}
                                            </td>
                                            <td style={{ color: '#475569' }}>
                                                {PAYMENT_PROVIDER_LABELS[p.provider || ''] || p.provider || '---'}
                                            </td>
                                            <td style={{ color: '#475569' }}>
                                                {p.paymentCode ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', fontWeight: 600 }}>{p.paymentCode}</span>
                                                        <button
                                                            onClick={() => copyPaymentCode(p.paymentCode!)}
                                                            title="Copiar codigo"
                                                            style={{
                                                                padding: '2px 8px',
                                                                borderRadius: 4,
                                                                border: '1px solid #e2e8f0',
                                                                background: '#fff',
                                                                color: COLORS.info,
                                                                cursor: 'pointer',
                                                                fontSize: '0.7rem',
                                                                minHeight: 28,
                                                            }}
                                                        >
                                                            Copiar
                                                        </button>
                                                    </span>
                                                ) : '---'}
                                            </td>
                                            <td style={{ color: '#475569' }}>
                                                {p.dueDate ? new Date(p.dueDate).toLocaleDateString('es-AR') : '---'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '2px 10px',
                                                    borderRadius: 999,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    background: pst.bg,
                                                    color: pst.text,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: pst.dot, flexShrink: 0 }} />
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {p.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleConfirmPayment(p.id)}
                                                        disabled={confirmingPaymentId === p.id}
                                                        style={{
                                                            padding: '0.35rem 0.8rem',
                                                            borderRadius: 6,
                                                            border: '1px solid #a7f3d0',
                                                            background: '#ecfdf5',
                                                            color: '#065f46',
                                                            cursor: confirmingPaymentId === p.id ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            minHeight: 36,
                                                        }}
                                                    >
                                                        {confirmingPaymentId === p.id ? 'Confirmando...' : 'Confirmar pago'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Respaldos On-Demand de Base de Datos ────────────────────────── */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 4, height: 16, borderRadius: 2, background: '#3b82f6', flexShrink: 0 }} />
                            Respaldos de Base de Datos (Backups)
                        </h3>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                            {backups.length} archivo(s)
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={fetchBackups}
                            disabled={backupsLoading}
                            style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#475569',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            {backupsLoading ? 'Cargando...' : 'Refrescar'}
                        </button>
                        <button
                            onClick={handleCreateBackup}
                            disabled={creatingBackup || tenant.status === 'DELETED'}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: 8,
                                border: 'none',
                                background: creatingBackup ? '#94a3b8' : '#2563eb',
                                color: '#fff',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: creatingBackup ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <DatabaseIcon size={14} color="#fff" />
                            {creatingBackup ? 'Generando dump...' : 'Crear Respaldo Ahora'}
                        </button>
                    </div>
                </div>

                {backups.length > 0 && (
                    <div style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Buscar en respaldos por nombre de archivo..."
                            value={backupFilter}
                            onChange={(e) => setBackupFilter(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: 360,
                                padding: '0.4rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                fontSize: '0.78rem',
                                background: '#f8fafc',
                                outline: 'none',
                                color: '#1e293b',
                            }}
                        />
                        {backupFilter && (
                            <button
                                onClick={() => setBackupFilter('')}
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#64748b',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Limpiar
                            </button>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto' }}>
                            Mostrando {filteredBackups.length} de {backups.length}
                        </span>
                    </div>
                )}

                {backups.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '1rem 0' }}>
                        No hay respaldos registrados para este tenant. Creá uno con el botón superior.
                    </p>
                ) : filteredBackups.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '1rem 0' }}>
                        No se encontraron respaldos coincidentes con "{backupFilter}".
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '0.6rem 0', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Archivo</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Tamaño</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Fecha de Creación</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBackups.map((b) => (
                                    <tr key={b.filename} className="tdetail-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.6rem 0', fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}>
                                            {b.filename}
                                        </td>
                                        <td style={{ color: '#475569' }}>
                                            {b.sizeBytes >= 1048576
                                                ? `${(b.sizeBytes / 1048576).toFixed(2)} MB`
                                                : `${(b.sizeBytes / 1024).toFixed(1)} KB`}
                                        </td>
                                        <td style={{ color: '#475569' }}>
                                            {new Date(b.createdAt).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                background: '#ecfdf5',
                                                color: '#065f46',
                                            }}>
                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                                                Disponible
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Historial de Auditoría y Trazabilidad ────────────────────────── */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 4, height: 16, borderRadius: 2, background: '#8b5cf6', flexShrink: 0 }} />
                            Historial de Auditoría y Trazabilidad
                        </h3>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                            {auditLogs.length} evento(s)
                        </span>
                    </div>
                    <button
                        onClick={() => fetchAudit()}
                        disabled={auditLoading}
                        style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#475569',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {auditLoading ? 'Cargando...' : 'Refrescar'}
                    </button>
                </div>

                {auditLogs.length > 0 && (
                    <div style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Buscar en auditoría por operador, acción o detalle..."
                            value={auditFilter}
                            onChange={(e) => setAuditFilter(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: 360,
                                padding: '0.4rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                fontSize: '0.78rem',
                                background: '#f8fafc',
                                outline: 'none',
                                color: '#1e293b',
                            }}
                        />
                        {auditFilter && (
                            <button
                                onClick={() => setAuditFilter('')}
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#64748b',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Limpiar
                            </button>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto' }}>
                            Mostrando {filteredAuditLogs.length} de {auditLogs.length}
                        </span>
                    </div>
                )}

                {auditLogs.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '1rem 0' }}>
                        Sin eventos de auditoría registrados para este tenant.
                    </p>
                ) : filteredAuditLogs.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '1rem 0' }}>
                        No se encontraron eventos coincidentes con "{auditFilter}".
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '0.6rem 0', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Fecha</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Operador</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Acción</th>
                                    <th style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Detalles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAuditLogs.map((log) => {
                                    const actionColors: Record<string, { bg: string; text: string }> = {
                                        SUBSCRIPTION_EXTENDED: { bg: '#ecfdf5', text: '#065f46' },
                                        SUBSCRIPTION_DATES_SET: { bg: '#eff6ff', text: '#1e40af' },
                                        NOTICE_UPDATED: { bg: '#fffbeb', text: '#92400e' },
                                        TENANT_UPDATED: { bg: '#f5f3ff', text: '#6d28d9' },
                                        SUPPORT_IMPERSONATION: { bg: '#fef3c7', text: '#b45309' },
                                        BACKUP_CREATED: { bg: '#dbeafe', text: '#1e40af' },
                                        PAYMENT_CONFIRMED: { bg: '#dcfce7', text: '#166534' },
                                    };
                                    const ac = actionColors[log.action] || { bg: '#f1f5f9', text: '#475569' };

                                    return (
                                        <tr key={log.id} className="tdetail-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.6rem 0', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                {new Date(log.createdAt).toLocaleString('es-AR')}
                                            </td>
                                            <td style={{ color: '#1e293b', fontWeight: 600 }}>
                                                {log.actor}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    background: ac.bg,
                                                    color: ac.text,
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ color: '#475569', fontSize: '0.75rem', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.details ? JSON.stringify(log.details) : '---'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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

            {/* ── Modal: Registrar pago ──────────────────────────────────── */}
            {showPaymentModal && (
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
                    onClick={(e) => { if (e.target === e.currentTarget && !paymentSubmitting) setShowPaymentModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 440,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Registrar Pago
                        </h2>

                        {paymentError && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 8,
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontSize: '0.85rem',
                                marginBottom: '1rem',
                                border: '1px solid #fecaca',
                            }}>
                                {paymentError}
                            </div>
                        )}

                        {lastPaymentCode && (
                            <div style={{
                                padding: '1rem',
                                borderRadius: 8,
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065f46' }}>
                                        Codigo de pago generado
                                    </div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '1rem', color: '#065f46' }}>
                                        {lastPaymentCode}
                                    </div>
                                </div>
                                <button
                                    onClick={() => copyPaymentCode(lastPaymentCode)}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: 8,
                                        border: '1px solid #059669',
                                        background: '#fff',
                                        color: COLORS.primary,
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        minHeight: 44,
                                    }}
                                >
                                    Copiar
                                </button>
                            </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Ciclo de Facturación *
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const defaultAmount = tenant.plan === 'pro' ? '20' : tenant.plan === 'premium' ? '30' : '10';
                                        setPaymentForm((f) => ({ ...f, billingCycle: 'MONTHLY', amount: f.amount ? f.amount : defaultAmount }));
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: 8,
                                        border: paymentForm.billingCycle === 'MONTHLY' ? `2px solid ${COLORS.primary}` : '1px solid #e2e8f0',
                                        background: paymentForm.billingCycle === 'MONTHLY' ? '#ecfdf5' : '#fff',
                                        color: paymentForm.billingCycle === 'MONTHLY' ? COLORS.primary : '#475569',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Mensual (1 mes)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const defaultAmount = tenant.plan === 'pro' ? '200' : tenant.plan === 'premium' ? '300' : '100';
                                        setPaymentForm((f) => ({ ...f, billingCycle: 'ANNUAL', amount: f.amount ? f.amount : defaultAmount }));
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: 8,
                                        border: paymentForm.billingCycle === 'ANNUAL' ? `2px solid ${COLORS.primary}` : '1px solid #e2e8f0',
                                        background: paymentForm.billingCycle === 'ANNUAL' ? '#ecfdf5' : '#fff',
                                        color: paymentForm.billingCycle === 'ANNUAL' ? COLORS.primary : '#475569',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Anual (1 año)
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Monto (USD) *
                            </label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                                placeholder="99.99"
                                disabled={paymentSubmitting}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
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
                                Metodo
                            </label>
                            <select
                                value={paymentForm.provider}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, provider: e.target.value }))}
                                disabled={paymentSubmitting}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                    background: '#fff',
                                }}
                            >
                                {PAYMENT_PROVIDERS.map((p) => (
                                    <option key={p} value={p}>{PAYMENT_PROVIDER_LABELS[p]}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Referencia (opcional)
                            </label>
                            <input
                                type="text"
                                maxLength={200}
                                value={paymentForm.externalId}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, externalId: e.target.value }))}
                                placeholder="Ref Zelle, TXID, etc."
                                disabled={paymentSubmitting}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
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
                                Vencimiento (opcional)
                            </label>
                            <input
                                type="date"
                                value={paymentForm.dueDate}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, dueDate: e.target.value }))}
                                disabled={paymentSubmitting}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                disabled={paymentSubmitting}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: paymentSubmitting ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    minHeight: 44,
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegisterPayment}
                                disabled={paymentSubmitting || !paymentForm.amount}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: paymentSubmitting || !paymentForm.amount ? '#94a3b8' : COLORS.primary,
                                    color: '#fff',
                                    cursor: paymentSubmitting || !paymentForm.amount ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    minHeight: 44,
                                }}
                            >
                                {paymentSubmitting ? 'Registrando...' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Extender Suscripción (+ Días) ──────────────────────── */}
            {showExtendModal && (
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
                    onClick={(e) => { if (e.target === e.currentTarget && !extendSubmitting) setShowExtendModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 440,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Extender Suscripción (Días de Cortesía)
                        </h2>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                            Suma días al vencimiento actual de <strong>{tenant.slug}</strong>. Si el tenant estaba suspendido, se reactivará automáticamente.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                Cantidad de Días a Añadir
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                {['3', '7', '15', '30'].map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setExtendDays(d)}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: 8,
                                            border: extendDays === d ? `2px solid ${COLORS.primary}` : '1px solid #e2e8f0',
                                            background: extendDays === d ? '#ecfdf5' : '#fff',
                                            color: extendDays === d ? COLORS.primary : '#475569',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        +{d} d
                                    </button>
                                ))}
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="365"
                                value={extendDays}
                                onChange={(e) => setExtendDays(e.target.value)}
                                placeholder="Días personalizados"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Motivo / Observación
                            </label>
                            <input
                                type="text"
                                value={extendReason}
                                onChange={(e) => setExtendReason(e.target.value)}
                                placeholder="Ej: Cortesía por migración, prórroga de pago..."
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowExtendModal(false)}
                                disabled={extendSubmitting}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExtendSubscription}
                                disabled={extendSubmitting || !extendDays}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: extendSubmitting || !extendDays ? '#94a3b8' : COLORS.primary,
                                    color: '#fff',
                                    cursor: extendSubmitting || !extendDays ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                }}
                            >
                                {extendSubmitting ? 'Extendiendo...' : 'Confirmar Extensión'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Fijar Fechas de Suscripción ───────────────────────── */}
            {showDatesModal && (
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
                    onClick={(e) => { if (e.target === e.currentTarget && !datesSubmitting) setShowDatesModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 440,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Fijar Fechas de Suscripción
                        </h2>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                            Establece el inicio o la fecha exacta de próximo vencimiento sin alterar los pagos históricos.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Fecha de Inicio de Suscripción
                            </label>
                            <input
                                type="date"
                                value={datesStartedAt}
                                onChange={(e) => setDatesStartedAt(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Próximo Vencimiento *
                            </label>
                            <input
                                type="date"
                                value={datesNextDue}
                                onChange={(e) => setDatesNextDue(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Motivo del Cambio
                            </label>
                            <input
                                type="text"
                                value={datesReason}
                                onChange={(e) => setDatesReason(e.target.value)}
                                placeholder="Ej: Alineación con fecha de cobro comercial..."
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowDatesModal(false)}
                                disabled={datesSubmitting}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSetDates}
                                disabled={datesSubmitting || !datesNextDue}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: datesSubmitting || !datesNextDue ? '#94a3b8' : COLORS.primary,
                                    color: '#fff',
                                    cursor: datesSubmitting || !datesNextDue ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                }}
                            >
                                {datesSubmitting ? 'Guardando...' : 'Guardar Fechas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Descuentos y Tarifas Especiales ─────────────────────── */}
            {showDiscountModal && (
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
                    onClick={(e) => { if (e.target === e.currentTarget && !discountSubmitting) setShowDiscountModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 440,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Descuento y Tarifa Personalizada
                        </h2>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                            Aplica condiciones comerciales especiales a <strong>{tenant.slug}</strong>. Afecta el monto a cobrar en la sección de facturación del cliente.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Descuento Porcentual (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercentVal}
                                onChange={(e) => setDiscountPercentVal(e.target.value)}
                                placeholder="0"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Si se ingresa 20, el cliente pagará un 20% menos del precio de lista.
                            </span>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Precio Personalizado Mensual en USD (opcional)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customPriceVal}
                                onChange={(e) => setCustomPriceVal(e.target.value)}
                                placeholder="Vacío = usar precio del plan"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Sobrescribe la tarifa mensual base. Deja en blanco para usar la tarifa estándar del plan.
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                disabled={discountSubmitting}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#475569',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveDiscount}
                                disabled={discountSubmitting}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: discountSubmitting ? '#94a3b8' : COLORS.primary,
                                    color: '#fff',
                                    cursor: discountSubmitting ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                }}
                            >
                                {discountSubmitting ? 'Guardando...' : 'Aplicar Tarifa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Aviso Administrativo al Tenant ─────────────────────── */}
            {showNoticeModal && (
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
                    onClick={(e) => { if (e.target === e.currentTarget && !noticeSubmitting) setShowNoticeModal(false); }}
                >
                    <div style={{
                        background: '#fff',
                        borderRadius: 12,
                        padding: '2rem',
                        width: '100%',
                        maxWidth: 460,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease',
                    }}>
                        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                            Aviso Administrativo al Tenant
                        </h2>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                            Este comunicado se sincroniza en caliente y se muestra como banner en la barra superior del sistema del tenant.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Nivel de Alerta
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[
                                    { level: 'INFO', label: 'Informativo (Azul)', bg: '#eff6ff', color: '#1e40af' },
                                    { level: 'WARNING', label: 'Advertencia (Amarillo)', bg: '#fffbeb', color: '#92400e' },
                                    { level: 'DANGER', label: 'Urgente / Corte (Rojo)', bg: '#fef2f2', color: '#991b1b' },
                                ].map((l) => (
                                    <button
                                        key={l.level}
                                        type="button"
                                        onClick={() => setNoticeLevel(l.level as any)}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: 8,
                                            border: noticeLevel === l.level ? `2px solid ${l.color}` : '1px solid #e2e8f0',
                                            background: noticeLevel === l.level ? l.bg : '#fff',
                                            color: l.color,
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {l.level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Mensaje del Aviso
                            </label>
                            <textarea
                                rows={3}
                                value={noticeText}
                                onChange={(e) => setNoticeText(e.target.value)}
                                placeholder="Ej: Recordamos que el próximo domingo habrá una ventana de mantenimiento de 02:00 a 04:00 AM."
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => handleSaveNotice(true)}
                                disabled={noticeSubmitting || !tenant.systemNotice}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 8,
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                    color: '#991b1b',
                                    cursor: !tenant.systemNotice ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                }}
                            >
                                Borrar Aviso
                            </button>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setShowNoticeModal(false)}
                                    disabled={noticeSubmitting}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: '#fff',
                                        color: '#475569',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleSaveNotice(false)}
                                    disabled={noticeSubmitting || !noticeText.trim()}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: noticeSubmitting || !noticeText.trim() ? '#94a3b8' : COLORS.primary,
                                        color: '#fff',
                                        cursor: noticeSubmitting || !noticeText.trim() ? 'not-allowed' : 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                    }}
                                >
                                    {noticeSubmitting ? 'Sincronizando...' : 'Publicar Aviso'}
                                </button>
                            </div>
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
