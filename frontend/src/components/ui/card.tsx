import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'rounded-2xl border border-slate-200/90 bg-white shadow-2xs text-slate-900 transition-all duration-300',
                'dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100',
                'dark:shadow-[0_0_15px_rgba(15,23,42,0.6)] dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.2)] dark:hover:border-indigo-500/40',
                className
            )}
            {...props}
        />
    )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col space-y-1 p-5 pb-3 border-b border-slate-100 dark:border-slate-800/60', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-sm font-bold leading-none text-slate-600 dark:text-slate-300', className)} {...props} />
    )
);
CardTitle.displayName = 'CardTitle';

const CardValue = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-2xl font-black tabular-nums text-slate-950 dark:text-slate-100 mt-1', className)} {...props} />
    )
);
CardValue.displayName = 'CardValue';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-5 pt-3 text-slate-800 dark:text-slate-200', className)} {...props} />
    )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center p-5 pt-0 border-t border-slate-100 dark:border-slate-800/60', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardValue, CardContent, CardFooter };
