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
import { computeLedgerSnapshot, resolveEntries, LedgerEntry as EngineLedgerEntry } from "@overbet/engine";

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
            // Fetch ALL members regardless of status so that cashed-out (BUSTED)
            // players can still access the ledger they participated in.
            members:       { select: { userId: true, stack: true, status: true } },
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
        // Only ACTIVE players still have chips on the table; BUSTED players have stack=0
        for (const member of room.members) {
            if (member.status === 'ACTIVE') currentStacks[member.userId] = member.stack;
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
            // All members (including BUSTED) for auth check and display names.
            members: { include: { user: { select: { username: true } } } },
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

    // Use resolved entries for totals so they are consistent with Net P&L.
    // computeLedgerSnapshot uses resolveEntries internally; we reuse it here
    // for the individual column totals.
    const engineEntries = room.ledgerEntries.map(toEngineLedgerEntry);
    const isRunning = room.status !== "FINISHED" && room.status !== "SETTLED";

    // For running mode, pass ACTIVE member stacks as unrealized positions.
    const currentStacks: Record<string, number> = {};
    if (isRunning) {
        for (const member of room.members) {
            if (member.status === 'ACTIVE') currentStacks[member.userId] = member.stack;
        }
    }
    const snapshot = computeLedgerSnapshot(engineEntries, currentStacks, isRunning);

    // Aggregate by player — using resolved entries (BUY_IN, ADD_ON, CASH_OUT only)
    const playerTotals: Record<string, { buyIns: number; addOns: number; cashOuts: number }> = {};

    // Re-resolve entries just for the column breakdown
    // (computeLedgerSnapshot doesn't expose the resolved entry list)
    const resolved = resolveEntries(engineEntries);

    for (const e of resolved) {
        const pid = e.playerId;
        if (!playerTotals[pid]) {
            playerTotals[pid] = { buyIns: 0, addOns: 0, cashOuts: 0 };
        }
        if (e.type === "BUY_IN") {
            playerTotals[pid].buyIns += e.amount;
        } else if (e.type === "ADD_ON") {
            playerTotals[pid].addOns += e.amount;
        } else if (e.type === "CASH_OUT") {
            playerTotals[pid].cashOuts += e.amount;
        }
    }

    // Ensure every player in the P&L snapshot has a row, even if totals are zero
    for (const pid of Object.keys(snapshot.pnl)) {
        if (!playerTotals[pid]) {
            playerTotals[pid] = { buyIns: 0, addOns: 0, cashOuts: 0 };
        }
    }

    // Build userId → display name map from members for human-readable CSV.
    // Falls back to raw userId when no username is set (anonymous sessions).
    const nameMap: Record<string, string> = {};
    for (const member of room.members) {
        const u = member.user as { username: string } | null;
        nameMap[member.userId] = u?.username ?? member.userId;
    }

    const header = '"Player","Buy-ins","Add-ons","Cash-outs","Net P&L"';
    const rows = Object.entries(playerTotals).map(([pid, totals]) => {
        const netPnl = snapshot.pnl[pid] ?? 0;
        const displayName = nameMap[pid] ?? pid;
        const quotedName = '"' + displayName.replace(/"/g, '""') + '"';
        return quotedName + ',' + totals.buyIns + ',' + totals.addOns + ',' + totals.cashOuts + ',' + netPnl;
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
    // Running mode: pass active member stacks as unrealized positions.
    const currentStacks: Record<string, number> = {};
    if (isRunning) {
        for (const member of room.members) {
            if (member.status === 'ACTIVE') currentStacks[member.userId] = member.stack;
        }
    }
    const snapshot = computeLedgerSnapshot(engineEntries, currentStacks, isRunning);

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
