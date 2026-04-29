export interface Branch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isActive: boolean;
}

export interface Group {
    id: string;
    name: string;
    description?: string;
}

export interface SubGroup {
    id: string;
    name: string;
    description?: string;
    groupId: string;
}

export interface SystemConfig {
    rates: Record<string, number>;
    iva: number;
    autoOpenTime?: string;
}

export interface MaintenanceConfig {
    autoBackup: boolean;
    backupInterval: number;
}