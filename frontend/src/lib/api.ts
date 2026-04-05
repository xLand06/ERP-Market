/// <reference types="vite/client" />
import axios from 'axios';
import { useAuthStore } from '../features/auth/store/authStore';

// Detectar entorno: Si existe window.erpApi.isElectron, estamos en Desktop Offline
const isElectron = typeof window !== 'undefined' && 'erpApi' in window;
const defaultBaseUrl = isElectron 
    ? 'http://127.0.0.1:3001/api'  // Modo Desktop Offline (Express local)
    : 'http://localhost:3000/api'; // Fallback Cloud (Nube)

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);
