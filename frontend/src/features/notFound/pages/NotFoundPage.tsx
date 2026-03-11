import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#F8FAFC]">
            <div className="text-center">
                <p className="text-8xl font-black text-slate-200">404</p>
                <h1 className="text-2xl font-bold text-slate-900 -mt-4">Página no encontrada</h1>
                <p className="text-slate-500 mt-2">La página que buscas no existe o fue movida.</p>
            </div>
            <Button onClick={() => navigate('/dashboard')}>Volver al Dashboard</Button>
        </div>
    );
}
