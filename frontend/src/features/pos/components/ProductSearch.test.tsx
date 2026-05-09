import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSearch } from '../ProductSearch';
import { mockProduct, mockProduct2, mockProduct3 } from '../../__tests__/mocks';
import type { InventoryItem } from '../../types';

vi.mock('@/features/pos/hooks/useProductSearch');

const { useProductSearch } = await import('@/features/pos/hooks/useProductSearch');

function buildInventory(...products: typeof mockProduct[]): InventoryItem[] {
    return products.map(p => ({ product: p, stock: p.stock }));
}

function mockHook({
    filteredProducts = [],
    categories = ['Todos'],
    category = 'Todos',
} = {}) {
    const mockValue = {
        search: '',
        setSearch: vi.fn(),
        category,
        setCategory: vi.fn(),
        categories,
        filteredProducts,
        isSearching: false,
    };
    (useProductSearch as ReturnType<typeof vi.fn>).mockReturnValue(mockValue);
    return mockValue;
}

describe('ProductSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('muestra "No se encontraron productos" cuando filteredProducts está vacío', () => {
        mockHook({ filteredProducts: [] });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={[]}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        expect(screen.getByText('No se encontraron productos')).toBeInTheDocument();
    });

    it('renderiza productos cuando se pasan como props', () => {
        mockHook({ filteredProducts: [mockProduct, mockProduct2] });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={buildInventory(mockProduct, mockProduct2)}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('Papas Lay')).toBeInTheDocument();
    });

    it('filtra por categoría al hacer click en chip', async () => {
        const user = userEvent.setup();
        const mockValue = mockHook({
            filteredProducts: [mockProduct, mockProduct2],
            categories: ['Todos', 'Bebidas', 'Snacks'],
        });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={buildInventory(mockProduct, mockProduct2)}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        const bebidasChip = screen.getByText('Bebidas');
        await user.click(bebidasChip);

        expect(mockValue.setCategory).toHaveBeenCalledWith('Bebidas');
    });

    it('renderiza badge de stock en producto', () => {
        mockHook({ filteredProducts: [mockProduct] });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={buildInventory(mockProduct)}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        // Stock badge shows "48 UNIDAD"
        expect(screen.getByText(/48 UNIDAD/)).toBeInTheDocument();
    });

    it('muestra indicador de presentaciones cuando hay más de una', () => {
        mockHook({ filteredProducts: [mockProduct] });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={buildInventory(mockProduct)}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        expect(screen.getByText(/1 pres\./)).toBeInTheDocument();
    });

    it('no muestra indicador de presentaciones cuando no hay ninguna', () => {
        mockHook({ filteredProducts: [mockProduct2] });
        const onAddToCart = vi.fn();
        const onShowPresentations = vi.fn();

        render(
            <ProductSearch
                inventory={buildInventory(mockProduct2)}
                isSaleMode={true}
                onAddToCart={onAddToCart}
                onShowPresentations={onShowPresentations}
            />
        );

        expect(screen.queryByText(/pres\./)).not.toBeInTheDocument();
    });
});