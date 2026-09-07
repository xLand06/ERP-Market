import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// ─── Column & props API ────────────────────────────────────────────────────

export interface Column<T> {
    /** Stable identifier for the column. */
    key: string;
    /** Header label. Rendered inside `<th>` on desktop, as the card field label on mobile. */
    header: React.ReactNode;
    /** Renders the cell value for a row. Single source of truth for table AND card view. */
    cell: (row: T) => React.ReactNode;
    /** Hide the column (`th` + `td`) below the given breakpoint. */
    hideBelow?: 'md' | 'lg';
    /** When true, the column is rendered in the card view (< md). The first `showCard` column becomes the card title. */
    showCard?: boolean;
    /** Applied to the `<td>` (alignment, width, padding overrides). */
    className?: string;
    /** Applied to the `<th>`. */
    headerClassName?: string;
}

export interface DataTablePagination {
    page: number;
    totalPages: number;
    total: number;
    onPageChange?: (page: number) => void;
}

export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    isLoading?: boolean;
    /** Number of skeleton rows/cards shown while loading. Default 6. */
    loadingRows?: number;
    empty?: { icon?: React.ReactNode; title: string; description?: string };
    /** Renders per-row actions: last table column (text-right) and a bottom row on each card. */
    actions?: (row: T) => React.ReactNode;
    onRowClick?: (row: T) => void;
    /** Extra classes applied to each row (`<tr>` on desktop, card wrapper on mobile). */
    rowClassName?: (row: T) => string;
    /** Min width of the `<table>` on desktop. Default min-w-[640px]. */
    minWidth?: string;
    pagination?: DataTablePagination;
    /** Applied to the root wrapper. */
    className?: string;
}

// ─── Primitives (re-exported for progressive migration) ────────────────────

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return <table className={cn('w-full erp-table', className)} {...props} />;
}

function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn(className)} {...props} />;
}

function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />;
}

function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return <th className={cn(className)} {...props} />;
}

function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return <td className={cn(className)} {...props} />;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hiddenClass(hideBelow?: 'md' | 'lg'): string {
    if (hideBelow === 'md') return 'hidden md:table-cell';
    if (hideBelow === 'lg') return 'hidden lg:table-cell';
    return '';
}

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
    return (
        <div className="max-w-[240px] mx-auto flex flex-col items-center">
            {icon && (
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                    {icon}
                </div>
            )}
            <p className="text-base font-black text-slate-900 tracking-tight">{title}</p>
            {description && (
                <p className="text-xs text-slate-400 font-medium mt-1 text-center">{description}</p>
            )}
        </div>
    );
}

// ─── DataTable ──────────────────────────────────────────────────────────────

export function DataTable<T>({
    columns,
    rows,
    rowKey,
    isLoading = false,
    loadingRows = 6,
    empty,
    actions,
    onRowClick,
    rowClassName,
    minWidth = 'min-w-[640px]',
    pagination,
    className,
}: DataTableProps<T>) {
    const isMobile = useMediaQuery('(max-width: 767px)');

    const cardColumns = columns.filter(col => col.showCard);
    const titleColumn = cardColumns[0];
    const cardDataColumns = cardColumns.slice(1);
    const colSpan = columns.length + (actions ? 1 : 0);

    const renderTable = () => (
        <div className="overflow-x-auto">
            <Table className={minWidth}>
                <THead>
                    <tr>
                        {columns.map(col => (
                            <Th
                                key={col.key}
                                className={cn(col.headerClassName, hiddenClass(col.hideBelow))}
                            >
                                {col.header}
                            </Th>
                        ))}
                        {actions && <Th className="text-right pr-6">Acciones</Th>}
                    </tr>
                </THead>
                <TBody>
                    {isLoading ? (
                        Array.from({ length: loadingRows }).map((_, i) => (
                            <tr key={`skeleton-row-${i}`}>
                                {columns.map(col => (
                                    <Td
                                        key={col.key}
                                        className={cn('py-3', hiddenClass(col.hideBelow))}
                                    >
                                        <Skeleton className="h-5 w-full" />
                                    </Td>
                                ))}
                                {actions && (
                                    <Td className="py-3 pr-6">
                                        <Skeleton className="h-9 w-9 ml-auto" />
                                    </Td>
                                )}
                            </tr>
                        ))
                    ) : rows.length === 0 && empty ? (
                        <tr>
                            <Td colSpan={colSpan} className="p-20 text-center">
                                <EmptyState {...empty} />
                            </Td>
                        </tr>
                    ) : (
                        rows.map(row => (
                            <tr
                                key={rowKey(row)}
                                className={cn(
                                    'group transition-all',
                                    onRowClick ? 'cursor-pointer' : 'cursor-default',
                                    rowClassName?.(row)
                                )}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                            >
                                {columns.map(col => (
                                    <Td
                                        key={col.key}
                                        className={cn(col.className, hiddenClass(col.hideBelow))}
                                    >
                                        {col.cell(row)}
                                    </Td>
                                ))}
                                {actions && (
                                    <Td className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            {actions(row)}
                                        </div>
                                    </Td>
                                )}
                            </tr>
                        ))
                    )}
                </TBody>
            </Table>
        </div>
    );

    const renderCards = () => (
        <ul className="divide-y divide-slate-100">
            {isLoading ? (
                Array.from({ length: loadingRows }).map((_, i) => (
                    <li key={`skeleton-card-${i}`} className="p-4">
                        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </li>
                ))
            ) : rows.length === 0 && empty ? (
                <li className="p-12">
                    <EmptyState {...empty} />
                </li>
            ) : (
                rows.map(row => (
                    <li key={rowKey(row)}>
                        <div
                            className={cn(
                                'p-4 flex flex-col gap-3',
                                onRowClick && 'cursor-pointer active:bg-slate-100',
                                rowClassName?.(row)
                            )}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                        >
                            {titleColumn ? (
                                <div className="min-w-0">{titleColumn.cell(row)}</div>
                            ) : (
                                <p className="text-sm font-black text-slate-900 tracking-tight">
                                    {rowKey(row)}
                                </p>
                            )}

                            {cardDataColumns.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    {cardDataColumns.map(col => (
                                        <div key={col.key} className="flex flex-col gap-0.5 min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {col.header}
                                            </span>
                                            <div className="text-sm text-slate-700 min-w-0">
                                                {col.cell(row)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {actions && (
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                    {actions(row)}
                                </div>
                            )}
                        </div>
                    </li>
                ))
            )}
        </ul>
    );

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {isMobile ? renderCards() : renderTable()}

            {pagination && pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white mt-auto">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                        Página {pagination.page} de {pagination.totalPages}{' '}
                        <span className="mx-2 opacity-30">|</span> {pagination.total} registros
                        totales
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl border-slate-200 hover:bg-slate-50"
                            disabled={pagination.page <= 1}
                            onClick={() => pagination.onPageChange?.(pagination.page - 1)}
                        >
                            <ChevronLeft className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                        <div className="flex items-center px-4 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 tabular-nums">
                            {pagination.page}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl border-slate-200 hover:bg-slate-50"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => pagination.onPageChange?.(pagination.page + 1)}
                        >
                            <ChevronRight className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export { Table, THead, TBody, Th, Td };