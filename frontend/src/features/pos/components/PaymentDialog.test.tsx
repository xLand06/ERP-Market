import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentDialog } from '../PaymentDialog';

// Mock usePayment hook
vi.mock('@/features/pos/hooks/usePayment', () => ({
    usePayment: vi.fn(() => ({
        rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 0 }],
        totalInCOP: 50000,
        paidTotalInCOP: 0,
        changeInCOP: -50000,
        remainingInCOP: 50000,
        isChangeOver: false,
        canConfirm: false,
        addRow: vi.fn(),
        updateRow: vi.fn(),
        removeRow: vi.fn(),
        reset: vi.fn(),
        getPayload: vi.fn(() => []),
    })),
}));

const { usePayment } = await import('@/features/pos/hooks/usePayment');

describe('PaymentDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        open: true,
        total: 50000,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        isSubmitting: false,
    };

    it('se abre con un total', () => {
        render(<PaymentDialog {...defaultProps} />);
        expect(screen.getByText('Cobrar Venta')).toBeInTheDocument();
    });

    it('muestra el total a cobrar en COP', () => {
        render(<PaymentDialog {...defaultProps} />);
        // fmtCOP(50000) in es-CO = "$50.000"
        expect(screen.getByText('$50.000')).toBeInTheDocument();
    });

    it('botón "Confirmar" deshabilitado cuando no se ha cubierto el monto', () => {
        render(<PaymentDialog {...defaultProps} />);
        const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/ });
        expect(confirmBtn).toBeDisabled();
    });

    it('botón "Confirmar" habilitado cuando canConfirm es true', () => {
        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 50000 }],
            totalInCOP: 50000,
            paidTotalInCOP: 50000,
            changeInCOP: 0,
            remainingInCOP: 0,
            isChangeOver: false,
            canConfirm: true,
            addRow: vi.fn(),
            updateRow: vi.fn(),
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(() => [{ type: 'cash', amount: 50000, currency: 'COP' }]),
        });

        render(<PaymentDialog {...defaultProps} total={50000} open={true} />);
        const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/ });
        expect(confirmBtn).not.toBeDisabled();
    });

    it('agregar múltiples métodos de pago llama a addRow', async () => {
        const addRow = vi.fn();
        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 30000 }],
            totalInCOP: 50000,
            paidTotalInCOP: 30000,
            changeInCOP: -20000,
            remainingInCOP: 20000,
            isChangeOver: false,
            canConfirm: false,
            addRow,
            updateRow: vi.fn(),
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(),
        });

        render(<PaymentDialog {...defaultProps} />);

        const addBtn = screen.getByRole('button', { name: /Agregar otro método/ });
        await act(async () => {
            await userEvent.click(addBtn);
        });

        expect(addRow).toHaveBeenCalled();
    });

    it('barra de progreso se actualiza al agregar métodos', () => {
        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 25000 }],
            totalInCOP: 50000,
            paidTotalInCOP: 25000,
            changeInCOP: -25000,
            remainingInCOP: 25000,
            isChangeOver: false,
            canConfirm: false,
            addRow: vi.fn(),
            updateRow: vi.fn(),
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(),
        });

        render(<PaymentDialog {...defaultProps} />);

        // Progress bar fills to 50%
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar.style.width).toBe('50%');
    });

    it('muestra "Faltante" cuando no se alcanza el total', () => {
        render(<PaymentDialog {...defaultProps} />);
        expect(screen.getByText('Faltante')).toBeInTheDocument();
    });

    it('muestra "Vuelto" cuando se excede el total', () => {
        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 60000 }],
            totalInCOP: 50000,
            paidTotalInCOP: 60000,
            changeInCOP: 10000,
            remainingInCOP: 0,
            isChangeOver: true,
            canConfirm: true,
            addRow: vi.fn(),
            updateRow: vi.fn(),
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(),
        });

        render(<PaymentDialog {...defaultProps} />);
        expect(screen.getByText('Vuelto')).toBeInTheDocument();
    });

    it('llama a onClose al hacer click en Cancelar', async () => {
        const onClose = vi.fn();
        render(<PaymentDialog {...defaultProps} onClose={onClose} />);

        const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
        await act(async () => {
            await userEvent.click(cancelBtn);
        });

        expect(onClose).toHaveBeenCalled();
    });

    it('llama a onConfirm con payload al confirmar', async () => {
        const onConfirm = vi.fn();
        const mockPayload = [{ type: 'cash' as const, amount: 50000, currency: 'COP' as const }];

        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 50000 }],
            totalInCOP: 50000,
            paidTotalInCOP: 50000,
            changeInCOP: 0,
            remainingInCOP: 0,
            isChangeOver: false,
            canConfirm: true,
            addRow: vi.fn(),
            updateRow: vi.fn(),
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(() => mockPayload),
        });

        render(<PaymentDialog {...defaultProps} onConfirm={onConfirm} />);

        const confirmBtn = screen.getByRole('button', { name: /Confirmar Venta/ });
        await act(async () => {
            await userEvent.click(confirmBtn);
        });

        expect(onConfirm).toHaveBeenCalledWith(mockPayload);
    });

    it('muestra estados de carga cuando isSubmitting es true', () => {
        render(<PaymentDialog {...defaultProps} isSubmitting={true} />);
        expect(screen.getByText('Procesando...')).toBeInTheDocument();
    });

    it('muestra conversiones a USD y VES del total', () => {
        render(<PaymentDialog {...defaultProps} />);
        // 50000 COP → USD: 50000/3600 ≈ $13.89
        expect(screen.getByText(/\$13\.\d{2} USD/)).toBeInTheDocument();
        // 50000 COP → VES: 50000/5.5 ≈ Bs. 9090.91
        expect(screen.getByText(/Bs\. 9[0-9]{3}\.[0-9]{2}/)).toBeInTheDocument();
    });

    it('permite cambiar tipo de pago', async () => {
        const updateRow = vi.fn();
        (usePayment as ReturnType<typeof vi.fn>).mockReturnValue({
            rows: [{ key: 'row-1', type: 'cash', currency: 'COP', amount: 0 }],
            totalInCOP: 50000,
            paidTotalInCOP: 0,
            changeInCOP: -50000,
            remainingInCOP: 50000,
            isChangeOver: false,
            canConfirm: false,
            addRow: vi.fn(),
            updateRow,
            removeRow: vi.fn(),
            reset: vi.fn(),
            getPayload: vi.fn(),
        });

        render(<PaymentDialog {...defaultProps} />);

        // The select element for payment type
        const select = screen.getByRole('combobox');
        await act(async () => {
            await userEvent.select(select, 'cash-USD');
        });

        expect(updateRow).toHaveBeenCalled();
    });
});