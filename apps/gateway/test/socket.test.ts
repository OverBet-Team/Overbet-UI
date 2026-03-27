import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

describe('Gateway Socket Server', () => {
    let io: Server, serverSocket: any, clientSocket: ClientSocket;

    beforeAll(() => {
        return new Promise<void>((resolve) => {
            const httpServer = createServer();
            io = new Server(httpServer);
            httpServer.listen(() => {
                const port = (httpServer.address() as any).port;
                clientSocket = Client(`http://localhost:${port}`);
                io.on("connection", (socket) => {
                    serverSocket = socket;
                });
                clientSocket.on("connect", () => {
                    resolve();
                });
            });
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
    });

    it('should connect to the gateway socket server successfully', () => {
        expect(clientSocket.connected).toBe(true);
    });

    it('should handle basic join_room events', () => {
        return new Promise<void>((resolve) => {
            serverSocket.on("join_room", (arg: any) => {
                expect(arg.roomId).toBe("room1");
                resolve();
            });
            clientSocket.emit("join_room", { roomId: "room1" });
        });
    });
});
