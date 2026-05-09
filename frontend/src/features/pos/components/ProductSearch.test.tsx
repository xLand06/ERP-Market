import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSearch } from '@/features/pos/components/ProductSearch';
import { mockProduct, mockProduct2, mockProduct3 } from '@/__tests__/mocks';
import type { InventoryItem } from '@/features/pos/types';

// Mock the hook at module level
const mockSetCategory = vi.fn();
const mockSetSearch = vi.fn();

vi.mock('@/features/pos/hooks/useProductSearch', () => ({
    useProductSearch: vi.fn(),
}));

import { useProductSearch } from '@/features/pos/hooks/useProductSearch';

function buildInventory(...products: typeof mockProduct[]): InventoryItem[] {
    return products.map(p => ({ product: p, stock: p.stock }));
}

function mockHook({
    filteredProducts = [],
    categories = ['Todos'],
    category = 'Todos',
    isSearching = false,
} = {}) {
    (useProductSearch as ReturnType<typeof vi.fn>).mockReturnValue({
        search: '',
        setSearch: mockSetSearch,
        category,
        setCategory: mockSetCategory,
        categories,
        filteredProducts,
        isSearching,
    });
}

describe('ProductSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetCategory.mockClear();
        mockSetSearch.mockClear();
    });

    it('muestra "No se encontraron productos" cuando filteredProducts está vacío', () => {
        mockHook({ filteredProducts: [] });
        render(
            <ProductSearch
                inventory={[]}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );
        expect(screen.getByText('No se encontraron productos.')).toBeInTheDocument();
    });

    it('renderiza productos cuando se pasan como props', () => {
        mockHook({ filteredProducts: [mockProduct, mockProduct2] });
        render(
            <ProductSearch
                inventory={buildInventory(mockProduct, mockProduct2)}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('Papas Lay')).toBeInTheDocument();
    });

    it('filtra por categoría al hacer click en chip', async () => {
        const user = userEvent.setup();
        mockHook({
            filteredProducts: [mockProduct, mockProduct2],
            categories: ['Todos', 'Bebidas', 'Snacks'],
        });
        render(
            <ProductSearch
                inventory={buildInventory(mockProduct, mockProduct2)}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );

        const bebidasChip = screen.getByText('Bebidas');
        await user.click(bebidasChip);

        expect(mockSetCategory).toHaveBeenCalledWith('Bebidas');
    });

    it('renderiza badge de stock en producto', () => {
        mockHook({ filteredProducts: [mockProduct] });
        render(
            <ProductSearch
                inventory={buildInventory(mockProduct)}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );
        expect(screen.getByText(/48 UNIDAD/)).toBeInTheDocument();
    });

    it('muestra indicador de presentaciones cuando hay más de una', () => {
        mockHook({ filteredProducts: [mockProduct] });
        render(
            <ProductSearch
                inventory={buildInventory(mockProduct)}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );
        expect(screen.getByText(/1 pres\./)).toBeInTheDocument();
    });

    it('no muestra indicador de presentaciones cuando no hay ninguna', () => {
        mockHook({ filteredProducts: [mockProduct2] });
        render(
            <ProductSearch
                inventory={buildInventory(mockProduct2)}
                isSaleMode={true}
                onAddToCart={vi.fn()}
                onShowPresentations={vi.fn()}
            />
        );
        expect(screen.queryByText(/pres\./)).not.toBeInTheDocument();
    });
});