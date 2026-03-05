import { api } from '../../../lib/api';

export interface LoginPayload { email: string; password: string; }
export interface AuthResponse { token: string; user: { id: string; name: string; email: string; role: string } }

export const login = (payload: LoginPayload) => api.post<AuthResponse>('/auth/login', payload).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);
