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
import { NLHMachine, HandEvent } from '@overbet/engine';
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

const DEFAULT_TURN_TIMEOUT_MS = 30000;
const DEFAULT_TIME_BANK_MS = 30000;
const DEFAULT_AUTO_START_DELAY = 5000;

// Per-player time bank balances for current hand (in-memory)
const playerTimeBanks: Record<string, Record<string, number>> = {}; // roomId -> playerId -> ms remaining

// Room store mapping room_id to Engine instances
const roomStates: Record<string, {
    engine: NLHMachine;
    seq: number;
    currentHandId?: string;
    dbRoomId?: string;
    pendingSeats: Record<string, { seatIndex: number, stack: number, displayName?: string, requestType?: 'SEAT' | 'REBUY' }>,
    turnTimer?: NodeJS.Timeout;
    timeBankTimer?: NodeJS.Timeout;
    autoStartTimer?: NodeJS.Timeout;
    settings?: { turnTimeoutMs: number; timeBankMs: number; autoStartDelay: number };
    isPaused?: boolean;
}> = {};

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
        const seatIndex = m.seatIndex ?? -1;
        if (seatIndex < 0 || seatIndex > 9) {
            console.warn(`[hydrateRoom] Invalid seatIndex ${seatIndex} for userId ${m.userId}, skipping`);
            return false;
        }
        return true;
    });
    console.log(`[hydrateRoom] room=${roomId} hydrating ${validMembers.length} players: ${validMembers.map((m: any) => m.userId).join(', ')}`);
    validMembers.forEach((m: any) => {
        engine.addPlayer({
            id: m.userId,
            displayName: m.user?.username,
            stack: m.stack ?? 0,
            status: 'ACTIVE',
            seatIndex: m.seatIndex ?? 0,
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
        turnTimeoutMs: dbSettings?.turnTimeout ? dbSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
        timeBankMs: dbSettings?.timeBank ? dbSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
        autoStartDelay: dbSettings?.autoStartDelay ?? 5,
    };

    const roomData = { engine, seq, currentHandId, dbRoomId: room.id, pendingSeats: {}, settings, isPaused: false };
    roomStates[roomId] = roomData;
    return roomData;
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

function sanitizeState(state: any, targetUserId: string) {
    const sanitized = JSON.parse(JSON.stringify(state));

    // Add helper IDs for the frontend
    if (state.players && state.players.length > 0) {
        if (state.activePlayerIndex !== undefined && state.players[state.activePlayerIndex]) {
            sanitized.activePlayerId = state.players[state.activePlayerIndex].id;
        }
        if (state.dealerIndex !== undefined && state.players[state.dealerIndex]) {
            sanitized.dealerId = state.players[state.dealerIndex].id;
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

function sanitizeEvent(event: any, targetUserId: string) {
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
        if (roomData.turnTimer) {
            clearTimeout(roomData.turnTimer);
            roomData.turnTimer = undefined;
        }
        if (roomData.timeBankTimer) {
            clearTimeout(roomData.timeBankTimer);
            roomData.timeBankTimer = undefined;
        }
    }
}

async function startTurnTimer(roomId: string) {
    const roomData = roomStates[roomId];
    if (!roomData || roomData.isPaused) return;

    clearTurnTimer(roomId);

    const state = roomData.engine.getState();
    if (!state.phase.endsWith("BETTING")) return;

    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.status !== "ACTIVE") return;

    // Load settings
    const settings = roomData.settings || { turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS, timeBankMs: DEFAULT_TIME_BANK_MS, autoStartDelay: DEFAULT_AUTO_START_DELAY / 1000 };
    const baseMs = settings.turnTimeoutMs;

    // Initialize time bank for this player in this room if needed
    if (!playerTimeBanks[roomId]) playerTimeBanks[roomId] = {};
    if (playerTimeBanks[roomId][activePlayer.id] === undefined) {
        playerTimeBanks[roomId][activePlayer.id] = settings.timeBankMs;
    }
    const timeBankMs = playerTimeBanks[roomId][activePlayer.id];

    const baseExpiresAt = Date.now() + baseMs;

    // Emit timer start — base phase
    io.to(roomId).emit('EVENT_TURN_TIMER', {
        room_id: roomId,
        playerId: activePlayer.id,
        expiresAt: baseExpiresAt,
        total: baseMs,
        phase: 'base',
        timeBankMs,
    });

    // Stage 1: base time expires → switch to time bank
    roomData.turnTimer = setTimeout(async () => {
        const currentTimeBankMs = playerTimeBanks[roomId]?.[activePlayer.id] ?? 0;

        if (currentTimeBankMs > 0) {
            // Enter time bank phase
            const timeBankExpiresAt = Date.now() + currentTimeBankMs;
            const timeBankStartedAt = Date.now();
            // Store start time so performPlayerAction can compute exact deduction
            (roomData as any).timeBankStartedAt = timeBankStartedAt;

            io.to(roomId).emit('EVENT_TURN_TIMER', {
                room_id: roomId,
                playerId: activePlayer.id,
                expiresAt: timeBankExpiresAt,
                total: currentTimeBankMs,
                phase: 'timebank',
                timeBankMs: currentTimeBankMs,
            });

            // Stage 2: time bank expires → auto-act (use fresh engine state for currentBet)
            roomData.timeBankTimer = setTimeout(async () => {
                if (playerTimeBanks[roomId]) {
                    playerTimeBanks[roomId][activePlayer.id] = 0;
                }
                console.log(`Time bank exhausted for player ${activePlayer.id} in room ${roomId}. Auto-acting.`);
                const freshState = roomStates[roomId]?.engine?.getState();
                const currentBet = freshState?.currentBet ?? 0;
                await autoAct(roomId, activePlayer.id, currentBet);
            }, currentTimeBankMs);

        } else {
            // No time bank left — auto-act immediately (use fresh engine state for currentBet)
            console.log(`Base time expired, no time bank for player ${activePlayer.id} in room ${roomId}. Auto-acting.`);
            const freshState = roomStates[roomId]?.engine?.getState();
            const currentBet = freshState?.currentBet ?? 0;
            await autoAct(roomId, activePlayer.id, currentBet);
        }
    }, baseMs);
}

async function autoAct(roomId: string, playerId: string, currentBet: number) {
    const roomData = roomStates[roomId];
    if (!roomData || roomData.isPaused) return;
    const state = roomData.engine.getState();
    if (!state) return;
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    // Check or fold
    const action: any = player.bet >= currentBet ? { type: 'CHECK' } : { type: 'FOLD' };

    try {
        await performPlayerAction(roomId, playerId, action);
    } catch (err: any) {
        const message = err?.message ?? String(err);
        console.error(`Failed auto-action for player ${playerId} in room ${roomId}:`, message);
        emitErrorToRoom(roomId, 'ERR_AUTO_ACTION', `Timer expired: ${message}`);
    }
}

async function startHand(roomId: string, schema_version: number = 1) {
    let roomData = roomStates[roomId];
    if (!roomData) {
        roomData = await hydrateRoom(roomId) as any;
    }
    if (!roomData) throw new Error('Room not found');

    const state = roomData.engine.getState();
    if (state.phase !== 'LOBBY' && state.phase !== 'CLEANUP') {
        throw new Error(`Game already in progress (Phase: ${state.phase})`);
    }

    const room = await prisma.room.findUnique({ where: { slug: roomId } });
    if (!room) throw new Error('Room not found in DB');

    // Reload settings in case they changed
    const dbSettings = room.settings as any;
    roomData.settings = {
        turnTimeoutMs: dbSettings?.turnTimeout ? dbSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
        timeBankMs: dbSettings?.timeBank ? dbSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
        autoStartDelay: dbSettings?.autoStartDelay ?? 5,
    };

    // Reset time banks for all players at the start of each hand
    playerTimeBanks[roomId] = {};

    const hand = await prisma.hand.create({
        data: {
            roomId: room.id,
            metadata: {}
        }
    });
    roomData.currentHandId = hand.id;

    const engineEvents = roomData.engine.startHand();

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

        const sockets = await io.in(roomId).fetchSockets();
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

    const sockets = await io.in(roomId).fetchSockets();
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

async function performPlayerAction(roomId: string, userId: string, action: any, schema_version: number = 1, client_msg_id?: string, socket?: any) {
    let roomData = roomStates[roomId];
    if (!roomData || !roomData.currentHandId) {
        console.error(`[performPlayerAction] room=${roomId} userId=${userId}: Hand has not started (roomData=${!!roomData})`);
        throw new Error('Hand has not started');
    }
    if (roomData.isPaused) throw new Error('Game is paused');

    // GAP-03: Deduct time bank usage when player acts during time bank phase
    const settings = roomData.settings || { turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS, timeBankMs: DEFAULT_TIME_BANK_MS, autoStartDelay: 5 };
    if (roomData.timeBankTimer && playerTimeBanks[roomId]?.[userId] !== undefined) {
        // timeBankTimer is active → player is in time bank phase
        // The timer was started at the moment the base time expired.
        // We store timeBankStartedAt on the roomData when the timer fires.
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
    const engineEvents = roomData.engine.handleAction(userId, action as any);

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
        const autoStartDelay = (roomData.settings?.autoStartDelay ?? 5) * 1000;
        console.log(`Hand finished. Auto-starting next hand in ${autoStartDelay}ms...`);
        roomData.autoStartTimer = setTimeout(async () => {
            try {
                if (roomData.isPaused) {
                    console.log(`Room ${roomId} is paused. Skipping auto-start.`);
                    return;
                }
                const currentState = roomData.engine.getState();
                const activePlayers = currentState.players.filter((p: any) => p.stack > 0);
                if (activePlayers.length >= 2) {
                    await startHand(roomId, schema_version);
                } else {
                    console.log("Not enough players with chips to auto-start next hand.");
                }
            } catch (err) {
                console.error("Failed to auto-start hand:", err);
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
            roomData = await hydrateRoom(data.room_id) as any;
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
            roomData = await hydrateRoom(data.room_id) as any;
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        }

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

        // BUG-05: Only the host may approve seat requests
        const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
        if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
        if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can approve seat requests');

        const pending = roomData.pendingSeats[data.targetPlayerId];
        if (!pending) return emitError(socket, 'ERR_NO_PENDING_REQUEST', 'No pending request found for player');

        try {
            const state = roomData.engine.getState() as any;
            const existingEnginePlayer = state.players.find((p: any) => p.id === data.targetPlayerId);
            const isRebuy = pending.requestType === 'REBUY' && !!existingEnginePlayer;

            if (isRebuy && existingEnginePlayer) {
                // Re-buy: reactivate busted seat with new stack.
                existingEnginePlayer.stack = pending.stack;
                existingEnginePlayer.status = 'ACTIVE';
                existingEnginePlayer.bet = 0;
                existingEnginePlayer.hasActed = false;
                existingEnginePlayer.seatIndex = pending.seatIndex;
                if (pending.displayName) existingEnginePlayer.displayName = pending.displayName;
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
                where: { roomId_userId: { roomId: room.id, userId: data.targetPlayerId } },
                update: { seatIndex: pending.seatIndex, stack: pending.stack, status: 'ACTIVE' },
                create: { roomId: room.id, userId: data.targetPlayerId, seatIndex: pending.seatIndex, stack: pending.stack, status: 'ACTIVE' }
            });

            delete roomData.pendingSeats[data.targetPlayerId];

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
        if (!roomData) return;
        delete roomData.pendingSeats[data.targetPlayerId];
        // Could emit a rejection to the specific player here
    });

    socket.on('INTENT_START_GAME', async (data: any) => {
        try {
            // BUG-04: Only the host may start a hand
            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
            if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can start the game');
            const roomData = roomStates[data.room_id];
            if (roomData) roomData.isPaused = false;
            await startHand(data.room_id, data.schema_version);
        } catch (err: any) {
            emitError(socket, 'ERR_START_GAME', err.message);
        }
    });

    socket.on('INTENT_PAUSE_GAME', async (data: any) => {
        try {
            let roomData = roomStates[data.room_id];
            if (!roomData) {
                roomData = await hydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
            if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can pause the game');

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
                roomData = await hydrateRoom(data.room_id) as any;
            }
            if (!roomData) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');

            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
            if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can resume the game');

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
            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) return emitError(socket, 'ERR_ROOM_NOT_FOUND', 'Room not found');
            if (room.hostId !== userId) return emitError(socket, 'ERR_NOT_HOST', 'Only the host can update settings');

            const newSettings = {
                ...(room.settings as any || {}),
                ...(data.settings || {})
            };

            await prisma.room.update({
                where: { slug: data.room_id },
                data: { settings: newSettings }
            });

            // Update in-memory cache
            const roomData = roomStates[data.room_id];
            if (roomData) {
                roomData.settings = {
                    turnTimeoutMs: newSettings.turnTimeout ? newSettings.turnTimeout * 1000 : DEFAULT_TURN_TIMEOUT_MS,
                    timeBankMs: newSettings.timeBank ? newSettings.timeBank * 1000 : DEFAULT_TIME_BANK_MS,
                    autoStartDelay: newSettings.autoStartDelay ?? 5,
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
