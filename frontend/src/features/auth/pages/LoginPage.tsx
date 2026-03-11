import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';

export default function LoginPage() {
    const [showPw, setShowPw] = useState(false);
    const navigate = useNavigate();
    const setAuth = useAuthStore(s => s.setAuth);

    const handleLogin = () => {
        setAuth('demo-token-erp-market', {
            id: '1',
            name: 'Administrador',
            email: 'admin@erpmarket.com',
            role: 'admin',
        });
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                        <span className="text-xl font-black text-white">EM</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">ERP-Market</h1>
                    <p className="text-slate-400 text-sm mt-1">Sistema de gestión para supermercados</p>
                </div>

                {/* Form */}
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
                    <h2 className="text-base font-bold text-white mb-5">Iniciar sesión</h2>
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    type="email"
                                    placeholder="tu@email.com"
                                    className="pl-9 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Tu contraseña"
                                    className="pl-9 pr-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <Button className="w-full mt-2" size="lg" onClick={handleLogin}>
                            Ingresar al sistema
                        </Button>
                    </div>
                </div>
                <p className="text-center text-xs text-slate-600 mt-6">ERP-Market v2.0 · Gestión Supermercados</p>
            </div>
        </div>
    );
}
