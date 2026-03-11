import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border transition-colors',
    {
        variants: {
            variant: {
                default:     'bg-slate-100 text-slate-700 border-slate-200',
                primary:     'bg-emerald-50 text-emerald-700 border-emerald-200',
                secondary:   'bg-slate-100 text-slate-600 border-transparent',
                destructive: 'bg-red-50 text-red-700 border-red-200',
                warning:     'bg-amber-50 text-amber-700 border-amber-200',
                info:        'bg-blue-50 text-blue-700 border-blue-200',
                success:     'bg-emerald-50 text-emerald-700 border-emerald-200',
                outline:     'border-current bg-transparent',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
