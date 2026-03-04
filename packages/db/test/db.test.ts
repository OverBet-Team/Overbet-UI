import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../index';

describe('Database Tests', () => {
    it('should have a Prisma client instance available', () => {
        expect(PrismaClient).toBeDefined();
    });
});

