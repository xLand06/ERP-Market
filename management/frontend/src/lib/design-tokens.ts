/**
 * Shared design tokens for ALL MARKET management panel.
 * Import these instead of redefining color/style constants per page.
 */

export const COLORS = {
    primary: '#059669',
    primaryLight: '#d1fae5',
    primaryDark: '#047857',
    primaryHover: '#047857',
    navy: '#1a1a2e',
    navyLight: '#16213e',
    danger: '#dc2626',
    dangerHover: '#b91c1c',
    warning: '#d97706',
    info: '#2563eb',
    success: '#059669',
    dark: '#1a1a2e',
    muted: '#64748b',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    bg: '#f8fafc',
    white: '#fff',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
} as const;

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    ACTIVE: { bg: '#d1fae5', text: '#059669', label: 'Activo', dot: '#059669' },
    PROVISIONING: { bg: '#dbeafe', text: '#2563eb', label: 'Provisionando', dot: '#2563eb' },
    SUSPENDED: { bg: '#fef3c7', text: '#d97706', label: 'Suspendido', dot: '#d97706' },
    ERROR: { bg: '#fee2e2', text: '#dc2626', label: 'Error', dot: '#dc2626' },
    DELETED: { bg: '#f1f5f9', text: '#94a3b8', label: 'Eliminado', dot: '#94a3b8' },
};

export const PAYMENT_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
    PENDING: { bg: '#fffbeb', text: '#92400e', dot: '#d97706' },
    OVERDUE: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    FAILED: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626' },
    REFUNDED: { bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6' },
    CANCELLED: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
};

/** Common card style used across pages */
export const CARD_STYLE: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

/** Common section heading style */
export const SECTION_HEADING_STYLE: React.CSSProperties = {
    margin: '0 0 1rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
};

/** Compact filter button base style */
export const FILTER_BTN_BASE: React.CSSProperties = {
    padding: '0.4rem 0.9rem',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    minHeight: 44,
    transition: 'all 0.15s ease',
};
