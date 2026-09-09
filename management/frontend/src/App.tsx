import { useState, useEffect } from 'react';

interface HealthStatus {
    status: string;
    timestamp: string;
    database: string;
}

export default function App() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/health')
            .then((res) => res.json())
            .then(setHealth)
            .catch((err) => setError(err.message));
    }, []);

    return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1>ERP Market — Panel de Gestión</h1>
            <h2>Estado del Sistema</h2>
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            {health ? (
                <ul>
                    <li>Estado: <strong>{health.status}</strong></li>
                    <li>Base de datos: <strong>{health.database}</strong></li>
                    <li>Timestamp: {health.timestamp}</li>
                </ul>
            ) : (
                <p>Cargando...</p>
            )}
        </div>
    );
}
