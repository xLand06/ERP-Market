interface HealthBadgeProps {
    healthy: boolean | null;
    size?: 'sm' | 'md';
}

const PALETTES = {
    ok: { color: '#059669', bg: '#ecfdf5', label: 'OK' },
    down: { color: '#dc2626', bg: '#fef2f2', label: 'Down' },
    nodata: { color: '#d97706', bg: '#fffbeb', label: 'No data' },
};

export default function HealthBadge({ healthy, size = 'md' }: HealthBadgeProps) {
    const palette = healthy === true ? PALETTES.ok : healthy === false ? PALETTES.down : PALETTES.nodata;
    const dotSize = size === 'sm' ? 6 : 8;

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: size === 'sm' ? '2px 10px' : '3px 12px',
            borderRadius: 999,
            background: palette.bg,
            color: palette.color,
            fontSize: size === 'sm' ? '0.7rem' : '0.78rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
        }}>
            <span style={{
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: palette.color,
                flexShrink: 0,
            }} />
            {palette.label}
        </span>
    );
}