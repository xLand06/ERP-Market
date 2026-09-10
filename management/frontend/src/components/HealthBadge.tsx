interface HealthBadgeProps {
    healthy: boolean | null;
    size?: 'sm' | 'md';
}

export default function HealthBadge({ healthy, size = 'md' }: HealthBadgeProps) {
    const color = healthy === true ? '#4caf50' : healthy === false ? '#f44336' : '#ff9800';
    const label = healthy === true ? 'Saludable' : healthy === false ? 'Caído' : 'Sin datos';
    const dotSize = size === 'sm' ? 8 : 12;

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
            }} />
            <span style={{ fontSize: size === 'sm' ? '0.75rem' : '0.85rem', color: '#555' }}>
                {label}
            </span>
        </span>
    );
}
