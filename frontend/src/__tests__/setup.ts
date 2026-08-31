import '@testing-library/jest-dom';

// Mock lucide-react icons — jsdom doesn't render SVG properly
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return actual;
});

// Mock useConfigStore with sane defaults
vi.mock('@/hooks/useConfigStore', () => ({
    useConfigStore: () => ({
        rates: { VES: 5.5, USD: 3600, COP: 1 },
        fmtCOP: (n: number) =>
            new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0,
            }).format(n),
        fromCOP: (cop: number, curr: string) => {
            if (curr === 'COP') return cop;
            if (curr === 'USD') return cop / 3600;
            if (curr === 'VES') return cop / 5.5;
            return cop;
        },
    }),
}));

// Mock useAuthStore
vi.mock('@/features/auth/store/authStore', () => ({
    useAuthStore: () => ({
        user: { id: '1', username: 'test', nombre: 'Test', role: 'OWNER' },
        selectedBranch: 'branch-1',
        setSelectedBranch: vi.fn(),
    }),
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(() => ({ data: [], isLoading: false })),
    useMutation: vi.fn(() => ({ mutate: vi.fn() })),
    QueryClient: vi.fn(),
}));

// Mock useProductSearch hook — must return filteredProducts including the ones passed via inventory
vi.mock('@/features/pos/hooks/useProductSearch', () => ({
    useProductSearch: vi.fn((inventory) => {
        const { useMemo } = require('react');
        const products = useMemo(() =>
            inventory.map((item: any) => item.product),
            [inventory]
        );
        return {
            search: '',
            setSearch: vi.fn(),
            category: 'Todos',
            setCategory: vi.fn(),
            categories: ['Todos'],
            filteredProducts: products,
            isSearching: false,
        };
    }),
}));