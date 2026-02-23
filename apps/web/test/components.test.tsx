// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '../src/app/page';

describe('Home Page', () => {
    it('renders the Overbet heading', () => {
        render(<Home />);
        const heading = screen.getByText(/OVERBET/i);
        expect(heading).toBeDefined();
    });
});
