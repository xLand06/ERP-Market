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
        borderRadius: 8,
        fontSize: '0.9rem',
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        minHeight: 44,
        background: '#fff',
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #064e3b 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '1.5rem',
        }}>
            <form onSubmit={handleSubmit} style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(12px)',
                padding: '2.5rem',
                borderRadius: 14,
                width: 380,
                maxWidth: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.5)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
                        flexShrink: 0,
                    }}>
                        AC
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                        ALLCODE
                    </h1>
                </div>
                <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                    ALL MARKET · Panel de Gestion
                </p>

                {error && (
                    <div style={{
                        background: '#fef2f2',
                        color: '#991b1b',
                        padding: '0.75rem 1rem',
                        borderRadius: 8,
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
                        borderRadius: 8,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: loading ? 'wait' : 'pointer',
                        minHeight: 44,
                        boxShadow: loading ? 'none' : '0 4px 14px rgba(5,150,105,0.3)',
                        transition: 'background 0.15s ease, box-shadow 0.15s ease',
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
