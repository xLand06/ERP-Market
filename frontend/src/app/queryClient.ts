// =============================================================================
// QUERY CLIENT — React Query con retry y error handling
// =============================================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30,
            retry: 0,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export default queryClient;