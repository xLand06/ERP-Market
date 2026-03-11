import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './global.css';

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    );
}
