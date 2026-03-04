// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../src/app/page';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

describe('Home Page', () => {
    it('renders the Overbet heading', () => {
        render(<Home />);
        const heading = screen.getByText(/OVERBET/i);
        expect(heading).toBeDefined();
    });
});
