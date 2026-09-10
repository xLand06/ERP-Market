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
                setError(data.error || 'Credenciales inválidas');
                return;
            }

            localStorage.setItem('mgmt_token', data.token);
            onLogin(data.token, data.user);
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <form onSubmit={handleSubmit} style={{
                background: '#fff',
                padding: '2.5rem',
                borderRadius: 12,
                width: 360,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
                <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
                    ERP Market
                </h1>
                <p style={{ margin: '0 0 1.5rem', color: '#888', fontSize: '0.9rem' }}>
                    Panel de Gestión
                </p>

                {error && (
                    <div style={{
                        background: '#fff3f3',
                        color: '#d32f2f',
                        padding: '0.75rem',
                        borderRadius: 6,
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4, color: '#555' }}>
                        Usuario
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: 6,
                            fontSize: '0.9rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 4, color: '#555' }}>
                        Contraseña
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: 6,
                            fontSize: '0.9rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#1a1a2e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
            </form>
        </div>
    );
}
