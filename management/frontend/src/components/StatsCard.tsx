interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
}

export default function StatsCard({ title, value, subtitle, color = '#1a1a2e' }: StatsCardProps) {
    return (
        <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: `4px solid ${color}`,
        }}>
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                {title}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>
                {value}
            </div>
            {subtitle && (
                <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.25rem' }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}
