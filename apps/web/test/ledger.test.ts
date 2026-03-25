/**
 * Tests for ledger server actions.
 *
 * Server actions import @overbet/db (prisma singleton) and @overbet/engine (pure functions).
 * We mock the prisma singleton to avoid requiring a live DB connection.
 *
 * computeLedgerSnapshot is NOT mocked — it is pure and fast; testing through it gives
 * higher confidence than mocking it away.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @overbet/db before importing the action module
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
import { getLedger, exportLedgerCSV, exportLedgerJSON, exportLedgerText } from '@/app/actions/ledger';

// --- Fixtures ---

const NOW = new Date('2025-06-01T12:00:00.000Z');

function makeRoom(overrides: Partial<any> = {}): any {
    return {
        id:     'room-uuid-001',
        slug:   'ABC123',
        name:   'Test Room',
        status: 'FINISHED',
        hostId: 'host',
        settings: {},
        ledgerEntries: [
            { id: 'e1', roomId: 'room-uuid-001', userId: 'p1', type: 'BUY_IN',   amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
            { id: 'e2', roomId: 'room-uuid-001', userId: 'p2', type: 'BUY_IN',   amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
            { id: 'e3', roomId: 'room-uuid-001', userId: 'p1', type: 'CASH_OUT', amount: 1500, authorId: 'p1',   parentId: null, note: null, createdAt: NOW },
            { id: 'e4', roomId: 'room-uuid-001', userId: 'p2', type: 'CASH_OUT', amount: 500,  authorId: 'p2',   parentId: null, note: null, createdAt: NOW },
        ],
        members: [
            { userId: 'p1', stack: 0, user: { username: 'Alice' } },
            { userId: 'p2', stack: 0, user: { username: 'Bob' } },
        ],
        ledgerConfirmations: [{ userId: 'p1' }],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (prisma.ledgerDispute.findMany as any).mockResolvedValue([]);
});

// --- getLedger ---

describe('getLedger', () => {
    it('returns null for unknown slug', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(null);
        const result = await getLedger('UNKNOWN');
        expect(result).toBeNull();
    });

    it('computes correct final P&L for FINISHED room', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123');

        expect(result).not.toBeNull();
        expect(result!.isRunning).toBe(false);
        expect(result!.pnl['p1']).toBe(500);   // -1000 + 1500
        expect(result!.pnl['p2']).toBe(-500);  // -1000 + 500
        expect(result!.zeroSumError).toBeUndefined();
    });

    it('includes settlement transfers', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123');

        expect(result!.settlement).toHaveLength(1);
        expect(result!.settlement[0]).toMatchObject({ from: 'p2', to: 'p1', amount: 500 });
    });

    it('includes confirmations list', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123');

        expect(result!.confirmations).toContain('p1');
    });

    it('uses member stacks for currentStacks in running mode', async () => {
        const room = makeRoom({
            status: 'IN_PROGRESS',
            ledgerEntries: [
                { id: 'e1', roomId: 'room-uuid-001', userId: 'p1', type: 'BUY_IN', amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
                { id: 'e2', roomId: 'room-uuid-001', userId: 'p2', type: 'BUY_IN', amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
            ],
            members: [
                { userId: 'p1', stack: 1200, user: { username: 'Alice' } },
                { userId: 'p2', stack: 800,  user: { username: 'Bob' } },
            ],
        });
        (prisma.room.findUnique as any).mockResolvedValue(room);

        const result = await getLedger('ABC123');
        expect(result!.isRunning).toBe(true);
        expect(result!.pnl['p1']).toBe(200);   // -1000 + 1200
        expect(result!.pnl['p2']).toBe(-200);  // -1000 + 800
    });

    it('serializes entries with ISO timestamps', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123');

        expect(result!.entries).toHaveLength(4);
        expect(result!.entries[0].createdAt).toBe(NOW.toISOString());
        expect(result!.entries[0].type).toBe('BUY_IN');
    });
});

// --- exportLedgerCSV ---

describe('exportLedgerCSV', () => {
    it('returns null for unknown slug', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(null);
        expect(await exportLedgerCSV('UNKNOWN')).toBeNull();
    });

    it('includes correct CSV header', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const csv = await exportLedgerCSV('ABC123');
        expect(csv).not.toBeNull();
        expect(csv!.split('\n')[0]).toBe('"Player","Buy-ins","Add-ons","Cash-outs","Net P&L"');
    });

    it('produces one data row per player', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const csv = await exportLedgerCSV('ABC123');
        const lines = csv!.split('\n');
        // 1 header + 2 players
        expect(lines).toHaveLength(3);
    });

    it('row for p1 contains correct buy-in and cash-out amounts', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const csv = await exportLedgerCSV('ABC123');
        const p1Line = csv!.split('\n').find(l => l.startsWith('"p1"'));
        // Format: "Player",Buy-ins,Add-ons,Cash-outs,Net P&L (quoted player field)
        // p1: 1000 buy-in, 0 add-ons, 1500 cash-out, net=+500
        expect(p1Line).toBe('"p1",1000,0,1500,500');
    });
});

// --- exportLedgerJSON ---

describe('exportLedgerJSON', () => {
    it('returns null for unknown slug', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(null);
        expect(await exportLedgerJSON('UNKNOWN')).toBeNull();
    });

    it('returns valid JSON with expected structure', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const json = await exportLedgerJSON('ABC123');
        expect(json).not.toBeNull();

        const parsed = JSON.parse(json!);
        expect(parsed.roomSlug).toBe('ABC123');
        expect(parsed.exportedAt).toBeDefined();
        expect(Array.isArray(parsed.entries)).toBe(true);
        expect(typeof parsed.pnl).toBe('object');
    });

    it('includes timestamps and IDs in entries', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const json = await exportLedgerJSON('ABC123');
        const parsed = JSON.parse(json!);

        const e1 = parsed.entries.find((e: any) => e.id === 'e1');
        expect(e1).toBeDefined();
        expect(e1.createdAt).toBe(NOW.toISOString());
    });
});

// --- exportLedgerText ---

describe('exportLedgerText', () => {
    it('returns null for unknown slug', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(null);
        expect(await exportLedgerText('UNKNOWN')).toBeNull();
    });

    it('produces human-readable payment lines using display names', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const text = await exportLedgerText('ABC123');
        expect(text).not.toBeNull();
        // Bob owes Alice 500 (p2 → p1)
        expect(text).toContain('Bob pays Alice 500');
    });

    it('returns "no payments required" when ledger is balanced', async () => {
        // Both players break even
        const room = makeRoom({
            ledgerEntries: [
                { id: 'e1', roomId: 'r', userId: 'p1', type: 'BUY_IN',   amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
                { id: 'e2', roomId: 'r', userId: 'p2', type: 'BUY_IN',   amount: 1000, authorId: 'host', parentId: null, note: null, createdAt: NOW },
                { id: 'e3', roomId: 'r', userId: 'p1', type: 'CASH_OUT', amount: 1000, authorId: 'p1',   parentId: null, note: null, createdAt: NOW },
                { id: 'e4', roomId: 'r', userId: 'p2', type: 'CASH_OUT', amount: 1000, authorId: 'p2',   parentId: null, note: null, createdAt: NOW },
            ],
        });
        (prisma.room.findUnique as any).mockResolvedValue(room);
        const text = await exportLedgerText('ABC123');
        expect(text).toContain('No payments required');
    });
});


// --- Auth / membership checks ---

describe('getLedger membership check', () => {
    it('returns null when userId is provided but not a member or host', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123', 'stranger-id');
        expect(result).toBeNull();
    });

    it('returns data when userId is a member', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123', 'p1');
        expect(result).not.toBeNull();
        expect(result!.pnl['p1']).toBe(500);
    });

    it('returns data when userId is the host', async () => {
        const room = makeRoom({ hostId: 'host-user-id' });
        (prisma.room.findUnique as any).mockResolvedValue(room);
        const result = await getLedger('ABC123', 'host-user-id');
        expect(result).not.toBeNull();
    });

    it('returns data when userId is not provided (backward compat)', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const result = await getLedger('ABC123');
        expect(result).not.toBeNull();
    });
});

// --- CSV quoting ---

describe('exportLedgerCSV quoting', () => {
    it('header fields are quoted', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const csv = await exportLedgerCSV('ABC123');
        expect(csv).not.toBeNull();
        expect(csv!.split('\n')[0]).toBe('"Player","Buy-ins","Add-ons","Cash-outs","Net P&L"');
    });

    it('player id fields are quoted in data rows', async () => {
        (prisma.room.findUnique as any).mockResolvedValue(makeRoom());
        const csv = await exportLedgerCSV('ABC123');
        const dataLines = csv!.split('\n').slice(1);
        for (const line of dataLines) {
            expect(line).toMatch(/^"/); // each data row starts with a quoted field
        }
    });
});