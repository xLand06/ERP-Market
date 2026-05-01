export interface Merma {
    id: string;
    branchId: string;
    productId: string;
    quantity: number;
    reason: MermaReason;
    description?: string;
    createdAt: string;
    updatedAt: string;
    syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
    product?: {
        id: string;
        name: string;
        cost?: number;
        baseUnit: string;
    };
    branch?: {
        id: string;
        name: string;
    };
    createdBy?: {
        id: string;
        nombre: string;
        apellido?: string;
    };
}

export type MermaReason = 'DAMAGED' | 'EXPIRED' | 'SOBRANTE' | 'BAD_CONDITION' | 'OTHER';

export interface MermaFilters {
    branchId?: string;
    productId?: string;
    reason?: MermaReason;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

export interface MermaSummary {
    daily: {
        totalQuantity: number;
        totalRecords: number;
    };
    weekly: {
        totalQuantity: number;
        totalRecords: number;
    };
    monthly: {
        totalQuantity: number;
        totalRecords: number;
    };
}

export interface MermaReportItem {
    productId: string;
    productName: string;
    cost?: number;
    mermaQuantity: number;
    soldQuantity: number;
    totalQuantity: number;
    actualPercent: number;
    expectedPercent?: number;
    hasAlert: boolean;
    alertMessage?: string;
}

export interface CreateMermaInput {
    productId: string;
    quantity: number;
    reason: MermaReason;
    description?: string;
}

export const MERMA_REASONS: { value: MermaReason; label: string; color: string }[] = [
    { value: 'DAMAGED', label: 'Dañado', color: 'red' },
    { value: 'EXPIRED', label: 'Caducado', color: 'orange' },
    { value: 'SOBRANTE', label: 'Sobrante', color: 'yellow' },
    { value: 'BAD_CONDITION', label: 'Mal Estado', color: 'amber' },
    { value: 'OTHER', label: 'Otro', color: 'gray' },
];

export const getReasonLabel = (reason: MermaReason): string => {
    return MERMA_REASONS.find(r => r.value === reason)?.label ?? reason;
};

export const getReasonColor = (reason: MermaReason): string => {
    return MERMA_REASONS.find(r => r.value === reason)?.color ?? 'gray';
};