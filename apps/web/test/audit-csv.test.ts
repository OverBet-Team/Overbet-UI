import { describe, it, expect, vi } from 'vitest';

// Mock @overbet/db
vi.mock('@overbet/db', () => ({
    prisma: {
        room: {
            findUnique: vi.fn(),
        },
        ledgerDispute: {
            findMany: vi.fn(async () => []),
        },
    },
}));

import { prisma } from '@overbet/db';
import { exportLedgerCSV } from '@/app/actions/ledger';

describe('exportLedgerCSV inconsistency audit', () => {
    it('is NOW consistent between resolved totals and adjusted P&L', async () => {
        const NOW = new Date();
        const room = {
            id: 'r1',
            slug: 'TEST',
            status: 'FINISHED',
            hostId: 'host',
            members: [
                { userId: 'p1', stack: 0, status: 'ACTIVE', user: { username: 'Alice' } }
            ],
            ledgerEntries: [
                { id: 'e1', userId: 'p1', type: 'BUY_IN', amount: 1000, createdAt: NOW, parentId: null, authorId: 'host' },
                { id: 'e2', userId: 'p1', type: 'ADJUSTMENT', amount: 500, createdAt: NOW, parentId: 'e1', authorId: 'host' },
                { id: 'e3', userId: 'p1', type: 'CASH_OUT', amount: 700, createdAt: NOW, parentId: null, authorId: 'p1' }
            ],
            ledgerConfirmations: []
        };
        (prisma.room.findUnique as any).mockResolvedValue(room);

        const csv = await exportLedgerCSV('TEST');
        const rows = csv!.split('\n');
        // Header: "Player","Buy-ins","Add-ons","Cash-outs","Net P&L"
        // Alice: Buy-ins (resolved)=500, Cash-outs=700, P&L= -500 + 700 = 200
        expect(rows[1]).toBe('"Alice",500,0,700,200');
        // Audit: 500 - 700 = -200 (invested 500, got 700 back = +200 profit). Matches P&L.
    });
});
