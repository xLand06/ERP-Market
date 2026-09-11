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
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderLeft: `4px solid ${color}`,
        }}>
            <div style={{
                fontSize: '0.72rem',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
            }}>
                {title}
            </div>
            <div style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
            }}>
                {value}
            </div>
            {subtitle && (
                <div style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    marginTop: '0.35rem',
                }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}