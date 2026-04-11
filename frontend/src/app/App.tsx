// =============================================================================
// APP — Componente principal con Providers
// =============================================================================

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './queryClient';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './global.css';

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#0F172A',
                        color: '#F8FAFC',
                        border: '1px solid #334155',
                    },
                    success: {
                        iconTheme: { primary: '#10B981', secondary: '#fff' },
                    },
                    error: {
                        iconTheme: { primary: '#EF4444', secondary: '#fff' },
                    },
                }}
            />
        </QueryClientProvider>
    );
}