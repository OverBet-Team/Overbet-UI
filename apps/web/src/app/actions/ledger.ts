"use server";

/**
 * Server actions for the ledger system.
 *
 * getLedger: authoritative read from DB, used for SSR page load and non-socket contexts.
 *   Live updates during a session come via EVENT_LEDGER_UPDATE socket events.
 *
 * export*: generate different export formats from the final ledger.
 *
 * All actions use the @overbet/db singleton — never construct a new PrismaClient here.
 * Computation is delegated to computeLedgerSnapshot from @overbet/engine (pure, no I/O).
 */

import { prisma } from "@overbet/db";
import { computeLedgerSnapshot, LedgerEntry as EngineLedgerEntry } from "@overbet/engine";

// --- Shared types (mirrored from gateway/types.ts to avoid cross-app imports) ---

export interface SettlementTransfer {
    from: string;
    to: string;
    amount: number;
}

export interface SerializedLedgerEntry {
    id: string;
    userId: string;
    type: string;
    amount: number;
    authorId: string;
    parentId?: string;
    note?: string;
    createdAt: string;
}

export interface SerializedDispute {
    id: string;
    ledgerEntryId: string;
    raisedByUserId: string;
    note: string;
    status: 'OPEN' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'DISMISSED';
    resolvedByUserId?: string;
    resolvedAt?: string;
}

export interface LedgerPayload {
    entries: SerializedLedgerEntry[];
    pnl: Record<string, number>;
    settlement: SettlementTransfer[];
    confirmations: string[];
    disputes: SerializedDispute[];
    roomStatus: string;
    isRunning: boolean;
    zeroSumError?: number;
}

// --- Helpers ---

function toEngineLedgerEntry(row: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    parentId: string | null;
    createdAt: Date;
}): EngineLedgerEntry {
    return {
        id:        row.id,
        playerId:  row.userId,
        amount:    row.amount,
        type:      row.type as EngineLedgerEntry['type'],
        parentId:  row.parentId ?? undefined,
        timestamp: row.createdAt.getTime(),
    };
}

// --- Server Actions ---

/**
 * Load the full ledger for a room by slug.
 * Used by the /ledger/[slug] read-only page.
 *
 * Running mode (status=IN_PROGRESS): includes current RoomMember stacks as unrealized position.
 * Final mode (status=FINISHED|SETTLED): all positions captured in CASH_OUT entries.
 *
 * Returns null if the room does not exist.
 */
export async function getLedger(roomSlug: string, userId?: string): Promise<LedgerPayload | null> {
    const room = await prisma.room.findUnique({
        where: { slug: roomSlug },
        include: {
            ledgerEntries: { orderBy: { createdAt: "asc" } },
            members:       true,
            ledgerConfirmations: { select: { userId: true } },
        },
    });

    if (!room) return null;

    if (userId) {
        const isMember = room.members.some(m => m.userId === userId);
        const isHost = room.hostId === userId;
        if (!isMember && !isHost) {
            console.warn(`[getLedger] userId ${userId} is not a member of room ${roomSlug}`);
            return null;
        }
    }

    const isRunning = room.status !== "FINISHED" && room.status !== "SETTLED";

    // For running mode, use RoomMember.stack as the current unrealized position
    const currentStacks: Record<string, number> = {};
    if (isRunning) {
        for (const member of room.members) {
            currentStacks[member.userId] = member.stack;
        }
    }

    const engineEntries = room.ledgerEntries.map(toEngineLedgerEntry);
    const snapshot = computeLedgerSnapshot(engineEntries, currentStacks, isRunning);

    const disputes = await prisma.ledgerDispute.findMany({
        where: { ledgerEntry: { roomId: room.id } },
        orderBy: { createdAt: "asc" },
    });

    return {
        entries: room.ledgerEntries.map(e => ({
            id:        e.id,
            userId:    e.userId,
            type:      e.type,
            amount:    e.amount,
            authorId:  e.authorId,
            parentId:  e.parentId ?? undefined,
            note:      e.note ?? undefined,
            createdAt: e.createdAt.toISOString(),
        })),
        pnl:           snapshot.pnl,
        settlement:    snapshot.settlement,
        confirmations: room.ledgerConfirmations.map(c => c.userId),
        disputes: disputes.map(d => ({
            id:              d.id,
            ledgerEntryId:   d.ledgerEntryId,
            raisedByUserId:  d.raisedByUserId,
            note:            d.note,
            status:          d.status as SerializedDispute['status'],
            resolvedByUserId: d.resolvedByUserId ?? undefined,
            resolvedAt:      d.resolvedAt?.toISOString(),
        })),
        roomStatus:   room.status,
        isRunning,
        zeroSumError: snapshot.zeroSumError,
    };
}

/**
 * Export ledger as CSV.
 * Columns: Player, Buy-ins, Add-ons, Cash-outs, Net P&L
 * One row per player; amounts aggregated from immutable entries.
 * Returns null if room not found.
 */
export async function exportLedgerCSV(roomSlug: string, userId?: string): Promise<string | null> {
    const room = await prisma.room.findUnique({
        where: { slug: roomSlug },
        include: {
            ledgerEntries: { orderBy: { createdAt: "asc" } },
            members: { include: { user: true } },
        },
    });
    if (!room) return null;

    if (userId) {
        const isMember = room.members.some(m => m.userId === userId);
        const isHost = room.hostId === userId;
        if (!isMember && !isHost) {
            console.warn(`[exportLedgerCSV] userId ${userId} is not a member of room ${roomSlug}`);
            return null;
        }
    }

    // Aggregate by player — only base types contribute to totals
    const playerTotals: Record<string, { buyIns: number; addOns: number; cashOuts: number }> = {};

    for (const e of room.ledgerEntries) {
        if (!playerTotals[e.userId]) {
            playerTotals[e.userId] = { buyIns: 0, addOns: 0, cashOuts: 0 };
        }
        if (e.type === "BUY_IN") {
            playerTotals[e.userId].buyIns += e.amount;
        } else if (e.type === "ADD_ON") {
            playerTotals[e.userId].addOns += e.amount;
        } else if (e.type === "CASH_OUT") {
            playerTotals[e.userId].cashOuts += e.amount;
        }
        // ADJUSTMENT/VOID are captured through computeLedgerSnapshot for P&L,
        // but the raw CSV shows base entry totals for auditability
    }

    const isRunning = room.status !== "FINISHED" && room.status !== "SETTLED";
    const engineEntries = room.ledgerEntries.map(toEngineLedgerEntry);
    const snapshot = computeLedgerSnapshot(engineEntries, {}, isRunning);

    // Build userId → displayName map for CSV export
    const nameMap: Record<string, string> = {};
    for (const member of room.members) {
        const user = member.user as { username: string } | null;
        nameMap[member.userId] = user?.username ?? member.userId;
    }

    const header = '"Player","Buy-ins","Add-ons","Cash-outs","Net P&L"';
    const rows = Object.entries(playerTotals).map(([userId, totals]) => {
        const netPnl = snapshot.pnl[userId] ?? 0;
        const displayName = nameMap[userId] ?? userId;
        // Quote displayName in case it contains commas
        return `"${displayName.replace(/"/g, '""')}",${totals.buyIns},${totals.addOns},${totals.cashOuts},${netPnl}`;
    });

    return [header, ...rows].join("\n");
}

/**
 * Full JSON export — all entries with timestamps, P&L, settlement.
 * Used for provably-fair audit bundle.
 * Returns null if room not found.
 */
export async function exportLedgerJSON(roomSlug: string, userId?: string): Promise<string | null> {
    const payload = await getLedger(roomSlug, userId);
    if (!payload) return null;

    return JSON.stringify(
        {
            roomSlug,
            exportedAt: new Date().toISOString(),
            ...payload,
        },
        null,
        2
    );
}

/**
 * Plain-text payment list. Format: "Alice pays Bob 500"
 * Generated from the settlement matrix.
 * Returns null if room not found.
 */
export async function exportLedgerText(roomSlug: string, userId?: string): Promise<string | null> {
    const room = await prisma.room.findUnique({
        where: { slug: roomSlug },
        include: {
            ledgerEntries: { orderBy: { createdAt: "asc" } },
            members: { include: { user: true } },
        },
    });
    if (!room) return null;

    if (userId) {
        const isMember = room.members.some(m => m.userId === userId);
        const isHost = room.hostId === userId;
        if (!isMember && !isHost) {
            console.warn(`[exportLedgerText] userId ${userId} is not a member of room ${roomSlug}`);
            return null;
        }
    }

    // Build userId → displayName map for readable output
    const nameMap: Record<string, string> = {};
    for (const member of room.members) {
        const user = member.user as { username: string } | null;
        nameMap[member.userId] = user?.username ?? member.userId;
    }

    const isRunning = room.status !== "FINISHED" && room.status !== "SETTLED";
    const engineEntries = room.ledgerEntries.map(toEngineLedgerEntry);
    const snapshot = computeLedgerSnapshot(engineEntries, {}, isRunning);

    if (snapshot.settlement.length === 0) {
        return "No payments required — all players are settled.";
    }

    const lines = snapshot.settlement.map(t => {
        const fromName = nameMap[t.from] ?? t.from;
        const toName   = nameMap[t.to]   ?? t.to;
        return `${fromName} pays ${toName} ${t.amount}`;
    });

    const header = `Settlement for room ${roomSlug} (${new Date().toISOString().slice(0, 10)})`;
    const separator = "-".repeat(header.length);

    return [header, separator, ...lines].join("\n");
}
