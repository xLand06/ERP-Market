import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge';

interface Tenant {
    id: string;
    slug: string;
    domain: string;
    url: string;
    status: string;
    plan: string;
    adminEmail: string | null;
    createdAt: string;
    healthChecks: { apiHealthy: boolean; dbHealthy: boolean; containerUp: boolean }[];
}

interface CreateTenantResponse {
    slug: string;
    domain: string;
    adminEmail: string | null;
    adminPasswordPlain: string;
    dbPassword: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: '#ecfdf5', text: '#065f46' },
    SUSPENDED: { bg: '#fffbeb', text: '#92400e' },
    DELETED: { bg: '#fef2f2', text: '#991b1b' },
};

export default function Tenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createdTenant, setCreatedTenant] = useState<CreateTenantResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formSlug, setFormSlug] = useState('');
    const [formDomain, setFormDomain] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formPlan, setFormPlan] = useState('free');

    const fetchTenants = () => {
        const token = localStorage.getItem('mgmt_token');
        fetch('/api/tenants', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setTenants(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const resetForm = () => {
        setFormSlug('');
        setFormDomain('');
        setFormEmail('');
        setFormPassword('');
        setFormPlan('free');
        setError(null);
    };

    const handleCreate = async () => {
        setError(null);

        // Validación client-side
        if (!formSlug || !/^[a-z0-9-]+$/.test(formSlug)) {
            setError('El slug solo puede contener minúsculas, números y guiones');
            return;
        }
        if (!formDomain) {
            setError('El dominio es requerido');
            return;
        }
        if (formPassword && formPassword.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setCreating(true);
        try {
            const token = localStorage.getItem('mgmt_token');
            const body: Record<string, string> = {
                slug: formSlug,
                domain: formDomain,
            };
            if (formEmail) body.adminEmail = formEmail;
            if (formPassword) body.adminPassword = formPassword;
            if (formPlan) body.plan = formPlan;

            const res = await fetch('/api/tenants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Error al crear tenant');
                return;
            }

            const data: CreateTenantResponse = await res.json();
            setCreatedTenant(data);
            resetForm();
            fetchTenants();
        } catch {
            setError('Error de conexión al crear tenant');
        } finally {
            setCreating(false);
        }
    };

    const filtered = filter
        ? tenants.filter((t) => t.status === filter)
        : tenants;

    if (loading) {
        return (
            <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{
                            width: 80,
                            height: 32,
                            background: '#e5e7eb',
                            borderRadius: 4,
                        }} />
                    ))}
                </div>
                <div style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{
                            height: 48,
                            background: i % 2 === 0 ? '#f9fafb' : '#fff',
                            borderBottom: '1px solid #f3f4f6',
                        }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Toolbar: filtros + botón crear */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['', 'ACTIVE', 'SUSPENDED', 'DELETED'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: 6,
                                border: filter === s ? '1px solid #1a1a2e' : '1px solid #d1d5db',
                                background: filter === s ? '#1a1a2e' : '#fff',
                                color: filter === s ? '#fff' : '#6b7280',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                minHeight: 44,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {s || 'Todos'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => { resetForm(); setShowCreateModal(true); }}
                    style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 6,
                        border: 'none',
                        background: '#059669',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        minHeight: 44,
                        transition: 'background 0.15s ease',
                    }}
                >
                    + Nuevo Tenant
                </button>
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 0' }}>Slug</th>
                                <th>Dominio</th>
                                <th>Estado</th>
                                <th>Plan</th>
                                <th>Salud</th>
                                <th>Creado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t, idx) => {
                                const lastHealth = t.healthChecks?.[0];
                                const healthy = lastHealth
                                    ? lastHealth.apiHealthy && lastHealth.dbHealthy && lastHealth.containerUp
                                    : null;
                                const colors = STATUS_COLORS[t.status] || STATUS_COLORS.ACTIVE;

                                return (
                                    <tr
                                        key={t.id}
                                        style={{
                                            borderBottom: '1px solid #f3f4f6',
                                            background: idx % 2 === 0 ? '#fff' : '#fafafa',
                                        }}
                                    >
                                        <td style={{ padding: '0.75rem 0' }}>
                                            <Link
                                                to={`/tenants/${t.slug}`}
                                                style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                                            >
                                                {t.slug}
                                            </Link>
                                        </td>
                                        <td>{t.domain}</td>
                                        <td>
                                            <span style={{
                                                padding: '2px 10px',
                                                borderRadius: 12,
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: colors.bg,
                                                color: colors.text,
                                            }}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td style={{ textTransform: 'capitalize' }}>{t.plan}</td>
                                        <td><HealthBadge healthy={healthy} size="sm" /></td>
                                        <td style={{ color: '#888', fontSize: '0.8rem' }}>
                                            {new Date(t.createdAt).toLocaleDateString('es-AR')}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                        No se encontraron tenants
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Crear Tenant */}
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
                    }}>
                        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
                            Crear Nuevo Tenant
                        </h2>

                        {error && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: 6,
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontSize: '0.85rem',
                                marginBottom: '1rem',
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
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
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                Solo minúsculas, números y guiones
                            </span>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                Dominio *
                            </label>
                            <input
                                type="text"
                                value={formDomain}
                                onChange={(e) => setFormDomain(e.target.value)}
                                placeholder="mi-tenant.erpmarket.com"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
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
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                Contraseña (opcional)
                            </label>
                            <input
                                type="password"
                                value={formPassword}
                                onChange={(e) => setFormPassword(e.target.value)}
                                placeholder="Se genera automáticamente si se deja vacío"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                Plan
                            </label>
                            <select
                                value={formPlan}
                                onChange={(e) => setFormPlan(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
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

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                    background: '#fff',
                                    color: '#374151',
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
                                disabled={creating || !formSlug || !formDomain}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: creating || !formSlug || !formDomain ? '#9ca3af' : '#059669',
                                    color: '#fff',
                                    cursor: creating || !formSlug || !formDomain ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    minHeight: 44,
                                }}
                            >
                                {creating ? 'Creando...' : 'Crear Tenant'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Credenciales generadas */}
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
                        maxWidth: 480,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
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
                                fontSize: '1.5rem',
                            }}>
                                ✓
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                                Tenant Creado
                            </h2>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#888' }}>
                                {createdTenant.slug} · {createdTenant.domain}
                            </p>
                        </div>

                        <div style={{
                            background: '#f9fafb',
                            borderRadius: 8,
                            padding: '1rem',
                            marginBottom: '1.5rem',
                        }}>
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                                Credenciales de administrador
                            </p>
                            {createdTenant.adminEmail && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>Email: </span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{createdTenant.adminEmail}</span>
                                </div>
                            )}
                            <div>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>Contraseña: </span>
                                <code style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    background: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    border: '1px solid #e5e7eb',
                                }}>
                                    {createdTenant.adminPasswordPlain}
                                </code>
                            </div>
                        </div>

                        <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 6,
                            background: '#fffbeb',
                            color: '#92400e',
                            fontSize: '0.8rem',
                            marginBottom: '1.5rem',
                        }}>
                            ⚠ Guardá estas credenciales. No se van a mostrar de nuevo.
                        </div>

                        <button
                            onClick={() => setCreatedTenant(null)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: 6,
                                border: 'none',
                                background: '#1a1a2e',
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
        </div>
    );
}
