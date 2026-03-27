import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import { prisma } from "@overbet/db";

const GATEWAY_PORT = 4101;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

async function waitForHealth(url: string, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Gateway health check timeout: ${url}`);
}

async function waitFor(condition: () => boolean, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("gateway rebuy approval regression", () => {
  let gatewayProc: ChildProcessWithoutNullStreams | null = null;
  let roomSlug = "";
  let roomId = "";
  const clients: Socket[] = [];

  beforeAll(async () => {
    roomSlug = `R${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const host = await prisma.user.upsert({
      where: { id: `host-${roomSlug}` },
      update: {},
      create: { id: `host-${roomSlug}`, username: `Host_${roomSlug}` },
    });
    const p2 = await prisma.user.upsert({
      where: { id: `p2-${roomSlug}` },
      update: {},
      create: { id: `p2-${roomSlug}`, username: `P2_${roomSlug}` },
    });
    const rebuy = await prisma.user.upsert({
      where: { id: `rebuy-${roomSlug}` },
      update: {},
      create: { id: `rebuy-${roomSlug}`, username: `Rebuy_${roomSlug}` },
    });

    const room = await prisma.room.create({
      data: {
        slug: roomSlug,
        name: `Gateway Rebuy Test ${roomSlug}`,
        status: "LOBBY",
        hostId: host.id,
        settings: {
          variant: "NLH",
          smallBlind: 10,
          bigBlind: 20,
          turnTimeout: 3,
          timeBank: 10,
          autoStartDelay: 1,
        } as any,
      },
    });
    roomId = room.id;

    await prisma.roomMember.createMany({
      data: [
        { roomId: room.id, userId: host.id, status: "ACTIVE", stack: 2000, seatIndex: 0 },
        { roomId: room.id, userId: p2.id, status: "ACTIVE", stack: 2000, seatIndex: 1 },
        { roomId: room.id, userId: rebuy.id, status: "ACTIVE", stack: 0, seatIndex: 2 },
      ],
    });

    gatewayProc = spawn(
      "pnpm",
      ["--filter", "@overbet/gateway", "dev"],
      {
        cwd: WORKSPACE_ROOT,
        env: { ...process.env, PORT: String(GATEWAY_PORT) },
      }
    );

    await waitForHealth(`${GATEWAY_URL}/healthz`);
  }, 40_000);

  afterAll(async () => {
    clients.forEach((s) => {
      if (s.connected) s.disconnect();
    });
    if (gatewayProc) {
      gatewayProc.kill("SIGTERM");
      gatewayProc = null;
    }
    if (roomId) {
      await prisma.handEvent.deleteMany({ where: { hand: { roomId } as any } as any }).catch(() => {});
      await prisma.hand.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => {});
    }
  });

  it("does not reactivate a rebought busted player into the current hand", async () => {
    const hostId = `host-${roomSlug}`;
    const p2Id = `p2-${roomSlug}`;
    const rebuyId = `rebuy-${roomSlug}`;

    const host = io(GATEWAY_URL, { query: { roomId: roomSlug, userId: hostId }, transports: ["websocket"] });
    const p2 = io(GATEWAY_URL, { query: { roomId: roomSlug, userId: p2Id }, transports: ["websocket"] });
    const rebuy = io(GATEWAY_URL, { query: { roomId: roomSlug, userId: rebuyId }, transports: ["websocket"] });
    clients.push(host, p2, rebuy);

    let rebuyState: any = null;
    let hostPendingSeen = false;

    rebuy.on("EVENT_STATE_UPDATE", (evt: any) => {
      if (evt?.state) rebuyState = evt.state;
    });
    rebuy.on("EVENT_STATE_SNAPSHOT", (evt: any) => {
      if (evt?.state) rebuyState = evt.state;
    });
    host.on("EVENT_SEAT_REQUEST_PENDING", (evt: any) => {
      if (evt?.playerId === rebuyId) hostPendingSeen = true;
    });

    await Promise.all([
      new Promise<void>((resolve) => {
        host.on("connect", () => {
          host.emit("INTENT_JOIN_ROOM", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          host.emit("INTENT_REQUEST_SNAPSHOT", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        p2.on("connect", () => {
          p2.emit("INTENT_JOIN_ROOM", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          p2.emit("INTENT_REQUEST_SNAPSHOT", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        rebuy.on("connect", () => {
          rebuy.emit("INTENT_JOIN_ROOM", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          rebuy.emit("INTENT_REQUEST_SNAPSHOT", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
          resolve();
        });
      }),
    ]);

    host.emit("INTENT_START_GAME", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });

    await waitFor(() => rebuyState?.phase === "PRE_FLOP_BETTING", 10_000);
    await waitFor(() => rebuyState?.players?.some((p: any) => p.id === rebuyId && p.status === "BUSTED"), 10_000);

    rebuy.emit("INTENT_SEAT_REQUEST", {
      schema_version: 1,
      room_id: roomSlug,
      client_msg_id: crypto.randomUUID(),
      seatIndex: 2,
      stack: 500,
      displayName: `Rebuy_${roomSlug}`,
    });

    await waitFor(() => hostPendingSeen, 5_000);

    host.emit("INTENT_SEAT_APPROVE", {
      schema_version: 1,
      room_id: roomSlug,
      client_msg_id: crypto.randomUUID(),
      targetPlayerId: rebuyId,
    });

    await waitFor(() => rebuyState?.players?.some((p: any) => p.id === rebuyId && p.stack === 500), 10_000);

    const rebuyPlayer = rebuyState.players.find((p: any) => p.id === rebuyId);
    expect(rebuyPlayer).toBeTruthy();
    expect(rebuyPlayer.status).toBe("BUSTED");
    expect(Array.isArray(rebuyPlayer.holeCards) ? rebuyPlayer.holeCards : []).toHaveLength(0);
    expect(rebuyState.activePlayerId).not.toBe(rebuyId);
  }, 60_000);
});
