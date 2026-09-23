// =============================================================================
// ANIMATED MESH BACKGROUND — Fondo animado con gradientes fluidos.
// Crear un archivo separado para reusar en otros lugares.
// =============================================================================

export function AnimatedMeshBg() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0a0f1a]">
            {/* Mesh gradient orbs */}
            <div className="absolute inset-0">
                {/* Orb 1 — emerald, se mueve lento */}
                <div
                    className="absolute w-[800px] h-[800px] rounded-full opacity-30 blur-[120px]"
                    style={{
                        background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
                        top: '-20%',
                        left: '-10%',
                        animation: 'meshMove1 20s ease-in-out infinite',
                    }}
                />
                {/* Orb 2 — indigo */}
                <div
                    className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[100px]"
                    style={{
                        background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
                        bottom: '-15%',
                        right: '-5%',
                        animation: 'meshMove2 25s ease-in-out infinite',
                    }}
                />
                {/* Orb 3 — teal, centro */}
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[80px]"
                    style={{
                        background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)',
                        top: '40%',
                        left: '30%',
                        animation: 'meshMove3 18s ease-in-out infinite',
                    }}
                />
                {/* Orb 4 — emerald sutil arriba-derecha */}
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[90px]"
                    style={{
                        background: 'radial-gradient(circle, #34d399 0%, transparent 70%)',
                        top: '10%',
                        right: '20%',
                        animation: 'meshMove4 22s ease-in-out infinite',
                    }}
                />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Noise texture */}
            <div
                className="absolute inset-0 opacity-[0.015]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Vignette */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
                }}
            />
        </div>
    );
}
