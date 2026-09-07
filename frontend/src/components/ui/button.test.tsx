import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
    it('row-icon size applies a 44px touch target on mobile and 36px density on desktop', () => {
        render(<Button size="row-icon">Editar</Button>);
        const button = screen.getByRole('button', { name: 'Editar' });
        expect(button.className).toContain('h-11');
        expect(button.className).toContain('w-11');
        expect(button.className).toContain('md:h-9');
        expect(button.className).toContain('md:w-9');
    });

    it('icon size is at least 44px on all breakpoints', () => {
        render(<Button size="icon" aria-label="Trash" />);
        const button = screen.getByRole('button', { name: 'Trash' });
        expect(button.className).toContain('h-11');
        expect(button.className).toContain('w-11');
    });
});