// =============================================================================
// LOGIN PAGE — Página de autenticación funcional
// =============================================================================

import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { authApi } from '@/services';
import toast from 'react-hot-toast';

interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
}

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);

    const [form, setForm] = useState({ email: '', password: '' });

    const validate = (): boolean => {
        const newErrors: FormErrors = {};
        
        if (!form.email) {
            newErrors.email = 'El email es requerido';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = 'Email inválido';
        }
        
        if (!form.password) {
            newErrors.password = 'La contraseña es requerida';
        } else if (form.password.length < 6) {
            newErrors.password = 'Mínimo 6 caracteres';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(form.password) && form.password.length >= 8) {
            newErrors.password = 'Debe tener mayúscula, número y carácter especial';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        setLoading(true);
        setErrors({});
        
        try {
            const { token, user } = await authApi.login(form);
            setAuth(token, user);
            toast.success(`Bienvenido, ${user.name}!`);
            navigate('/dashboard');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error de autenticación';
            if (msg.includes('email') || msg.includes('Email')) {
                setErrors({ email: msg });
            } else if (msg.includes('contrase') || msg.includes('password')) {
                setErrors({ password: msg });
            } else {
                setErrors({ general: msg });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                        <span className="text-xl font-black text-white">EM</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">ERP-Market</h1>
                    <p className="text-slate-400 text-sm mt-1">Sistema de gestión para supermercados</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                    <h2 className="text-base font-bold text-white mb-5">Iniciar sesión</h2>
                    
                    {errors.general && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm" role="alert">
                            {errors.general}
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="email" className="text-xs font-semibold text-slate-300 mb-1.5 block">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    aria-invalid={!!errors.email}
                                    placeholder="tu@email.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className={`pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 ${errors.email ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.email && (
                                <p id="email-error" className="text-red-400 text-xs mt-1" role="alert">
                                    {errors.email}
                                </p>
                            )}
                        </div>
                        
                        <div>
                            <label htmlFor="password" className="text-xs font-semibold text-slate-300 mb-1.5 block">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                                <Input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    aria-invalid={!!errors.password}
                                    placeholder="Tu contraseña"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className={`pl-9 pr-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 ${errors.password ? 'border-red-500' : ''}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" className="text-red-400 text-xs mt-1" role="alert">
                                    {errors.password}
                                </p>
                            )}
                        </div>
                        
                        <Button 
                            type="submit" 
                            className="w-full mt-2" 
                            size="lg" 
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Iniciando...
                                </>
                            ) : (
                                'Ingresar al sistema'
                            )}
                        </Button>
                    </div>
                </form>
                <p className="text-center text-xs text-slate-600 mt-6">ERP-Market v2.0 · Gestión Supermercados</p>
            </div>
        </div>
    );
}