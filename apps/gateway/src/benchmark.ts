import { Server } from 'socket.io';

const io = new Server();

// Create dummy sockets
const room = 'test_room';
for (let i = 0; i < 1000; i++) {
    const socket: any = {
        id: `socket_${i}`,
        handshake: { query: { userId: `user_${i}` } },
        emit: () => {},
        join: () => {},
        leave: () => {}
    };
    io.sockets.sockets.set(socket.id, socket);
    socket.rooms = new Set([room]);
    io.sockets.adapter.sids.set(socket.id, socket.rooms);
    if (!io.sockets.adapter.rooms.has(room)) {
        io.sockets.adapter.rooms.set(room, new Set());
    }
    const r = io.sockets.adapter.rooms.get(room);
    if (r) {
        r.add(socket.id);
    }
}

async function runBenchmark() {
    console.time('fetchSockets');
    for (let i = 0; i < 1000; i++) {
        const sockets = await io.in(room).fetchSockets();
        for (const s of sockets) {
            // do something trivial
            const uId = s.handshake.query.userId as string;
        }
    }
    console.timeEnd('fetchSockets');

    console.time('directAdapterRooms');
    for (let i = 0; i < 1000; i++) {
        const roomSet = io.sockets.adapter.rooms.get(room);
        if (roomSet) {
            for (const socketId of roomSet) {
                const s = io.sockets.sockets.get(socketId);
                if (s) {
                    const uId = s.handshake.query.userId as string;
                }
            }
        }
    }
    console.timeEnd('directAdapterRooms');
}

runBenchmark().catch(console.error);
