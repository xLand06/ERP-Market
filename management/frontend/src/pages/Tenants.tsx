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
    createdAt: string;
    healthChecks: { apiHealthy: boolean; dbHealthy: boolean; containerUp: boolean }[];
}

export default function Tenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        const token = localStorage.getItem('mgmt_token');
        fetch('/api/tenants', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setTenants(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter
        ? tenants.filter((t) => t.status === filter)
        : tenants;

    if (loading) {
        return <p style={{ color: '#888' }}>Cargando tenants...</p>;
    }

    return (
        <div>
            {/* Filtros */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                {['', 'ACTIVE', 'SUSPENDED', 'DELETED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: 4,
                            border: filter === s ? '1px solid #1a1a2e' : '1px solid #ddd',
                            background: filter === s ? '#1a1a2e' : '#fff',
                            color: filter === s ? '#fff' : '#555',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                        }}
                    >
                        {s || 'Todos'}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 0' }}>Slug</th>
                            <th>Dominio</th>
                            <th>Estado</th>
                            <th>Plan</th>
                            <th>Salud</th>
                            <th>Creado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((t) => {
                            const lastHealth = t.healthChecks?.[0];
                            const healthy = lastHealth
                                ? lastHealth.apiHealthy && lastHealth.dbHealthy && lastHealth.containerUp
                                : null;

                            return (
                                <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '0.75rem 0' }}>
                                        <Link
                                            to={`/tenants/${t.slug}`}
                                            style={{ color: '#1a73e8', textDecoration: 'none', fontWeight: 600 }}
                                        >
                                            {t.slug}
                                        </Link>
                                    </td>
                                    <td>{t.domain}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.75rem',
                                            background: t.status === 'ACTIVE' ? '#e8f5e9' : t.status === 'SUSPENDED' ? '#fff3e0' : '#fce4ec',
                                            color: t.status === 'ACTIVE' ? '#2e7d32' : t.status === 'SUSPENDED' ? '#e65100' : '#c62828',
                                        }}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td>{t.plan}</td>
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
    );
}
