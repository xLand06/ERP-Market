import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Tipos ────────────────────────────────────────────────────────────────── */

interface TrialRegistration {
    id: string;
    businessName: string;
    ownerName: string;
    taxId?: string | null;
    phone: string;
    email: string;
    plan: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    tenantSlug: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

interface AccessModalData {
    businessName: string;
    ownerName: string;
    slug: string;
    phone: string;
    email: string;
    password: string;
    url: string;
    installerUrl: string;
}

export default function Registrations() {
    const navigate = useNavigate();
    const [registrations, setRegistrations] = useState<TrialRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

    // Estado del modal de alta
    const [selectedReg, setSelectedReg] = useState<TrialRegistration | null>(null);
    const [modalSlug, setModalSlug] = useState('');
    const [modalPlan, setModalPlan] = useState('pro');
    const [modalPassword, setModalPassword] = useState('admin123');
    const [isApproving, setIsApproving] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Estado del modal de envío de accesos
    const [accessData, setAccessData] = useState<AccessModalData | null>(null);

    // Toast
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    };

    const token = localStorage.getItem('mgmt_token');

    // Cargar solicitudes
    const fetchRegistrations = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/trials', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Error al cargar solicitudes');
            const data = await res.json();
            setRegistrations(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    // Abrir modal de alta
    const handleOpenApproveModal = (reg: TrialRegistration) => {
        setSelectedReg(reg);
        // Generar slug sugerido
        const suggested = reg.businessName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 26);

        setModalSlug(suggested || 'bodega');
        setModalPlan(reg.plan || 'pro');
        setModalPassword('admin123');
        setModalError(null);
    };

    // Ejecutar aprobación y creación de tenant
    const handleConfirmApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReg || !token) return;

        setIsApproving(true);
        setModalError(null);

        try {
            const res = await fetch(`/api/trials/${selectedReg.id}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug: modalSlug.trim().toLowerCase(),
                    plan: modalPlan,
                    adminPassword: modalPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al dar de alta el tenant');

            const finalSlug = data.tenant?.slug || modalSlug;
            showToast(`✅ Tenant '${finalSlug}' dado de alta.`);

            // Abrir automáticamente el modal de despacho de accesos
            setAccessData({
                businessName: selectedReg.businessName,
                ownerName: selectedReg.ownerName,
                slug: finalSlug,
                phone: selectedReg.phone,
                email: selectedReg.email,
                password: data.adminPassword || modalPassword,
                url: `https://${finalSlug}.89.167.46.144.sslip.io`,
                installerUrl: 'https://allmarket.allcode.site/download/allmarket-desktop.exe',
            });

            setSelectedReg(null);
            fetchRegistrations();
        } catch (err: any) {
            setModalError(err.message);
        } finally {
            setIsApproving(false);
        }
    };

    // Abrir modal de accesos para un registro ya aprobado
    const handleOpenAccessModal = (reg: TrialRegistration) => {
        let pass = 'admin123';
        if (reg.notes && reg.notes.includes('Clave:')) {
            pass = reg.notes.replace(/.*Clave:\s*/, '').trim();
        }
        const finalSlug = reg.tenantSlug || 'app';
        setAccessData({
            businessName: reg.businessName,
            ownerName: reg.ownerName,
            slug: finalSlug,
            phone: reg.phone,
            email: reg.email,
            password: pass,
            url: `https://${finalSlug}.89.167.46.144.sslip.io`,
            installerUrl: 'https://allmarket.allcode.site/download/allmarket-desktop.exe',
        });
    };

    // Descartar solicitud
    const handleReject = async (id: string) => {
        if (!token || !window.confirm('¿Seguro que querés descartar esta solicitud?')) return;
        try {
            const res = await fetch(`/api/trials/${id}/reject`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Error al descartar');
            showToast('Solicitud marcada como descartada');
            fetchRegistrations();
        } catch (err: any) {
            alert(err.message);
        }
    };

    // Filtrar solicitudes
    const filtered = registrations.filter((r) => {
        const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchesSearch =
            r.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.taxId && r.taxId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.phone.includes(searchTerm);
        return matchesStatus && matchesSearch;
    });

    const pendingCount = registrations.filter((r) => r.status === 'PENDING').length;
    const approvedCount = registrations.filter((r) => r.status === 'APPROVED').length;

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto', color: '#1e293b' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: 20,
                    right: 20,
                    zIndex: 9999,
                    background: '#0f172a',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: 10,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                }}>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                            Solicitudes de Registro (Trial)
                        </h1>
                        {pendingCount > 0 && (
                            <span style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: '1px solid #fde68a',
                            }}>
                                {pendingCount} {pendingCount === 1 ? 'Pendiente' : 'Pendientes'}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                        Registros generados desde la landing page para prueba gratis de 14 días.
                    </p>
                </div>

                <button
                    onClick={fetchRegistrations}
                    style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#334155',
                    }}
                >
                    🔄 Refrescar
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
            }}>
                <div style={{ background: '#fff', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Solicitudes</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{registrations.length}</div>
                </div>

                <div style={{ background: '#fff', padding: '1rem', borderRadius: 12, border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>Pendientes de Alta</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: 4 }}>{pendingCount}</div>
                </div>

                <div style={{ background: '#fff', padding: '1rem', borderRadius: 12, border: '1px solid #a7f3d0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>Tenants Dados de Alta</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', marginTop: 4 }}>{approvedCount}</div>
                </div>
            </div>

            {/* Toolbar / Filtros */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                background: '#fff',
                padding: '0.75rem 1rem',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
            }}>
                <input
                    type="text"
                    placeholder="Buscar por negocio, dueño, email o teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        minWidth: 240,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none',
                    }}
                />

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
                        const labels = { ALL: 'Todos', PENDING: 'Pendientes', APPROVED: 'Aprobados', REJECTED: 'Descartados' };
                        const isActive = statusFilter === st;
                        return (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: isActive ? '1px solid #059669' : '1px solid #e2e8f0',
                                    background: isActive ? '#ecfdf5' : '#fff',
                                    color: isActive ? '#059669' : '#64748b',
                                }}
                            >
                                {labels[st]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabla de Solicitudes */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Cargando solicitudes...</div>
            ) : error ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '1rem', borderRadius: 8 }}>
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b' }}>
                    No se encontraron solicitudes de registro.
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    <th style={{ padding: '12px 16px' }}>Fecha</th>
                                    <th style={{ padding: '12px 16px' }}>Comercio</th>
                                    <th style={{ padding: '12px 16px' }}>Dueño / Responsable</th>
                                    <th style={{ padding: '12px 16px' }}>Contacto</th>
                                    <th style={{ padding: '12px 16px' }}>Plan</th>
                                    <th style={{ padding: '12px 16px' }}>Estado</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => {
                                    // Limpiar teléfono para WhatsApp
                                    const cleanPhone = r.phone.replace(/[^0-9]/g, '');
                                    const waNumber = cleanPhone.startsWith('0') ? `58${cleanPhone.slice(1)}` : cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`;

                                    const dateStr = new Date(r.createdAt).toLocaleString('es-VE', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    });

                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                {dateStr}
                                            </td>

                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                                                {r.businessName}
                                            </td>

                                            <td style={{ padding: '12px 16px', color: '#334155' }}>
                                                <div style={{ fontWeight: 600 }}>{r.ownerName}</div>
                                                {r.taxId && (
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                                                        Doc: {r.taxId}
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    <a
                                                        href={`https://wa.me/${waNumber}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#059669', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                    >
                                                        <span>📱 {r.phone}</span>
                                                    </a>
                                                    <a
                                                        href={`mailto:${r.email}`}
                                                        style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}
                                                    >
                                                        ✉️ {r.email}
                                                    </a>
                                                </div>
                                            </td>

                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    background: r.plan === 'premium' ? '#f3e8ff' : r.plan === 'pro' ? '#ecfdf5' : '#e0f2fe',
                                                    color: r.plan === 'premium' ? '#7e22ce' : r.plan === 'pro' ? '#047857' : '#0369a1',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {r.plan}
                                                </span>
                                            </td>

                                            <td style={{ padding: '12px 16px' }}>
                                                {r.status === 'PENDING' && (
                                                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#b45309' }}>
                                                        ● Pendiente
                                                    </span>
                                                )}
                                                {r.status === 'APPROVED' && (
                                                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#15803d' }}>
                                                        ✓ Aprobado
                                                    </span>
                                                )}
                                                {r.status === 'REJECTED' && (
                                                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', color: '#94a3b8' }}>
                                                        Descartado
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {r.status === 'PENDING' && (
                                                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => handleOpenApproveModal(r)}
                                                            style={{
                                                                background: '#059669',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: 8,
                                                                padding: '6px 12px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                            }}
                                                        >
                                                            🚀 Dar de Alta
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(r.id)}
                                                            style={{
                                                                background: '#fff',
                                                                color: '#94a3b8',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: 8,
                                                                padding: '6px 10px',
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            Descartar
                                                        </button>
                                                    </div>
                                                )}

                                                {r.status === 'APPROVED' && r.tenantSlug && (
                                                    <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => handleOpenAccessModal(r)}
                                                            style={{
                                                                background: '#ecfdf5',
                                                                border: '1px solid #a7f3d0',
                                                                color: '#047857',
                                                                borderRadius: 8,
                                                                padding: '6px 10px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                            }}
                                                            title="Enviar credenciales por WhatsApp o Correo"
                                                        >
                                                            <span>🔑 Accesos</span>
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/tenants/${r.tenantSlug}`)}
                                                            style={{
                                                                background: '#f8fafc',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: 8,
                                                                padding: '6px 10px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                color: '#334155',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            Ver ({r.tenantSlug}) →
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Alta Manual */}
            {selectedReg && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9000,
                    background: 'rgba(15,23,42,0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: 16,
                        maxWidth: 480,
                        width: '100%',
                        padding: '1.5rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                                Dar de Alta Tenant (Trial)
                            </h3>
                            <button
                                onClick={() => setSelectedReg(null)}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                            Vas a provisionar el stack Docker y base de datos aislada para <strong>{selectedReg.businessName}</strong>.
                        </p>

                        {modalError && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleConfirmApprove} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                    Slug Identificador (Subdominio)
                                </label>
                                <input
                                    type="text"
                                    required
                                    pattern="[a-z0-9-]{3,32}"
                                    value={modalSlug}
                                    onChange={(e) => setModalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        fontFamily: 'monospace',
                                    }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: 2 }}>
                                    URL resultante: {modalSlug}.89.167.46.144.sslip.io
                                </span>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                    Plan
                                </label>
                                <select
                                    value={modalPlan}
                                    onChange={(e) => setModalPlan(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <option value="basico">Básico ($10)</option>
                                    <option value="pro">Pro ($20) — Recomendado Trial</option>
                                    <option value="premium">Premium ($30)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                    Email Administrador
                                </label>
                                <input
                                    type="email"
                                    disabled
                                    value={selectedReg.email}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        color: '#64748b',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                    Contraseña Inicial de Acceso
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={modalPassword}
                                    onChange={(e) => setModalPassword(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        fontFamily: 'monospace',
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedReg(null)}
                                    disabled={isApproving}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 8,
                                        border: '1px solid #cbd5e1',
                                        background: '#fff',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isApproving}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: isApproving ? '#94a3b8' : '#059669',
                                        color: '#fff',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: isApproving ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    {isApproving ? 'Desplegando...' : 'Confirmar y Desplegar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Despacho de Accesos (WhatsApp / Correo / Copiar) */}
            {accessData && (() => {
                const cleanPhone = accessData.phone.replace(/[^0-9]/g, '');
                const waNumber = cleanPhone.startsWith('0') ? `58${cleanPhone.slice(1)}` : cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`;

                const messageText = `¡Hola ${accessData.ownerName}! 🎉 Te damos la bienvenida a *ALLMARKET*.

Tu servidor y cuenta de prueba gratis ya están activos:

📍 *Servidor Web:* ${accessData.url}
👤 *Usuario:* admin
🔑 *Contraseña:* ${accessData.password}

💻 *Descarga de App Desktop (Modo Offline incluido):*
${accessData.installerUrl}

Cualquier duda o para configurar tus balanzas e impresoras, escribinos directamente por acá.`;

                const handleCopy = () => {
                    navigator.clipboard.writeText(messageText);
                    showToast('📋 Accesos copiados al portapapeles');
                };

                return (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9500,
                        background: 'rgba(15,23,42,0.65)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                    }}>
                        <div style={{
                            background: '#fff',
                            borderRadius: 16,
                            maxWidth: 540,
                            width: '100%',
                            padding: '1.75rem',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.4rem' }}>🚀</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                                            Accesos: {accessData.businessName}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                            Enviá las credenciales de acceso al comercio en 1 clic
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAccessData(null)}
                                    style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Resumen de Credenciales */}
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 12,
                                padding: '1rem',
                                marginBottom: '1.25rem',
                                fontSize: '0.85rem',
                                lineHeight: 1.6,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>URL del Tenant:</span>
                                    <a href={accessData.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace' }}>
                                        {accessData.url} ↗
                                    </a>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Usuario Admin:</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>admin</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Contraseña:</span>
                                    <span style={{ color: '#047857', fontWeight: 700, fontFamily: 'monospace', background: '#ecfdf5', padding: '1px 6px', borderRadius: 4 }}>
                                        {accessData.password}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Contacto:</span>
                                    <span style={{ color: '#0f172a' }}>{accessData.ownerName} ({accessData.phone})</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>Instalador Desktop:</span>
                                    <a href={accessData.installerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'underline', fontSize: '0.75rem' }}>
                                        allmarket-desktop.exe
                                    </a>
                                </div>
                            </div>

                            {/* Botones de Despacho 1 Clic */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                <a
                                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        background: '#25D366',
                                        color: '#fff',
                                        padding: '12px 16px',
                                        borderRadius: 10,
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        boxShadow: '0 4px 12px rgba(37,211,102,0.25)',
                                        textAlign: 'center',
                                    }}
                                >
                                    <span>📱 Enviar Accesos por WhatsApp (+{waNumber})</span>
                                </a>

                                <div style={{ display: 'flex', gap: '0.65rem' }}>
                                    <a
                                        href={`mailto:${accessData.email}?subject=${encodeURIComponent('Tus accesos de prueba gratis a ALLMARKET')}&body=${encodeURIComponent(messageText)}`}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            background: '#f1f5f9',
                                            color: '#334155',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            textDecoration: 'none',
                                            border: '1px solid #cbd5e1',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <span>✉️ Enviar por Email</span>
                                    </a>

                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            background: '#fff',
                                            color: '#0f172a',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            border: '1px solid #cbd5e1',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>📋 Copiar Accesos</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setAccessData(null)}
                                    style={{
                                        marginTop: '0.5rem',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#94a3b8',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                >
                                    Cerrar ventana
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
