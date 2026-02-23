import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
    IntentJoinRoom,
    IntentRequestSnapshot,
    IntentPlayerAction,
    IntentSeatRequest,
    EventStateSnapshot,
    EventStateUpdate,
    EventActionConfirmed,
    EventSeatApproved
} from './types';
import { NLHMachine, HandEvent } from '@overbet/engine';
import { PrismaClient } from '@overbet/db';

const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Adjust this in production
        methods: ['GET', 'POST']
    }
});

// Simple in-memory room store mapping room_id to Engine instances
const roomStates: Record<string, { engine: NLHMachine; seq: number; currentHandId?: string }> = {};     

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('INTENT_JOIN_ROOM', (data: IntentJoinRoom) => {
        console.log(`Socket ${socket.id} joining room ${data.room_id}`);        
        socket.join(data.room_id);
    });

    socket.on('INTENT_REQUEST_SNAPSHOT', (data: IntentRequestSnapshot) => {     
        console.log(`Snapshot requested by ${socket.id} for room ${data.room_id}`);
        const roomData = roomStates[data.room_id];
        if (!roomData) return;

        const snapshotEvent: EventStateSnapshot = {
            type: 'EVENT_STATE_SNAPSHOT',
            schema_version: data.schema_version,
            room_id: data.room_id,
            hand_id: roomData.currentHandId,
            server_seq: roomData.seq,
            state: roomData.engine.getState()
        };
        socket.emit('EVENT_STATE_SNAPSHOT', snapshotEvent);
    });

    socket.on('INTENT_SEAT_REQUEST', (data: IntentSeatRequest) => {
        let roomData = roomStates[data.room_id];
        if (!roomData) {
            roomData = { engine: new NLHMachine(), seq: 0 };
            roomStates[data.room_id] = roomData;
        }

        try {
            const state = roomData.engine.getState();
            const isTaken = state.players.some(p => p.seatIndex === data.seatIndex);
            if (isTaken) throw new Error('Seat already taken');

            roomData.engine.addPlayer({
                id: socket.id,
                stack: data.stack,
                status: 'ACTIVE',
                seatIndex: data.seatIndex,
                holeCards: [],
                bet: 0,
                hasActed: false
            });

            roomData.seq++;

            const approvedEvent: EventSeatApproved = {
                type: 'EVENT_SEAT_APPROVED',
                schema_version: data.schema_version,
                room_id: data.room_id,
                server_seq: roomData.seq,
                playerId: socket.id,
                seatIndex: data.seatIndex,
                stack: data.stack
            };

            io.to(data.room_id).emit('EVENT_SEAT_APPROVED', approvedEvent);
            
            // Also broadcast update to everyone
            io.to(data.room_id).emit('EVENT_STATE_UPDATE', {
                type: 'EVENT_STATE_UPDATE',
                schema_version: data.schema_version,
                room_id: data.room_id,
                server_seq: roomData.seq,
                state: roomData.engine.getState()
            });
        } catch (err: any) {
            socket.emit('ERROR', { message: err.message });
        }
    });

    socket.on('INTENT_START_GAME', async (data: any) => {
        let roomData = roomStates[data.room_id];
        if (!roomData) {
            roomData = { engine: new NLHMachine(), seq: 0 };
            roomStates[data.room_id] = roomData;
        }

        try {
            // 1. Create Hand in DB
            const room = await prisma.room.findUnique({ where: { slug: data.room_id } });
            if (!room) throw new Error('Room not found');

            const hand = await prisma.hand.create({
                data: {
                    roomId: room.id,
                    metadata: { seed: 12345 }
                }
            });
            roomData.currentHandId = hand.id;

            // 2. Start hand in engine
            const engineEvents = roomData.engine.startHand({ seed: 12345 });    
            
            // 3. Save events to DB and fan out
            for (const ev of engineEvents) {
                roomData.seq++;
                await prisma.handEvent.create({
                    data: {
                        handId: hand.id,
                        sequence: ev.sequence,
                        type: ev.type,
                        payload: ev.payload as any
                    }
                });

                // Fan out individual events or full state
                io.to(data.room_id).emit('EVENT_HAND_LOG', {
                    ...ev,
                    room_id: data.room_id,
                    hand_id: hand.id,
                    server_seq: roomData.seq
                });
            }

            // Also send full state update
            io.to(data.room_id).emit('EVENT_STATE_UPDATE', {
                type: 'EVENT_STATE_UPDATE',
                room_id: data.room_id,
                hand_id: hand.id,
                server_seq: roomData.seq,
                state: roomData.engine.getState()
            });

        } catch (err: any) {
            console.error('Start Game Error', err.message);
            socket.emit('ERROR', { message: err.message });
        }
    });

    socket.on('INTENT_PLAYER_ACTION', async (data: IntentPlayerAction) => {
        let roomData = roomStates[data.room_id];
        if (!roomData || !roomData.currentHandId) return;

        try {
            const engineEvents = roomData.engine.handleAction(socket.id, data.action as any);
            
            for (const ev of engineEvents) {
                roomData.seq++;
                await prisma.handEvent.create({
                    data: {
                        handId: roomData.currentHandId,
                        sequence: ev.sequence,
                        type: ev.type,
                        payload: ev.payload as any
                    }
                });

                io.to(data.room_id).emit('EVENT_HAND_LOG', {
                    ...ev,
                    room_id: data.room_id,
                    hand_id: roomData.currentHandId,
                    server_seq: roomData.seq
                });
            }

            const ackEvent: EventActionConfirmed = {
                type: 'EVENT_ACTION_CONFIRMED',
                schema_version: data.schema_version,
                room_id: data.room_id,
                hand_id: roomData.currentHandId,
                client_msg_id: data.client_msg_id,
                server_seq: roomData.seq,
                server_ts: Date.now()
            };
            socket.emit('EVENT_ACTION_CONFIRMED', ackEvent);

            io.to(data.room_id).emit('EVENT_STATE_UPDATE', {
                type: 'EVENT_STATE_UPDATE',
                schema_version: data.schema_version,
                room_id: data.room_id,
                hand_id: roomData.currentHandId,
                server_seq: roomData.seq,
                state: roomData.engine.getState()
            });

        } catch (err: any) {
            socket.emit('ERROR', { message: err.message });
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
