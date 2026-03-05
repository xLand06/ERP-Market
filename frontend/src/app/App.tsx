import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { theme } from './theme';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './global.css';

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider theme={theme}>
                <RouterProvider router={router} />
            </MantineProvider>
        </QueryClientProvider>
    );
}
