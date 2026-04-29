export type ReportType = 'sales' | 'inventory' | 'products' | 'purchases' | 'audit';

export interface ReportFilters {
    type?: ReportType;
    branchId?: string;
    from?: string;
    to?: string;
    format?: 'pdf' | 'excel' | 'csv';
}

export interface Report {
    id: string;
    name: string;
    type: ReportType;
    generatedAt: string;
    url?: string;
}