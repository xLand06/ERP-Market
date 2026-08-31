import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/services';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { LoginPayload, FormErrors } from '../types';

export function useLoginForm() {
    const [form, setForm] = useState<Pick<LoginPayload, 'username' | 'password'>>({ 
        username: '', 
        password: '' 
    });
    const [errors, setErrors] = useState<FormErrors>({});

    const validate = useCallback((): boolean => {
        const newErrors: FormErrors = {};
        
        if (!form.username) {
            newErrors.username = 'El usuario es requerido';
        }
        
        if (!form.password) {
            newErrors.password = 'La contraseña es requerida';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [form.username, form.password]);

    const updateField = useCallback((field: 'username' | 'password', value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    }, [errors]);

    return { form, errors, validate, updateField, setErrors, setForm };
}

export function useLogin() {
    const navigate = useNavigate();
    const setAuth = useAuthStore(s => s.setAuth);
    const [loading, setLoading] = useState(false);

    const login = useCallback(async (payload: LoginPayload) => {
        setLoading(true);
        try {
            const { token, user } = await authApi.login(payload);
            setAuth(token, user);
            toast.success(`Bienvenido, ${user.nombre}!`);
            navigate('/dashboard');
            return { success: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error de autenticación';
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    }, [navigate, setAuth]);

    const parseError = useCallback((error: Error): FormErrors => {
        const msg = error.message;
        if (msg.includes('usuario') || msg.includes('Usuario') || msg.includes('username')) {
            return { username: msg };
        } else if (msg.includes('contrase') || msg.includes('password')) {
            return { password: msg };
        }
        return { general: msg };
    }, []);

    return { login, loading, parseError };
}