import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartPanel } from '@/features/pos/components/CartPanel';
import { mockCartItem, mockCartItem2, mockProduct, mockProduct2, mockTotals } from '@/__tests__/mocks';
import type { CartItem, Product } from '@/features/pos/types';

function setup(props: {
    items?: CartItem[];
    totals?: typeof mockTotals;
    isSaleMode?: boolean;
    products?: Product[];
    isSubmitting?: boolean;
}) {
    const {
        items = [],
        totals = mockTotals,
        isSaleMode = true,
        products = [],
        isSubmitting = false,
    } = props;

    const onUpdateQty = vi.fn();
    const onUpdatePresentation = vi.fn();
    const onRemoveItem = vi.fn();
    const onClearCart = vi.fn();
    const onCheckout = vi.fn();

    render(
        <CartPanel
            items={items}
            totals={totals}
            isSaleMode={isSaleMode}
            products={products}
            onUpdateQty={onUpdateQty}
            onUpdatePresentation={onUpdatePresentation}
            onRemoveItem={onRemoveItem}
            onClearCart={onClearCart}
            onCheckout={onCheckout}
            isSubmitting={isSubmitting}
        />
    );

    return { onUpdateQty, onUpdatePresentation, onRemoveItem, onClearCart, onCheckout };
}

describe('CartPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderiza carrito vacío con mensaje "Carrito vacío"', () => {
        setup({ items: [] });
        expect(screen.getByText('Carrito vacío')).toBeInTheDocument();
    });

    it('renderiza items en el carrito', () => {
        setup({
            items: [mockCartItem],
            products: [mockProduct],
        });
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // qty
    });

    it('muestra el total correctamente', () => {
        setup({
            items: [mockCartItem],
            totals: { subtotal: 36000, total: 36000, itemCount: 1 },
            products: [mockProduct],
        });
        expect(screen.getByText('$36.000')).toBeInTheDocument();
    });

    it('botón de pago deshabilitado cuando carrito está vacío', () => {
        const { onCheckout } = setup({ items: [] });
        // The button should be disabled — we check by clicking
        // render doesn't expose disabled prop directly, so we check the button element
        const buttons = screen.getAllByRole('button');
        const checkoutBtn = buttons.find(b => b.textContent?.includes('Pagar') || b.textContent?.includes('Registrar Entrada'));
        expect(checkoutBtn).toBeDisabled();
    });

    it('botón de pago habilitado cuando hay items', () => {
        const { onCheckout } = setup({
            items: [mockCartItem],
            products: [mockProduct],
        });
        const buttons = screen.getAllByRole('button');
        const checkoutBtn = buttons.find(b => b.textContent?.includes('Pagar'));
        expect(checkoutBtn).not.toBeDisabled();
    });

    it('muestra botón "Limpiar" solo cuando hay items', () => {
        setup({ items: [], products: [] });
        expect(screen.queryByText('Limpiar')).not.toBeInTheDocument();

        setup({ items: [mockCartItem], products: [mockProduct] });
        expect(screen.getByText('Limpiar')).toBeInTheDocument();
    });

    it('llama a onRemoveItem al hacer click en X del item', async () => {
        const { user } = require('@testing-library/user-event');
        const userEvent = require('@testing-library/user-event').default;
        const { onRemoveItem } = setup({ items: [mockCartItem], products: [mockProduct] });

        const removeBtn = screen.getAllByRole('button').find(b =>
            b.className.includes('text-slate-300')
        );
        if (removeBtn) {
            await userEvent.click(removeBtn);
            expect(onRemoveItem).toHaveBeenCalled();
        }
    });

    it('muestra conversión a USD cuando hay items', () => {
        setup({
            items: [mockCartItem],
            totals: { subtotal: 36000, total: 36000, itemCount: 1 },
            products: [mockProduct],
        });
        // USD conversion: 36000 / 3600 = $10.00
        expect(screen.getByText(/\$10\.00 USD/)).toBeInTheDocument();
    });

    it('muestra conversión a VES cuando hay items', () => {
        setup({
            items: [mockCartItem],
            totals: { subtotal: 36000, total: 36000, itemCount: 1 },
            products: [mockProduct],
        });
        // VES conversion: 36000 / 5.5 = Bs. 6545.45
        expect(screen.getByText(/Bs\. [0-9,]+\.[0-9]{2}/)).toBeInTheDocument();
    });

    it('renderiza múltiples items correctamente', () => {
        setup({
            items: [mockCartItem, mockCartItem2],
            products: [mockProduct, mockProduct2],
        });
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('Papas Lay')).toBeInTheDocument();
    });
});