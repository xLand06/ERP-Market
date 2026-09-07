import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface Product {
    id: string;
    name: string;
    price: number;
    status: string;
    sku: string;
}

const products: Product[] = [
    { id: 'p1', name: 'Cerveza Andina', price: 12000, status: 'Activo', sku: 'SKU-001' },
    { id: 'p2', name: 'Papas Lay', price: 8000, status: 'Inactivo', sku: 'SKU-002' },
];

const columns: Column<Product>[] = [
    { key: 'name', header: 'Producto', cell: p => p.name, showCard: true },
    { key: 'price', header: 'Precio', cell: p => `$${p.price}`, showCard: true },
    { key: 'status', header: 'Estado', cell: p => p.status, hideBelow: 'md', showCard: true },
    { key: 'sku', header: 'SKU', cell: p => p.sku },
];

const rowKey = (p: Product) => p.id;

function mockMatchMedia(matches: boolean) {
    const listeners: Array<(event: { matches: boolean }) => void> = [];
    const mql = {
        matches,
        media: '(max-width: 767px)',
        onchange: null,
        addEventListener: vi.fn((_: string, listener: (event: { matches: boolean }) => void) => {
            listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
    return { mql, listeners };
}

describe('DataTable', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders a table with headers and rows on desktop (fallback without matchMedia)', () => {
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} />);

        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'SKU' })).toBeInTheDocument();
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        expect(screen.getByText('Papas Lay')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('applies hidden md:table-cell to hideBelow columns', () => {
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} />);

        const th = screen.getByRole('columnheader', { name: 'Estado' });
        expect(th.className).toContain('hidden');
        expect(th.className).toContain('md:table-cell');

        const td = screen.getByText('Activo').closest('td');
        expect(td?.className).toContain('md:table-cell');
    });

    it('renders card view below md derived from the same columns', () => {
        mockMatchMedia(true);
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} />);

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        // Title comes from the first showCard column
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
        // showCard columns are in the card grid
        expect(screen.getByText('$12000')).toBeInTheDocument();
        expect(screen.getByText('Activo')).toBeInTheDocument();
        // Non-showCard columns are excluded from the card
        expect(screen.queryByText('SKU-001')).not.toBeInTheDocument();
    });

    it('renders row actions as 44px targets in card view', () => {
        mockMatchMedia(true);
        const actions = (p: Product) => (
            <Button size="row-icon" variant="ghost" aria-label={`Editar ${p.name}`}>
                <Pencil className="w-4 h-4" />
            </Button>
        );
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} actions={actions} />);

        const editButtons = screen.getAllByRole('button', { name: /Editar/ });
        expect(editButtons).toHaveLength(2);
        for (const btn of editButtons) {
            expect(btn.className).toContain('h-11');
            expect(btn.className).toContain('w-11');
        }
    });

    it('renders the actions column on desktop', () => {
        const actions = (p: Product) => (
            <Button size="row-icon" variant="ghost" aria-label={`Editar ${p.name}`}>
                <Pencil className="w-4 h-4" />
            </Button>
        );
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} actions={actions} />);

        expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Editar/ })).toHaveLength(2);
    });

    it('applies rowClassName to rows on desktop', () => {
        const rowClassName = (p: Product) => (p.status === 'Inactivo' ? 'opacity-60 bg-slate-50' : '');
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} rowClassName={rowClassName} />);

        const rows = screen.getAllByRole('row');
        const inactiveRow = rows.find(r => r.textContent?.includes('Papas Lay'));
        const activeRow = rows.find(r => r.textContent?.includes('Cerveza Andina'));
        expect(inactiveRow?.className).toContain('opacity-60');
        expect(inactiveRow?.className).toContain('bg-slate-50');
        expect(activeRow?.className).not.toContain('opacity-60');
    });

    it('applies rowClassName to card items below md', () => {
        mockMatchMedia(true);
        const rowClassName = (p: Product) => (p.status === 'Inactivo' ? 'opacity-60 bg-slate-50' : '');
        const { container } = render(
            <DataTable columns={columns} rows={products} rowKey={rowKey} rowClassName={rowClassName} />
        );

        const cards = Array.from(container.querySelectorAll('li > div'));
        expect(cards[1].className).toContain('opacity-60');
        expect(cards[0].className).not.toContain('opacity-60');
    });

    it('shows the empty state when there are no rows', () => {
        render(
            <DataTable
                columns={columns}
                rows={[]}
                rowKey={rowKey}
                empty={{ title: 'Sin registros', description: 'No se encontraron datos.' }}
            />
        );

        expect(screen.getByText('Sin registros')).toBeInTheDocument();
        expect(screen.getByText('No se encontraron datos.')).toBeInTheDocument();
    });

    it('renders loading skeletons instead of rows', () => {
        render(
            <DataTable
                columns={columns}
                rows={products}
                rowKey={rowKey}
                isLoading
                loadingRows={3}
            />
        );

        expect(screen.queryByText('Cerveza Andina')).not.toBeInTheDocument();
        expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders pagination and fires onPageChange', async () => {
        const user = userEvent.setup();
        const onPageChange = vi.fn();
        render(
            <DataTable
                columns={columns}
                rows={products}
                rowKey={rowKey}
                pagination={{ page: 2, totalPages: 5, total: 97, onPageChange }}
            />
        );

        expect(screen.getByText(/Página 2 de 5/)).toBeInTheDocument();
        expect(screen.getByText(/97 registros totales/)).toBeInTheDocument();

        const [prevBtn, nextBtn] = screen.getAllByRole('button');
        await user.click(nextBtn);
        expect(onPageChange).toHaveBeenCalledWith(3);
        await user.click(prevBtn);
        expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('switches from table to card view when the breakpoint changes', () => {
        const { listeners } = mockMatchMedia(false);
        render(<DataTable columns={columns} rows={products} rowKey={rowKey} />);

        expect(screen.getByRole('table')).toBeInTheDocument();

        act(() => {
            listeners.forEach(listener => listener({ matches: true }));
        });

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.getByText('Cerveza Andina')).toBeInTheDocument();
    });
});