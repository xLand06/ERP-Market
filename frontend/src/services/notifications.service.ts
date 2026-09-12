// =============================================================================
// NOTIFICATIONS SERVICE — Notificaciones calculadas en vivo
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export type NotificationType = 'fiado' | 'stock';

export interface AppNotification {
    key: string;
    type: NotificationType;
    title: string;
    message: string;
    createdAt: string;
}

export interface NotificationsResponse {
    items: AppNotification[];
}

export const notificationsApi = {
    /**
     * Obtiene las notificaciones calculadas en vivo (fiados + stock bajo).
     */
    getNotifications: async (): Promise<NotificationsResponse> => {
        const { data } = await api.get<ApiResponse<NotificationsResponse>>('/notifications');
        return data.data;
    },
};

export default notificationsApi;