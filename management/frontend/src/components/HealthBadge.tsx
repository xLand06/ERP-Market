interface HealthBadgeProps {
    healthy: boolean | null;
    size?: 'sm' | 'md';
}

export default function HealthBadge({ healthy, size = 'md' }: HealthBadgeProps) {
    const color = healthy === true ? '#059669' : healthy === false ? '#dc2626' : '#d97706';
    const label = healthy === true ? 'OK' : healthy === false ? 'Down' : 'No data';
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
            <span style={{
                fontSize: size === 'sm' ? '0.75rem' : '0.85rem',
                color: '#64748b',
            }}>
                {label}
            </span>
        </span>
    );
}
