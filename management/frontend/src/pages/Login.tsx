import { useState, FormEvent } from 'react';

interface LoginProps {
    onLogin: (token: string, user: { username: string; role: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Credenciales invalidas');
                return;
            }

            localStorage.setItem('mgmt_token', data.token);
            onLogin(data.token, data.user);
        } catch {
            setError('Error de conexion');
        } finally {
            setLoading(false);
        }
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.65rem 0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        fontSize: '0.9rem',
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border-color 0.15s ease',
        minHeight: 44,
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
            <form onSubmit={handleSubmit} style={{
                background: '#fff',
                padding: '2.5rem',
                borderRadius: 12,
                width: 380,
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}>
                <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                    ALLCODE
                </h1>
                <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                    ALL MARKET · Panel de Gestión
                </p>

                {error && (
                    <div style={{
                        background: '#fef2f2',
                        color: '#991b1b',
                        padding: '0.75rem 1rem',
                        borderRadius: 6,
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        border: '1px solid #fecaca',
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        marginBottom: 6,
                        color: '#475569',
                        fontWeight: 600,
                    }}>
                        Usuario
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#059669'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        marginBottom: 6,
                        color: '#475569',
                        fontWeight: 600,
                    }}>
                        Contrasena
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#059669'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: loading ? '#94a3b8' : '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: loading ? 'wait' : 'pointer',
                        minHeight: 44,
                        transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#047857'; }}
                    onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#059669'; }}
                >
                    {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
            </form>
        </div>
    );
}
