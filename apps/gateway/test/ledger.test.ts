import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeLedgerEntry, writeSessionEndEntries, loadLedgerEntries, loadConfirmations, CachedLedgerEntry } from '../src/ledger';

/**
 * Unit tests for the gateway ledger DB write module.
 * PrismaClient is mocked via vi.fn() stubs — no DB connection required.
 * These tests verify the write/read logic and return shapes, not SQL.
 */

function makeMockPrisma(overrides: Record<string, any> = {}): any {
    const now = new Date('2025-01-01T00:00:00.000Z');

    const defaultCreate = async (args: any) => ({
        id:        'entry-uuid-001',
        roomId:    args.data.roomId,
        userId:    args.data.userId,
        type:      args.data.type,
        amount:    args.data.amount,
        authorId:  args.data.authorId,
        parentId:  args.data.parentId ?? null,
        note:      args.data.note ?? null,
        createdAt: now,
    });

    const defaultFindMany = async () => [];

    return {
        ledgerEntry: {
            create:   vi.fn(defaultCreate),
            findMany: vi.fn(defaultFindMany),
        },
        ledgerConfirmation: {
            findMany: vi.fn(async () => []),
        },
        ...overrides,
    };
}

describe('writeLedgerEntry', () => {
    it('persists correct fields and returns CachedLedgerEntry', async () => {
        const mockPrisma = makeMockPrisma();
        const result = await writeLedgerEntry(mockPrisma, {
            roomDbId: 'room-uuid-001',
            userId:   'user-uuid-001',
            type:     'BUY_IN',
            amount:   1000,
            authorId: 'host-uuid-001',
        });

        expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith({
            data: {
                roomId:   'room-uuid-001',
                userId:   'user-uuid-001',
                type:     'BUY_IN',
                amount:   1000,
                authorId: 'host-uuid-001',
                parentId: undefined,
                note:     undefined,
            },
        });

        expect(result).toMatchObject<Partial<CachedLedgerEntry>>({
            id:       'entry-uuid-001',
            roomId:   'room-uuid-001',
            userId:   'user-uuid-001',
            type:     'BUY_IN',
            amount:   1000,
            authorId: 'host-uuid-001',
        });
        expect(result.parentId).toBeUndefined();
        expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('passes parentId and note for ADJUSTMENT entries', async () => {
        const mockPrisma = makeMockPrisma();
        await writeLedgerEntry(mockPrisma, {
            roomDbId: 'room-uuid-001',
            userId:   'user-uuid-001',
            type:     'ADJUSTMENT',
            amount:   800,
            authorId: 'host-uuid-001',
            parentId: 'original-entry-id',
            note:     'Correcting buy-in amount',
        });

        expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type:     'ADJUSTMENT',
                parentId: 'original-entry-id',
                note:     'Correcting buy-in amount',
            }),
        });
    });
});

describe('writeSessionEndEntries', () => {
    it('writes CASH_OUT for players without one and returns new entries', async () => {
        const mockPrisma = makeMockPrisma();
        let callCount = 0;
        mockPrisma.ledgerEntry.create = vi.fn(async (args: any) => ({
            id:        `new-entry-${++callCount}`,
            roomId:    args.data.roomId,
            userId:    args.data.userId,
            type:      args.data.type,
            amount:    args.data.amount,
            authorId:  args.data.authorId,
            parentId:  null,
            note:      null,
            createdAt: new Date(),
        }));

        const existingEntries: CachedLedgerEntry[] = [
            // p1 already cashed out
            { id: 'e1', roomId: 'r', userId: 'p1', type: 'CASH_OUT', amount: 1500, authorId: 'p1', createdAt: new Date() },
            { id: 'e0', roomId: 'r', userId: 'p1', type: 'BUY_IN',   amount: 1000, authorId: 'host', createdAt: new Date() },
        ];

        const players = [
            { id: 'p1', stack: 0 },    // already cashed out — skip
            { id: 'p2', stack: 800 },  // needs CASH_OUT
            { id: 'p3', stack: 0 },    // busted — still write CASH_OUT(0) for completeness
        ];

        const newEntries = await writeSessionEndEntries(mockPrisma, 'room-uuid', players, existingEntries, 'host-uuid');

        // Should write for p2 and p3 only
        expect(newEntries).toHaveLength(2);
        expect(newEntries.find(e => e.userId === 'p2')?.amount).toBe(800);
        expect(newEntries.find(e => e.userId === 'p3')?.amount).toBe(0);
        expect(newEntries.find(e => e.userId === 'p1')).toBeUndefined();

        // All new entries are CASH_OUT type
        expect(newEntries.every(e => e.type === 'CASH_OUT')).toBe(true);
    });

    it('returns empty array when all players already have CASH_OUT', async () => {
        const mockPrisma = makeMockPrisma();
        const existingEntries: CachedLedgerEntry[] = [
            { id: 'e1', roomId: 'r', userId: 'p1', type: 'CASH_OUT', amount: 1000, authorId: 'p1', createdAt: new Date() },
            { id: 'e2', roomId: 'r', userId: 'p2', type: 'CASH_OUT', amount: 1000, authorId: 'p2', createdAt: new Date() },
        ];

        const result = await writeSessionEndEntries(
            mockPrisma, 'room-uuid',
            [{ id: 'p1', stack: 0 }, { id: 'p2', stack: 0 }],
            existingEntries, 'host-uuid'
        );

        expect(result).toHaveLength(0);
        expect(mockPrisma.ledgerEntry.create).not.toHaveBeenCalled();
    });
});

describe('loadLedgerEntries', () => {
    it('returns empty array when no entries exist', async () => {
        const mockPrisma = makeMockPrisma();
        const result = await loadLedgerEntries(mockPrisma, 'room-uuid');
        expect(result).toEqual([]);
    });

    it('maps DB rows to CachedLedgerEntry shape', async () => {
        const now = new Date('2025-06-01T10:00:00.000Z');
        const mockPrisma = makeMockPrisma({
            ledgerEntry: {
                create: vi.fn(),
                findMany: vi.fn(async () => [
                    { id: 'e1', roomId: 'r', userId: 'p1', type: 'BUY_IN', amount: 500, authorId: 'host', parentId: null, note: null, createdAt: now },
                    { id: 'e2', roomId: 'r', userId: 'p2', type: 'BUY_IN', amount: 500, authorId: 'host', parentId: null, note: null, createdAt: now },
                ]),
            },
        });

        const result = await loadLedgerEntries(mockPrisma, 'r');
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ id: 'e1', userId: 'p1', type: 'BUY_IN', amount: 500 });
        expect(result[0].parentId).toBeUndefined();
        expect(result[0].createdAt).toEqual(now);
    });
});

describe('loadConfirmations', () => {
    it('returns empty array when no confirmations exist', async () => {
        const mockPrisma = makeMockPrisma();
        const result = await loadConfirmations(mockPrisma, 'room-uuid');
        expect(result).toEqual([]);
    });

    it('returns userId strings from confirmation rows', async () => {
        const mockPrisma = makeMockPrisma({
            ledgerConfirmation: {
                findMany: vi.fn(async () => [
                    { userId: 'p1' },
                    { userId: 'p2' },
                ]),
            },
        });

        const result = await loadConfirmations(mockPrisma, 'room-uuid');
        expect(result).toEqual(['p1', 'p2']);
    });
});
