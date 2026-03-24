import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
    IntentJoinRoom,
    IntentRequestSnapshot,
    IntentPlayerAction,
    IntentSeatRequest,
    IntentSeatApprove,
    IntentSeatReject,
    EventStateSnapshot,
    EventStateUpdate,
    EventActionConfirmed,
    EventSeatApproved,
    EventError
} from './types';
import { NLHMachine, HandEvent, PokerAction } from '@overbet/engine';
import { PrismaClient } from '@overbet/db';

const prisma = new PrismaClient();

const app = express();

app.get("/", (_req, res) => {
    res.status(200).send("ok");
});

app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Adjust this in production
        methods: ['GET', 'POST']
    }
});

const TEST_TIMER_MODE = process.env.TEST_TIMER_MODE === 'short';
const parsedTurnTimeout = Number(process.env.TURN_TIMEOUT_MS);
const parsedTimeBank = Number(process.env.TIMEBANK_MS);
const parsedAutoStartDelay = Number(process.env.AUTO_START_DELAY_SECONDS);
const DEFAULT_TURN_TIMEOUT_MS = Number.isFinite(parsedTurnTimeout) ? parsedTurnTimeout : (TEST_TIMER_MODE ? 5000 : 30000);
const DEFAULT_TIME_BANK_MS = Number.isFinite(parsedTimeBank) ? parsedTimeBank : (TEST_TIMER_MODE ? 5000 : 30000);
const DEFAULT_AUTO_START_DELAY_SECONDS = Number.isFinite(parsedAutoStartDelay) ? parsedAutoStartDelay : (TEST_TIMER_MODE ? 2 : 5);

type ApprovedRebuy = {
    seatIndex: number;
    stack: number;
    displayName?: string;
};

const playerTimeBanks: Record<string, Record<string, number>> = {};

// Room store mapping room_id to Engine instances
const roomStates: Record<string, {
    engine: NLHMachine;
    seq: number;
    currentHandId?: string;
    dbRoomId?: string;
    hostId?: string;
    pendingSeats: Record<string, { seatIndex: number, stack: number, displayName?: string, requestType?: 'SEAT' | 'REBUY' }>,
    approvedRebuys: Record<string, ApprovedRebuy>;
    turnTimer?: NodeJS.Timeout;
    timeBankTimer?: NodeJS.Timeout;
    turnTimerToken: number;
    autoStartTimer?: NodeJS.Timeout;
    settings?: { turnTimeoutMs: number; timeBankMs: number; autoStartDelay: number };
    isPaused?: boolean;
}> = {};
const roomHydrations: Record<string, Promise<any> | undefined> = {};

if (TEST_TIMER_MODE) {
    console.log(`[gateway] TEST_TIMER_MODE=short (turn=${DEFAULT_TURN_TIMEOUT_MS}ms, timeBank=${DEFAULT_TIME_BANK_MS}ms, autoStart=${DEFAULT_AUTO_START_DELAY_SECONDS}s)`);
}

async function hydrateRoom(roomId: string) {
    const room = await prisma.room.findUnique({
        where: { slug: roomId },
        include: {
            hands: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { events: true }
            }
        }
    });

    if (!room) return null;

    const engine = new NLHMachine();
    let seq = 0;
    let currentHandId = undefined;

    const members = await prisma.roomMember.findMany({
        where: { roomId: room.id, status: 'ACTIVE' },
        include: { user: true }
    });
    const seenIds = new Set<string>();
    const validMembers = members.filter((m: any) => {
        if (!m.userId) return false;
        if (seenIds.has(m.userId)) {
            console.warn(`[hydrateRoom] Duplicate userId ${m.userId} in room ${roomId}, skipping`);
            return false;
        }
        seenIds.add(m.userId);
        return true;
    });
    if (validMembers.length < 2) {
        console.warn(`[hydrateRoom] room=${roomId} only ${validMembers.length} valid members; may block auto-start`);
    }
    console.log(`[hydrateRoom] room=${roomId} hydrating ${validMembers.length} players: ${validMembers.map((m: any) => m.userId).join(', ')}`);
    const usedSeats = new Set<number>();
    const nextFreeSeat = () => {
        for (let s = 0; s <= 9; s++) if (!usedSeats.has(s)) { usedSeats.add(s); return s; }
        return 0;
    };
    validMembers.forEach((m: any) => {
        let seatIndex: number;
        const raw = m.seatIndex;
        if (typeof raw === 'number' && raw >= 0 && raw <= 9 && !usedSeats.has(raw)) {
            usedSeats.add(raw);
            seatIndex = raw;
        } else {
            seatIndex = nextFreeSeat();
        }
        engine.addPlayer({
            id: m.userId,
            displayName: m.user?.username,
            stack: m.stack ?? 0,
            status: 'ACTIVE',
            seatIndex,
            holeCards: [],
            bet: 0,
            hasActed: false
        });
    });

    if (room.hands.length > 0) {
        const lastHand = room.hands[0];
        currentHandId = lastHand.id;
        engine.loadEvents(lastHand.events as any);
        seq = lastHand.events.length > 0 ? Math.max(...lastHand.events.map((e: any) => e.sequence)) : 0;
    }

    // Parse settings from DB
    const dbSettings = room.settings as any;
    const settings = {
        turnTimeoutMs: Number.isFinite(dbSettings?.turnTimeout) ? dbSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
        timeBankMs: Number.isFinite(dbSettings?.timeBank) ? dbSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
        autoStartDelay: Number.isFinite(dbSettings?.autoStartDelay) ? dbSettings.autoStartDelay : DEFAULT_AUTO_START_DELAY_SECONDS,
    };

    const roomData = {
        engine,
        seq,
        currentHandId,
        dbRoomId: room.id,
        hostId: room.hostId,
        pendingSeats: {},
        approvedRebuys: {},
        turnTimerToken: 0,
        settings,
        isPaused: false
    };
    roomStates[roomId] = roomData;
    return roomData;
}

async function getOrHydrateRoom(roomId: string) {
    if (roomStates[roomId]) return roomStates[roomId];
    if (roomHydrations[roomId]) return roomHydrations[roomId];
    roomHydrations[roomId] = hydrateRoom(roomId)
        .finally(() => {
            delete roomHydrations[roomId];
        });
    return roomHydrations[roomId];
}

function emitError(socket: any, code: string, message: string) {
    const err: EventError = { type: 'EVENT_ERROR', schema_version: 1, room_id: '', server_seq: 0, code, message };
    console.error(`[emitError] ${code}: ${message}`);
    socket.emit('EVENT_ERROR', err);
}

function emitErrorToRoom(roomId: string, code: string, message: string) {
    const err: EventError = { type: 'EVENT_ERROR', schema_version: 1, room_id: roomId, server_seq: 0, code, message };
    console.error(`[emitErrorToRoom] room=${roomId} ${code}: ${message}`);
    io.to(roomId).emit('EVENT_ERROR', err);
}

function sanitizeState(state: any, targetUserId: string | null) {
    const sanitized = JSON.parse(JSON.stringify(state));

    // Add helper IDs for the frontend
    if (state.players && state.players.length > 0) {
        if (state.activePlayerIndex !== undefined && state.players[state.activePlayerIndex]) {
            sanitized.activePlayerId = state.players[state.activePlayerIndex].id;
        }
        if (state.dealerIndex !== undefined && state.players[state.dealerIndex]) {
            sanitized.dealerId = state.players[state.dealerIndex].id;
        }
        if (state.sbIndex !== undefined && state.players[state.sbIndex]) {
            sanitized.sbPlayerId = state.players[state.sbIndex].id;
        }
        if (state.bbIndex !== undefined && state.players[state.bbIndex]) {
            sanitized.bbPlayerId = state.players[state.bbIndex].id;
        }
    }

    // 1. Never send the deck
    delete sanitized.deck;

    // 2. Hide hole cards for other players unless in SHOWDOWN
    const isShowdown = sanitized.phase === 'SHOWDOWN' || sanitized.phase === 'CLEANUP';

    if (sanitized.players) {
        sanitized.players.forEach((p: any) => {
            if (!isShowdown && p.id !== targetUserId) {
                p.holeCards = []; // Or hidden placeholder
            }
        });
    }

    return sanitized;
}

function sanitizeEvent(event: HandEvent, targetUserId: string) {
    const sanitized = JSON.parse(JSON.stringify(event));

    if (sanitized.type === 'DEAL_PRIVATE' && sanitized.payload?.dealtCards) {
        const dealt = sanitized.payload.dealtCards;
        Object.keys(dealt).forEach(pId => {
            if (pId !== targetUserId) {
                dealt[pId] = []; // Hide cards for others
            }
        });
    }

    return sanitized;
}

function clearTurnTimer(roomId: string) {
    const roomData = roomStates[roomId];
    if (roomData) {
        roomData.turnTimerToken += 1;
        if (roomData.turnTimer) {
            clearTimeout(roomData.turnTimer);
            roomData.turnTimer = undefined;
        }
        if (roomData.timeBankTimer) {
            clearTimeout(roomData.timeBankTimer);
            roomData.timeBankTimer = undefined;
        }
        delete (roomData as any).timeBankStartedAt;
    }
}

function getEnginePlayersForNextHand(roomData: NonNullable<typeof roomStates[string]>) {
    const state = roomData.engine.getState();
    return state.players.map((player: any) => {
        const approvedRebuy = roomData.approvedRebuys[player.id];
        if (!approvedRebuy) {
            return player;
        }
        return {
            ...player,
            stack: approvedRebuy.stack,
            seatIndex: approvedRebuy.seatIndex,
            displayName: approvedRebuy.displayName ?? player.displayName,
            status: 'ACTIVE',
            bet: 0,
            hasActed: false,
            holeCards: [],
        };
    });
}

function canStartHand(roomData: NonNullable<typeof roomStates[string]>) {
    const eligible = getEnginePlayersForNextHand(roomData).filter((p: any) => p.stack > 0 && !['SITTING_OUT', 'BUSTED'].includes(p.status));
    return eligible.length >= 2;
}

function getNextHandEligiblePlayers(roomData: NonNullable<typeof roomStates[string]>) {
    return getEnginePlayersForNextHand(roomData).filter((p: any) => p.stack > 0 && !['SITTING_OUT', 'BUSTED'].includes(p.status));
}

function applyApprovedRebuys(roomData: NonNullable<typeof roomStates[string]>) {
    const state = roomData.engine.getState();
    for (const [playerId, approvedRebuy] of Object.entries(roomData.approvedRebuys)) {
        const existingPlayer = state.players.find((p: any) => p.id === playerId);
        if (!existingPlayer) {
            continue;
        }
        existingPlayer.stack = approvedRebuy.stack;
        existingPlayer.status = 'ACTIVE';
        existingPlayer.bet = 0;
        existingPlayer.hasActed = false;
        existingPlayer.seatIndex = approvedRebuy.seatIndex;
        existingPlayer.holeCards = [];
        if (approvedRebuy.displayName) existingPlayer.displayName = approvedRebuy.displayName;
    }
    roomData.approvedRebuys = {};
}

async function startTurnTimer(roomId: string) {
    const roomData = roomStates[roomId];
    if (!roomData || roomData.isPaused) return;

    clearTurnTimer(roomId);

    const state = roomData.engine.getState();
    if (!state.phase.endsWith("BETTING")) return;

    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.status !== "ACTIVE") return;

    const settings = roomData.settings || { turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS, timeBankMs: DEFAULT_TIME_BANK_MS, autoStartDelay: DEFAULT_AUTO_START_DELAY_SECONDS };
    const baseMs = settings.turnTimeoutMs;
    const baseExpiresAt = Date.now() + baseMs;
    const turnToken = roomData.turnTimerToken;
    if (!playerTimeBanks[roomId]) playerTimeBanks[roomId] = {};
    if (playerTimeBanks[roomId][activePlayer.id] === undefined) {
        playerTimeBanks[roomId][activePlayer.id] = settings.timeBankMs;
    }
    const timeBankMs = playerTimeBanks[roomId][activePlayer.id];

    io.to(roomId).emit('EVENT_TURN_TIMER', {
        room_id: roomId,
        playerId: activePlayer.id,
        expiresAt: baseExpiresAt,
        total: baseMs,
        phase: 'base',
        timeBankMs,
    });

    roomData.turnTimer = setTimeout(async () => {
        const currentRoomData = roomStates[roomId];
        if (!currentRoomData || currentRoomData.isPaused) return;
        if (currentRoomData.turnTimerToken !== turnToken) return;
        const freshState = currentRoomData.engine.getState();
        if (!freshState.phase.endsWith("BETTING")) return;
        const currentActivePlayer = freshState.players[freshState.activePlayerIndex];
        if (!currentActivePlayer || currentActivePlayer.status !== "ACTIVE") return;
        if (currentActivePlayer.id !== activePlayer.id) return;
        const currentTimeBankMs = playerTimeBanks[roomId]?.[activePlayer.id] ?? 0;
        if (currentTimeBankMs > 0) {
            const timeBankExpiresAt = Date.now() + currentTimeBankMs;
            (currentRoomData as any).timeBankStartedAt = Date.now();

            io.to(roomId).emit('EVENT_TURN_TIMER', {
                room_id: roomId,
                playerId: activePlayer.id,
                expiresAt: timeBankExpiresAt,
                total: currentTimeBankMs,
                phase: 'timebank',
                timeBankMs: currentTimeBankMs,
            });

            currentRoomData.timeBankTimer = setTimeout(async () => {
                const latestRoomData = roomStates[roomId];
                if (!latestRoomData || latestRoomData.isPaused) return;
                if (latestRoomData.turnTimerToken !== turnToken) return;
                const latestState = latestRoomData.engine.getState();
                if (!latestState.phase.endsWith("BETTING")) return;
                const latestActivePlayer = latestState.players[latestState.activePlayerIndex];
                if (!latestActivePlayer || latestActivePlayer.status !== "ACTIVE") return;
                if (latestActivePlayer.id !== activePlayer.id) return;
                if (playerTimeBanks[roomId]) {
                    playerTimeBanks[roomId][activePlayer.id] = 0;
                }
                await autoAct(roomId, latestActivePlayer.id, latestState.currentBet ?? 0);
            }, currentTimeBankMs);
            return;
        }

        console.log(`Base time expired, no time bank for player ${activePlayer.id} in room ${roomId}. Auto-acting.`);
        await autoAct(roomId, currentActivePlayer.id, freshState.currentBet ?? 0);
    }, baseMs);
}

async function autoAct(roomId: string, playerId: string, currentBet: number) {
    const roomData = roomStates[roomId];
    if (!roomData || roomData.isPaused) return;
    const state = roomData.engine.getState();
    if (!state) return;
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    const currentActivePlayer = state.players[state.activePlayerIndex];
    if (!currentActivePlayer || currentActivePlayer.id !== playerId) return;

    const primaryAction: any = player.bet >= currentBet ? { type: 'CHECK' } : { type: 'FOLD' };

    try {
        await performPlayerAction(roomId, playerId, primaryAction);
        return;
    } catch (err: any) {
        const message = err?.message ?? String(err);
        if (primaryAction.type === 'CHECK' && /Cannot check/i.test(message)) {
            try {
                await performPlayerAction(roomId, playerId, { type: 'FOLD' });
                return;
            } catch (fallbackErr: any) {
                const fallbackMessage = fallbackErr?.message ?? String(fallbackErr);
                console.error(`Failed auto-action fallback for player ${playerId} in room ${roomId}:`, fallbackMessage);
                emitErrorToRoom(roomId, 'ERR_AUTO_ACTION', `Timer expired: ${fallbackMessage}`);
            }
        } else {
            console.error(`Failed auto-action for player ${playerId} in room ${roomId}:`, message);
            emitErrorToRoom(roomId, 'ERR_AUTO_ACTION', `Timer expired: ${message}`);
        }
        clearTurnTimer(roomId);
        const rd = roomStates[roomId];
        if (rd?.currentHandId) {
            const refreshedState = rd.engine.getState();
            const sockets = await io.in(roomId).fetchSockets();
            for (const s of sockets) {
                const uId = s.handshake.query.userId as string;
                s.emit('EVENT_STATE_UPDATE', {
                    type: 'EVENT_STATE_UPDATE',
                    schema_version: 1,
                    room_id: roomId,
                    hand_id: rd.currentHandId,
                    server_seq: rd.seq,
                    state: sanitizeState(refreshedState, uId)
                });
            }
            if (refreshedState.phase?.endsWith('BETTING')) startTurnTimer(roomId);
        }
    }
}

async function startHand(roomId: string, schema_version: number = 1) {
    let roomData = roomStates[roomId];
    if (!roomData) {
        roomData = await getOrHydrateRoom(roomId) as any;
    }
    if (!roomData) throw new Error('Room not found');

    const state = roomData.engine.getState();
    if (state.phase !== 'LOBBY' && state.phase !== 'CLEANUP') {
        throw new Error(`Game already in progress (Phase: ${state.phase})`);
    }
    if (!canStartHand(roomData)) {
        throw new Error('Not enough active players to start a hand (need 2+ ACTIVE or ALL_IN)');
    }

    const room = await prisma.room.findUnique({ where: { slug: roomId } });
    if (!room) throw new Error('Room not found in DB');

    // Reload settings in case they changed
    const dbSettings = room.settings as any;
    roomData.settings = {
        turnTimeoutMs: Number.isFinite(dbSettings?.turnTimeout) ? dbSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
        timeBankMs: Number.isFinite(dbSettings?.timeBank) ? dbSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
        autoStartDelay: Number.isFinite(dbSettings?.autoStartDelay) ? dbSettings.autoStartDelay : DEFAULT_AUTO_START_DELAY_SECONDS,
    };
    applyApprovedRebuys(roomData);
    playerTimeBanks[roomId] = {};

    const hand = await prisma.hand.create({
        data: {
            roomId: room.id,
            metadata: {}
        }
    });
    roomData.currentHandId = hand.id;

    const engineEvents = roomData.engine.startHand({
        smallBlind: dbSettings?.smallBlind ?? 10,
        bigBlind: dbSettings?.bigBlind ?? 20,
        ante: dbSettings?.ante ?? 0,
    });

    const sockets = await io.in(roomId).fetchSockets();

    for (const ev of engineEvents) {
        roomData.seq++;
        await prisma.handEvent.upsert({
            where: {
                handId_sequence: {
                    handId: hand.id,
                    sequence: roomData.seq
                }
            },
            update: {
                type: ev.type,
                payload: ev.payload
            },
            create: {
                handId: hand.id,
                sequence: roomData.seq,
                type: ev.type,
                payload: ev.payload
            }
        });

        for (const s of sockets) {
            const uId = s.handshake.query.userId as string;
            s.emit('EVENT_HAND_LOG', {
                ...sanitizeEvent(ev, uId),
                room_id: roomId,
                hand_id: hand.id,
                server_seq: roomData.seq
            });
        }
    }

    for (const s of sockets) {
        const uId = s.handshake.query.userId as string;
        s.emit('EVENT_STATE_UPDATE', {
            type: 'EVENT_STATE_UPDATE',
            schema_version: schema_version || 1,
            room_id: roomId,
            hand_id: hand.id,
            server_seq: roomData.seq,
            state: sanitizeState(roomData.engine.getState(), uId)
        });
    }

    startTurnTimer(roomId);
}

async function performPlayerAction(roomId: string, userId: string, action: PokerAction, schema_version: number = 1, client_msg_id?: string, socket?: any) {
    let roomData = roomStates[roomId];
    if (!roomData || !roomData.currentHandId) {
        console.error(`[performPlayerAction] room=${roomId} userId=${userId}: Hand has not started (roomData=${!!roomData})`);
        throw new Error('Hand has not started');
    }
    if (roomData.isPaused) throw new Error('Game is paused');

    if (roomData.timeBankTimer && playerTimeBanks[roomId]?.[userId] !== undefined) {
        const startedAt = (roomData as any).timeBankStartedAt as number | undefined;
        if (startedAt) {
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(0, playerTimeBanks[roomId][userId] - elapsed);
            playerTimeBanks[roomId][userId] = remaining;
        }
    }

    clearTurnTimer(roomId);

    const stateBefore = roomData.engine.getState();
    const playerInHand = stateBefore.players.some((p: any) => p.id === userId);
    if (!playerInHand) {
        console.error(`[performPlayerAction] userId ${userId} not in hand. Engine player IDs: ${stateBefore.players.map((p: any) => p.id).join(', ')}`);
        throw new Error('You are not seated in this hand. Try refreshing the page.');
    }
    const activePlayerId = stateBefore.players[stateBefore.activePlayerIndex]?.id;
    if (activePlayerId !== userId) {
        console.error(`[performPlayerAction] userId mismatch: expected ${activePlayerId}, got ${userId}`);
    }
    const engineEvents = roomData.engine.handleAction(userId, action);

    for (const ev of engineEvents) {
        roomData.seq++;
        await prisma.handEvent.upsert({
            where: {
                handId_sequence: {
                    handId: roomData.currentHandId,
                    sequence: roomData.seq
                }
            },
            update: {
                type: ev.type,
                payload: ev.payload as any
            },
            create: {
                handId: roomData.currentHandId,
                sequence: roomData.seq,
                type: ev.type,
                payload: ev.payload as any
            }
        });

        io.to(roomId).emit('EVENT_HAND_LOG', {
            ...ev,
            room_id: roomId,
            hand_id: roomData.currentHandId,
            server_seq: roomData.seq
        });
    }

    if (client_msg_id && socket) {
        const ackEvent: EventActionConfirmed = {
            type: 'EVENT_ACTION_CONFIRMED',
            schema_version,
            room_id: roomId,
            hand_id: roomData.currentHandId,
            client_msg_id,
            server_seq: roomData.seq,
            server_ts: Date.now()
        };
        socket.emit('EVENT_ACTION_CONFIRMED', ackEvent);
    }

    const state = roomData.engine.getState();
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
        const uId = s.handshake.query.userId as string;
        s.emit('EVENT_STATE_UPDATE', {
            type: 'EVENT_STATE_UPDATE',
            schema_version,
            room_id: roomId,
            hand_id: roomData.currentHandId,
            server_seq: roomData.seq,
            state: sanitizeState(state, uId)
        });
    }

    if (state.phase === 'CLEANUP') {
        const autoStartDelay = (roomData.settings?.autoStartDelay ?? DEFAULT_AUTO_START_DELAY_SECONDS) * 1000;
        console.log(`Hand finished. Auto-starting next hand in ${autoStartDelay}ms...`);
        roomData.autoStartTimer = setTimeout(async () => {
            try {
                if (roomData.isPaused) {
                    console.log(`Room ${roomId} is paused. Skipping auto-start.`);
                    return;
                }
                const currentState = roomData.engine.getState();
                if (canStartHand(roomData)) {
                    await startHand(roomId, schema_version);
                } else {
                    const byStatus = currentState.players.reduce((acc: Record<string, number>, p: any) => {
                        acc[p.status] = (acc[p.status] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    const canStartNow = currentState.players.filter((p: any) => ['ACTIVE', 'ALL_IN'].includes(p.status));
                    const canStartAfterReset = getNextHandEligiblePlayers(roomData);
                    console.log(
                        `[auto-start-blocked] room=${roomId} phase=${currentState.phase} ` +
                        `activeOrAllIn=${canStartNow.length} resetEligible=${canStartAfterReset.length} ` +
                        `players=${JSON.stringify(currentState.players.map((p: any) => ({ id: p.id, status: p.status, stack: p.stack, bet: p.bet, hasActed: p.hasActed })))} ` +
                        `statusCounts=${JSON.stringify(byStatus)}`
                    );
                    console.log("Not enough eligible players (ACTIVE/ALL_IN) to auto-start next hand.");
                    io.to(roomId).emit('EVENT_STATE_UPDATE', { room_id: roomId, state: sanitizeState(currentState, null), server_ts: Date.now() });
                }
            } catch (err) {
                console.error("Failed to auto-start hand:", err);
                const state = roomData?.engine?.getState?.();
                if (state) {
                    io.to(roomId).emit('EVENT_STATE_UPDATE', { room_id: roomId, state: sanitizeState(state, null), server_ts: Date.now() });
                }
            }
        }, autoStartDelay);
    } else {
        startTurnTimer(roomId);
    }
}

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;
    const roomId = socket.handshake.query.roomId as string;
    console.log(`Socket connected: ${socket.id} (User: ${userId}, Room: ${roomId})`);

    if (!userId) {
        console.error("Missing userId in connection query");
        return socket.disconnect();
    }

    socket.on('INTENT_JOIN_ROOM', async (data: IntentJoinRoom) => {
        console.log(`Socket ${socket.id} joining room ${data.room_id}`);
        socket.join(data.room_id);
    });

    socket.on('INTENT_REQUEST_SNAPSHOT', async (data: IntentRequestSnapshot) => {
        console.log(`Snapshot requested by ${socket.id} for room ${data.room_id}`);
        let roomData = roomStates[data.room_id];

        if (!roomData) {
            roomData = await getOrHydrateRoom(data.room_id) as any;
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        }

        const room = await prisma.room.findUnique({ where: { slug: data.room_id } });

        socket.emit('ROOM_SNAPSHOT', {
            room,
            players: roomData.engine.getState().players.map((p: any) => ({
                id: p.id,
                username: p.displayName || `Player_${p.id.substring(0, 4)}`,
                chips: p.stack,
                status: p.status,
                seatIndex: p.seatIndex
            })),
            pendingRequests: Object.entries(roomData.pendingSeats).map(([pid, req]) => ({
                playerId: pid,
                ...req
            })),
            isPaused: !!roomData.isPaused
        });

        const snapshotEvent: EventStateSnapshot = {
            type: 'EVENT_STATE_SNAPSHOT',
            schema_version: data.schema_version,
            room_id: data.room_id,
            hand_id: roomData.currentHandId,
            server_seq: roomData.seq,
            state: sanitizeState(roomData.engine.getState(), userId)
        };
        socket.emit('EVENT_STATE_SNAPSHOT', snapshotEvent);
    });

    socket.on('INTENT_SEAT_REQUEST', async (data: IntentSeatRequest) => {
        let roomData = roomStates[data.room_id];
        if (!roomData) {
            roomData = await getOrHydrateRoom(data.room_id) as any;
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        }
        console.log(`[INTENT_SEAT_REQUEST] room=${data.room_id} user=${userId} seat=${data.seatIndex} stack=${data.stack}`);

        try {
            // Update the user's display name in the DB if they provided one
            if (data.displayName) {
                await prisma.user.upsert({
                    where: { id: userId },
                    update: { username: data.displayName },
                    create: { id: userId, username: data.displayName }
                });
            }

            const state = roomData.engine.getState();
            const existingPlayer = state.players.find((p: any) => p.id === userId);
            const alreadySeated = !!existingPlayer;
            const canRequestRebuy = !!existingPlayer && (existingPlayer.stack ?? 0) <= 0;

            if (alreadySeated && !canRequestRebuy) {
                throw new Error('Already seated at the table');
            }

            if (data.seatIndex < 0 || data.seatIndex > 9) throw new Error('Invalid seat index');

            if (canRequestRebuy && existingPlayer && existingPlayer.seatIndex !== data.seatIndex) {
                throw new Error('Re-buy request must use your existing seat');
            }

            const isTaken = state.players.some((p: any) => p.seatIndex === data.seatIndex);
            if (isTaken && (!existingPlayer || existingPlayer.seatIndex !== data.seatIndex)) {
                throw new Error('Seat already taken');
            }

            const requestType: 'SEAT' | 'REBUY' = canRequestRebuy ? 'REBUY' : 'SEAT';

            roomData.pendingSeats[userId] = {
                seatIndex: data.seatIndex,
                stack: data.stack,
                displayName: data.displayName,
                requestType
            };
            io.to(data.room_id).emit('EVENT_SEAT_REQUEST_PENDING', {
                playerId: userId,
                seatIndex: data.seatIndex,
                stack: data.stack,
                displayName: data.displayName,
                requestType
            });
        } catch (err: any) {
            emitError(socket, 'ERR_SEAT_REQUEST', err.message);
        }
    });

    socket.on('INTENT_SEAT_APPROVE', async (data: IntentSeatApprove) => {
        let roomData = roomStates[data.room_id];
        if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        console.log(`[INTENT_SEAT_APPROVE] room=${data.room_id} host=${userId} target=${data.targetPlayerId}`);

        // BUG-05: Only the host may approve seat requests
        if (roomData.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can approve seat requests');

        const pending = roomData.pendingSeats[data.targetPlayerId];
        if (!pending) return emitError(socket, 'ERR_NO_PENDING_REQUEST', 'No pending request found for player');

        try {
            const state = roomData.engine.getState() as any;
            const existingEnginePlayer = state.players.find((p: any) => p.id === data.targetPlayerId);
            const isRebuy = pending.requestType === 'REBUY' && !!existingEnginePlayer;

            if (isRebuy && existingEnginePlayer) {
                existingEnginePlayer.stack = pending.stack;
                existingEnginePlayer.bet = 0;
                existingEnginePlayer.hasActed = false;
                existingEnginePlayer.seatIndex = pending.seatIndex;
                existingEnginePlayer.holeCards = [];
                if (pending.displayName) existingEnginePlayer.displayName = pending.displayName;
                roomData.approvedRebuys[data.targetPlayerId] = {
                    seatIndex: pending.seatIndex,
                    stack: pending.stack,
                    displayName: pending.displayName,
                };
            } else {
                roomData.engine.addPlayer({
                    id: data.targetPlayerId,
                    displayName: pending.displayName,
                    stack: pending.stack,
                    status: 'ACTIVE',
                    seatIndex: pending.seatIndex,
                    holeCards: [],
                    bet: 0,
                    hasActed: false
                });
            }

            // BUG-06: Persist the approved seat to the database so it survives gateway restarts
            await prisma.user.upsert({
                where: { id: data.targetPlayerId },
                update: {},
                create: { id: data.targetPlayerId, username: pending.displayName || `Player_${data.targetPlayerId.substring(0, 4)}` }
            });
            await prisma.roomMember.upsert({
                where: { roomId_userId: { roomId: data.room_id, userId: data.targetPlayerId } },
                update: { seatIndex: pending.seatIndex, stack: pending.stack, status: 'ACTIVE' },
                create: { roomId: data.room_id, userId: data.targetPlayerId, seatIndex: pending.seatIndex, stack: pending.stack, status: 'ACTIVE' }
            });

            delete roomData.pendingSeats[data.targetPlayerId];
            console.log(`[INTENT_SEAT_APPROVE] room=${data.room_id} approved=${data.targetPlayerId} pendingLeft=${Object.keys(roomData.pendingSeats).length}`);

            roomData.seq++;

            const approvedEvent: EventSeatApproved = {
                type: 'EVENT_SEAT_APPROVED',
                schema_version: data.schema_version,
                room_id: data.room_id,
                server_seq: roomData.seq,
                playerId: data.targetPlayerId,
                displayName: pending.displayName, // Add displayName to event
                seatIndex: pending.seatIndex,
                stack: pending.stack
            };

            io.to(data.room_id).emit('EVENT_SEAT_APPROVED', approvedEvent);

            const sockets = await io.in(data.room_id).fetchSockets();
            for (const s of sockets) {
                const uId = s.handshake.query.userId as string;
                s.emit('EVENT_STATE_UPDATE', {
                    type: 'EVENT_STATE_UPDATE',
                    schema_version: data.schema_version,
                    room_id: data.room_id,
                    server_seq: roomData.seq,
                    state: sanitizeState(roomData.engine.getState(), uId)
                });
            }
        } catch (err: any) {
            emitError(socket, 'ERR_SEAT_APPROVE', err.message);
        }
    });

    socket.on('INTENT_SEAT_REJECT', async (data: IntentSeatReject) => {
        let roomData = roomStates[data.room_id];
        if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

        const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
        if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can reject seat requests');

        delete roomData.pendingSeats[data.targetPlayerId];
        // Could emit a rejection to the specific player here
    });

    socket.on('INTENT_START_GAME', async (data: any) => {
        try {
            // BUG-04: Only the host may start a hand
            let roomData = roomStates[data.room_id];
            if (!roomData) {
                roomData = await getOrHydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
            if (roomData.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can start the game');

            roomData.isPaused = false;
            await startHand(data.room_id, data.schema_version);
        } catch (err: any) {
            emitError(socket, 'ERR_START_GAME', err.message);
        }
    });

    socket.on('INTENT_PAUSE_GAME', async (data: any) => {
        try {
            let roomData = roomStates[data.room_id];
            if (!roomData) {
                roomData = await getOrHydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            if (roomData.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can pause the game');

            roomData.isPaused = true;
            clearTurnTimer(data.room_id);

            io.to(data.room_id).emit('EVENT_GAME_PAUSED', {
                room_id: data.room_id,
                schema_version: data.schema_version || 1,
                pausedBy: userId,
                server_ts: Date.now()
            });
        } catch (err: any) {
            emitError(socket, 'ERR_PAUSE_GAME', err.message);
        }
    });

    socket.on('INTENT_RESUME_GAME', async (data: any) => {
        try {
            let roomData = roomStates[data.room_id];
            if (!roomData) {
                roomData = await getOrHydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            if (roomData.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can resume the game');

            roomData.isPaused = false;
            const state = roomData.engine.getState();
            if (state.phase && state.phase.endsWith("BETTING")) {
                startTurnTimer(data.room_id);
            }

            io.to(data.room_id).emit('EVENT_GAME_RESUMED', {
                room_id: data.room_id,
                schema_version: data.schema_version || 1,
                resumedBy: userId,
                server_ts: Date.now()
            });
        } catch (err: any) {
            emitError(socket, 'ERR_RESUME_GAME', err.message);
        }
    });

    socket.on('INTENT_UPDATE_SETTINGS', async (data: any) => {
        // Only host can update settings
        try {
            let roomData = roomStates[data.room_id];
            if (!roomData) {
                roomData = await getOrHydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            if (roomData.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can update settings');

            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            const newSettings = {
                ...(room.settings as any || {}),
                ...(data.settings || {})
            };

            await prisma.room.update({
                where: { slug: data.room_id },
                data: { settings: newSettings }
            });

            // Update in-memory cache
            if (roomData) {
                roomData.settings = {
                    turnTimeoutMs: Number.isFinite(newSettings.turnTimeout) ? newSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
                    timeBankMs: Number.isFinite(newSettings.timeBank) ? newSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
                    autoStartDelay: Number.isFinite(newSettings.autoStartDelay) ? newSettings.autoStartDelay : DEFAULT_AUTO_START_DELAY_SECONDS,
                };
            }

            // Broadcast updated settings to all clients in room
            io.to(data.room_id).emit('EVENT_SETTINGS_UPDATED', { settings: newSettings });
        } catch (err: any) {
            emitError(socket, 'ERR_UPDATE_SETTINGS', err.message);
        }
    });

    socket.on('INTENT_PLAYER_ACTION', async (data: IntentPlayerAction) => {
        console.log(`[INTENT_PLAYER_ACTION] received room=${data.room_id} userId=${userId} action=${JSON.stringify(data.action)}`);
        try {
            await performPlayerAction(data.room_id, userId, data.action, data.schema_version, data.client_msg_id, socket);
            console.log(`[INTENT_PLAYER_ACTION] success room=${data.room_id} userId=${userId}`);
        } catch (err: any) {
            console.error(`[INTENT_PLAYER_ACTION] failed room=${data.room_id} userId=${userId}:`, err.message);
            emitError(socket, 'ERR_PLAYER_ACTION', err.message);
            const roomData = roomStates[data.room_id];
            if (roomData?.currentHandId) {
                const state = roomData.engine.getState();
                const sockets = await io.in(data.room_id).fetchSockets();
                for (const s of sockets) {
                    const uId = s.handshake.query.userId as string;
                    s.emit('EVENT_STATE_UPDATE', {
                        type: 'EVENT_STATE_UPDATE',
                        schema_version: data.schema_version ?? 1,
                        room_id: data.room_id,
                        hand_id: roomData.currentHandId,
                        server_seq: roomData.seq,
                        state: sanitizeState(state, uId)
                    });
                }
                if (state.phase?.endsWith('BETTING')) startTurnTimer(data.room_id);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Gateway realtime server listening on port ${PORT}`);
});


