import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

const mockGetUser = vi.fn();

const mockSupabaseAdmin = {
    auth: {
        getUser: mockGetUser,
    },
};

function createTestServer(supabaseAdmin: typeof mockSupabaseAdmin | null) {
    const httpServer = createServer();
    const io = new Server(httpServer);

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        const fallbackUserId = socket.handshake.query.userId as string | undefined;

        if (supabaseAdmin && token) {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
            if (error || !user) {
                return next(new Error('AUTH_FAILED'));
            }
            socket.data.userId = user.id;
            return next();
        }

        if (fallbackUserId) {
            socket.data.userId = fallbackUserId;
            return next();
        }

        return next(new Error('AUTH_MISSING'));
    });

    return { httpServer, io };
}

function listen(httpServer: ReturnType<typeof createServer>): Promise<number> {
    return new Promise((resolve) => {
        httpServer.listen(0, () => {
            const port = (httpServer.address() as { port: number }).port;
            resolve(port);
        });
    });
}

function cleanup(io: Server, client: ClientSocket): Promise<void> {
    return new Promise((resolve) => {
        client.disconnect();
        io.close(() => resolve());
    });
}

beforeEach(() => {
    mockGetUser.mockReset();
});

describe('Gateway auth middleware', () => {
    it('accepts connection with a valid JWT', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'user-abc' } },
            error: null,
        });

        const { httpServer, io } = createTestServer(mockSupabaseAdmin);
        const port = await listen(httpServer);

        let serverUserId: string | undefined;
        io.on('connection', (socket) => {
            serverUserId = socket.data.userId;
        });

        await new Promise<void>((resolve, reject) => {
            const client = Client(`http://localhost:${port}`, {
                auth: { token: 'valid-token' },
                reconnection: false,
            });
            client.on('connect', async () => {
                await cleanup(io, client);
                resolve();
            });
            client.on('connect_error', async (err) => {
                await cleanup(io, client);
                reject(new Error(`Unexpected connect_error: ${err.message}`));
            });
        });

        expect(serverUserId).toBe('user-abc');
    });

    it('rejects connection with an invalid JWT', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'invalid' },
        });

        const { httpServer, io } = createTestServer(mockSupabaseAdmin);
        const port = await listen(httpServer);

        const errorMessage = await new Promise<string>((resolve, reject) => {
            const client = Client(`http://localhost:${port}`, {
                auth: { token: 'bad-token' },
                reconnection: false,
            });
            client.on('connect', async () => {
                await cleanup(io, client);
                reject(new Error('Expected connection to be refused'));
            });
            client.on('connect_error', async (err) => {
                await cleanup(io, client);
                resolve(err.message);
            });
        });

        expect(errorMessage).toBe('AUTH_FAILED');
    });

    it('rejects connection when no token and no fallback userId are provided', async () => {
        const { httpServer, io } = createTestServer(mockSupabaseAdmin);
        const port = await listen(httpServer);

        const errorMessage = await new Promise<string>((resolve, reject) => {
            const client = Client(`http://localhost:${port}`, {
                reconnection: false,
                // no auth, no query.userId
            });
            client.on('connect', async () => {
                await cleanup(io, client);
                reject(new Error('Expected connection to be refused'));
            });
            client.on('connect_error', async (err) => {
                await cleanup(io, client);
                resolve(err.message);
            });
        });

        expect(errorMessage).toBe('AUTH_MISSING');
    });

    it('falls back to query.userId when supabaseAdmin is null', async () => {
        const { httpServer, io } = createTestServer(null);
        const port = await listen(httpServer);

        let serverUserId: string | undefined;
        io.on('connection', (socket) => {
            serverUserId = socket.data.userId;
        });

        await new Promise<void>((resolve, reject) => {
            const client = Client(`http://localhost:${port}`, {
                query: { userId: 'dev-user-456' },
                reconnection: false,
            });
            client.on('connect', async () => {
                await cleanup(io, client);
                resolve();
            });
            client.on('connect_error', async (err) => {
                await cleanup(io, client);
                reject(new Error(`Unexpected connect_error: ${err.message}`));
            });
        });

        expect(serverUserId).toBe('dev-user-456');
    });
});
