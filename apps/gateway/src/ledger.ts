/**
 * Gateway ledger DB write module.
 *
 * All writes to LedgerEntry, LedgerDispute, and LedgerConfirmation go through here.
 * The gateway's PrismaClient is passed in — never construct a new one here.
 *
 * This module is intentionally I/O-only: no computation, no socket logic.
 * Pure computation lives in @overbet/engine's computeLedgerSnapshot.
 */
import { PrismaClient } from '@overbet/db';

/** In-memory mirror of a DB LedgerEntry row, held in roomStates.ledgerEntries. */
export interface CachedLedgerEntry {
    id: string;
    roomId: string;
    userId: string;
    type: string;
    amount: number;
    authorId: string;
    parentId?: string;
    note?: string;
    createdAt: Date;
}

/**
 * Write a single immutable entry to DB and return it for cache insertion.
 * Throws if roomDbId is missing.
 */
export async function writeLedgerEntry(
    prisma: PrismaClient,
    entry: {
        roomDbId: string;
        userId: string;
        type: 'BUY_IN' | 'ADD_ON' | 'CASH_OUT' | 'ADJUSTMENT' | 'VOID';
        amount: number;
        authorId: string;
        parentId?: string;
        note?: string;
    }
): Promise<CachedLedgerEntry> {
    const row = await prisma.ledgerEntry.create({
        data: {
            roomId:   entry.roomDbId,
            userId:   entry.userId,
            type:     entry.type,
            amount:   entry.amount,
            authorId: entry.authorId,
            parentId: entry.parentId,
            note:     entry.note,
        },
    });

    return {
        id:        row.id,
        roomId:    row.roomId,
        userId:    row.userId,
        type:      row.type,
        amount:    row.amount,
        authorId:  row.authorId,
        parentId:  row.parentId ?? undefined,
        note:      row.note ?? undefined,
        createdAt: row.createdAt,
    };
}

/**
 * For each player whose userId does NOT already have a CASH_OUT entry in the
 * provided cache, write a CASH_OUT entry using their current stack.
 *
 * Returns only the newly written entries (empty if all players already cashed out).
 * Skips players with stack === 0 who also have no CASH_OUT — they were busted with nothing.
 */
export async function writeSessionEndEntries(
    prisma: PrismaClient,
    roomDbId: string,
    players: { id: string; stack: number }[],
    existingEntries: CachedLedgerEntry[],
    authorId: string  // host userId
): Promise<CachedLedgerEntry[]> {
    const alreadyCashedOut = new Set(
        existingEntries
            .filter(e => e.type === 'CASH_OUT')
            .map(e => e.userId)
    );

    const toWrite = players.filter(p => !alreadyCashedOut.has(p.id));
    if (toWrite.length === 0) return [];

    const created = await prisma.$transaction(async (tx) => {
        const results: CachedLedgerEntry[] = [];
        for (const player of toWrite) {
            // Even busted players (stack=0) get a CASH_OUT record so the
            // ledger is fully self-contained without needing engine state later.
            const row = await tx.ledgerEntry.create({
                data: {
                    roomId:   roomDbId,
                    userId:   player.id,
                    type:     'CASH_OUT',
                    amount:   player.stack,
                    authorId,
                },
            });
            results.push({
                id:        row.id,
                roomId:    row.roomId,
                userId:    row.userId,
                type:      row.type,
                amount:    row.amount,
                authorId:  row.authorId,
                parentId:  row.parentId ?? undefined,
                note:      row.note ?? undefined,
                createdAt: row.createdAt,
            });
        }
        return results;
    });

    return created;
}

/**
 * Load all LedgerEntry rows for a room from DB into CachedLedgerEntry shape.
 * Called once during hydrateRoom(); subsequent reads use the in-memory cache.
 */
export async function loadLedgerEntries(
    prisma: PrismaClient,
    roomDbId: string
): Promise<CachedLedgerEntry[]> {
    const rows = await prisma.ledgerEntry.findMany({
        where: { roomId: roomDbId },
        orderBy: { createdAt: 'asc' },
    });

    return rows.map(row => ({
        id:        row.id,
        roomId:    row.roomId,
        userId:    row.userId,
        type:      row.type,
        amount:    row.amount,
        authorId:  row.authorId,
        parentId:  row.parentId ?? undefined,
        note:      row.note ?? undefined,
        createdAt: row.createdAt,
    }));
}

/**
 * Load all LedgerConfirmation userIds for a room.
 * Called once during hydrateRoom(); confirmations array is updated on each confirm.
 */
export async function loadConfirmations(
    prisma: PrismaClient,
    roomDbId: string
): Promise<string[]> {
    const rows = await prisma.ledgerConfirmation.findMany({
        where: { roomId: roomDbId },
        select: { userId: true },
    });

    return rows.map(r => r.userId);
}

/**
 * Load open LedgerDispute rows for a room's entries.
 * Disputes are mutable (status changes), so they are queried on demand rather than cached.
 */
export async function loadOpenDisputes(
    prisma: PrismaClient,
    roomDbId: string
): Promise<SerializedDispute[]> {
    const rows = await prisma.ledgerDispute.findMany({
        where: {
            ledgerEntry: { roomId: roomDbId },
        },
        orderBy: { createdAt: 'asc' },
    });

    return rows.map(r => ({
        id:              r.id,
        ledgerEntryId:   r.ledgerEntryId,
        raisedByUserId:  r.raisedByUserId,
        note:            r.note,
        status:          r.status as SerializedDispute['status'],
        resolvedByUserId: r.resolvedByUserId ?? undefined,
        resolvedAt:      r.resolvedAt?.toISOString(),
    }));
}

/** Serialized dispute safe for wire transport. */
export interface SerializedDispute {
    id: string;
    ledgerEntryId: string;
    raisedByUserId: string;
    note: string;
    status: 'OPEN' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'DISMISSED';
    resolvedByUserId?: string;
    resolvedAt?: string;
}
