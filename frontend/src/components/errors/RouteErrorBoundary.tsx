import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
    AlertTriangle, RefreshCcw, ArrowLeft, Home, ChevronDown, ChevronRight 
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function RouteErrorBoundary() {
    const error = useRouteError();
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);

    let errorMessage = 'Ha ocurrido un error inesperado en la aplicación.';
    let errorStack: string | undefined = undefined;

    if (isRouteErrorResponse(error)) {
        errorMessage = error.statusText || error.data?.message || errorMessage;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-50 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Header with Icon */}
                <div className="bg-amber-50 p-8 flex flex-col items-center border-b border-amber-100">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 text-center">¡Ups! Algo salió mal</h1>
                    <p className="text-sm text-slate-500 text-center mt-2 px-4">
                        La aplicación detectó un problema técnico y no pudo continuar mostrando esta pantalla.
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mensaje de error</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed italic">
                            "{errorMessage}"
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 h-11 border-slate-200"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Regresar
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 h-11 border-slate-200"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Recargar App
                        </Button>
                    </div>

                    <Button 
                        onClick={() => navigate('/')}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 flex items-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Ir al Inicio / Dashboard
                    </Button>

                    {/* Debug Info Toggle */}
                    {errorStack && (
                        <div className="mt-2">
                            <button 
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center justify-between w-full px-2 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                            >
                                <span className="flex items-center gap-2">
                                    {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    Información Técnica
                                </span>
                            </button>
                            
                            {showDetails && (
                                <div className="mt-2 p-3 bg-slate-900 rounded-lg overflow-x-auto max-h-48">
                                    <pre className="text-[10px] text-emerald-400 font-mono leading-tight whitespace-pre-wrap">
                                        {errorStack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-center">
                    <p className="text-[10px] text-slate-400 font-medium">
                        ERP Market System • Recovery Mode
                    </p>
                </div>
            </div>
        </div>
    );
}
