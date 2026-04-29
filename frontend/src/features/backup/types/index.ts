export interface Backup {
    id: string;
    name: string;
    size: number;
    createdAt: string;
    status: 'completed' | 'failed' | 'in_progress';
    url?: string;
}