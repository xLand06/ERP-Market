// =============================================================================
// QUERY CLIENT — React Query con retry y error handling
// =============================================================================

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60_000,        // 5 min
            gcTime: 10 * 60_000,          // 10 min garbage collection
            retry: 0,
            refetchOnWindowFocus: true,   // refresh when user returns to the app
        },
        mutations: {
            retry: 0,
        },
    },
});

export default queryClient;