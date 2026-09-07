// =============================================================================
// SKELETON — Componente de skeleton shimmer reutilizable
//
// Patrón shadcn/ui. Usa las clases de shimmer definidas en global.css
// (skeleton-shimmer) con guardia de prefers-reduced-motion.
// =============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('skeleton rounded-lg bg-slate-200 dark:bg-slate-800', className)}
            aria-hidden="true"
            {...props}
        />
    );
}
Skeleton.displayName = 'Skeleton';

export { Skeleton };
