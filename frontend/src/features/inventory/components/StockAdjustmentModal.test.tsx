import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockAdjustmentModal } from '@/features/inventory/components/StockAdjustmentModal';
import type { ProductCatalog } from '@/features/inventory/components/StockAdjustmentModal';

// Mock api
vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(({ queryKey }) => {
        if (queryKey[0] === 'global-products') {
            return {
                data: [
                    { id: 'prod-1', name: 'Cerveza Andina', barcode: '123456789', price: 12000 },
                    { id: 'prod-2', name: 'Papas Lay', barcode: '987654321', price: 8000 },
                    { id: 'prod-3', name: 'Agua Mineral', barcode: null, price: 5000 },
                ] as ProductCatalog[],
                isLoading: false,
            };
        }
        return { data: [], isLoading: false };
    }),
}));

describe('StockAdjustmentModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        open: true,
        onClose: vi.fn(),
        onSave: vi.fn(),
    };

    it('renderiza el modal cuando open es true', () => {
        render(<StockAdjustmentModal {...defaultProps} />);
        expect(screen.getByText('Ajuste por Recuento de Stock')).toBeInTheDocument();
    });

    it('no renderiza nada cuando open es false', () => {
        render(<StockAdjustmentModal {...defaultProps} open={false} />);
        expect(screen.queryByText('Ajuste por Recuento de Stock')).not.toBeInTheDocument();
    });

    it('campo de búsqueda existe en el modal', () => {
        render(<StockAdjustmentModal {...defaultProps} />);
        expect(screen.getByPlaceholderText('Buscar por nombre o código...')).toBeInTheDocument();
    });

    it('lista productos en el catálogo', () => {
        render(<StockAdjustmentModal {...defaultProps} />);
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('Papas Lay')).toBeInTheDocument();
        expect(screen.getByText('Agua Mineral')).toBeInTheDocument();
    });

    it('filtra productos al escribir en búsqueda', async () => {
        const user = userEvent.setup();
        render(<StockAdjustmentModal {...defaultProps} />);

        const searchInput = screen.getByPlaceholderText('Buscar por nombre o código...');
        await act(async () => {
            await user.type(searchInput, 'Cerveza');
        });

        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.queryByText('Papas Lay')).not.toBeInTheDocument();
    });

    it('al seleccionar producto muestra formulario de ajuste', async () => {
        const user = userEvent.setup();
        render(<StockAdjustmentModal {...defaultProps} />);

        const productos = screen.getAllByRole('button').filter(b =>
            b.className.includes('hover:bg-indigo-50')
        );
        // Click on first product
        await act(async () => {
            await user.click(productos[0]);
        });

        expect(screen.getByText('Cantidad Física Real')).toBeInTheDocument();
        expect(screen.getByText('Stock Mínimo (Alerta)')).toBeInTheDocument();
        expect(screen.getByText('Motivo del Ajuste')).toBeInTheDocument();
    });

    it('botón guardar deshabilitado sin producto seleccionado', () => {
        render(<StockAdjustmentModal {...defaultProps} />);
        const saveBtn = screen.getByRole('button', { name: /Guardar Recuento/ });
        expect(saveBtn).toBeDisabled();
    });

    it('validación de stock negativo - input type="number" con min="0"', () => {
        render(<StockAdjustmentModal {...defaultProps} />);

        const productos = screen.getAllByRole('button').filter(b =>
            b.className.includes('hover:bg-indigo-50')
        );

        // Select a product first
        const user = userEvent.setup();
        act(() => { productos[0].click(); });

        const stockInput = screen.getByRole('spinbutton', { name: /Cantidad Física Real/ });
        expect(stockInput).toHaveAttribute('min', '0');
    });

    it('botón Cancelar llama a onClose', async () => {
        const user = userEvent.setup();
        render(<StockAdjustmentModal {...defaultProps} />);

        const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
        await act(async () => {
            await user.click(cancelBtn);
        });

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('botón Cambiar permite volver a selección de producto', async () => {
        const user = userEvent.setup();
        render(<StockAdjustmentModal {...defaultProps} />);

        // Select a product
        const productos = screen.getAllByRole('button').filter(b =>
            b.className.includes('hover:bg-indigo-50')
        );
        await act(async () => {
            await user.click(productos[0]);
        });

        // Click "Cambiar"
        const cambiarBtn = screen.getByRole('button', { name: 'Cambiar' });
        await act(async () => {
            await user.click(cambiarBtn);
        });

        // Back to product list
        expect(screen.getByPlaceholderText('Buscar por nombre o código...')).toBeInTheDocument();
    });

    it('submit con cantidad y motivo llama a onSave', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<StockAdjustmentModal {...defaultProps} onSave={onSave} />);

        // Select product
        const productos = screen.getAllByRole('button').filter(b =>
            b.className.includes('hover:bg-indigo-50')
        );
        await act(async () => {
            await user.click(productos[0]);
        });

        // Fill stock
        const stockInput = screen.getByRole('spinbutton', { name: /Cantidad Física Real/ });
        await act(async () => {
            await user.clear(stockInput);
            await user.type(stockInput, '50');
        });

        // Fill reason
        const reasonInput = screen.getByRole('textbox', { name: /Motivo del Ajuste/ });
        await act(async () => {
            await user.type(reasonInput, 'Conteo físico mensual');
        });

        // Submit
        const saveBtn = screen.getByRole('button', { name: /Guardar Recuento/ });
        await act(async () => {
            await user.click(saveBtn);
        });

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            quantity: 50,
            reason: 'Conteo físico mensual',
        }));
    });

    it('muestra mensaje cuando no hay productos en la búsqueda', async () => {
        const user = userEvent.setup();
        render(<StockAdjustmentModal {...defaultProps} />);

        const searchInput = screen.getByPlaceholderText('Buscar por nombre o código...');
        await act(async () => {
            await user.type(searchInput, 'producto-inexistente-xyz');
        });

        expect(screen.getByText('No se encontraron productos.')).toBeInTheDocument();
    });

    it('resetear campos al abrir el modal', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<StockAdjustmentModal {...defaultProps} />);

        // Select product and fill fields
        const productos = screen.getAllByRole('button').filter(b =>
            b.className.includes('hover:bg-indigo-50')
        );
        await act(async () => {
            await user.click(productos[0]);
        });

        const stockInput = screen.getByRole('spinbutton', { name: /Cantidad Física Real/ });
        await act(async () => {
            await user.type(stockInput, '25');
        });

        // Re-open modal
        rerender(<StockAdjustmentModal {...defaultProps} open={false} />);
        rerender(<StockAdjustmentModal {...defaultProps} open={true} />);

        // Stock should be reset
        const resetStockInput = screen.getByRole('spinbutton', { name: /Cantidad Física Real/ });
        expect((resetStockInput as HTMLInputElement).value).toBe('');
    });
});