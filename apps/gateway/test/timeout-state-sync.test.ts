import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io, Socket } from "socket.io-client";
import { prisma } from "@overbet/db";

const GATEWAY_PORT = 4100;
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

describe("gateway timeout/state-sync regression", () => {
  let gatewayProc: ChildProcessWithoutNullStreams | null = null;
  let roomSlug = "";
  let roomId = "";
  const clients: Socket[] = [];

  beforeAll(async () => {
    roomSlug = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

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

    const room = await prisma.room.create({
      data: {
        slug: roomSlug,
        name: `Gateway Test ${roomSlug}`,
        status: "LOBBY",
        hostId: host.id,
        settings: {
          variant: "NLH",
          smallBlind: 10,
          bigBlind: 20,
          turnTimeout: 1,
          timeBank: 0,
          autoStartDelay: 1,
        } as any,
      },
    });
    roomId = room.id;

    await prisma.roomMember.createMany({
      data: [
        {
          roomId: room.id,
          userId: host.id,
          status: "ACTIVE",
          stack: 2000,
          seatIndex: 0,
        },
        {
          roomId: room.id,
          userId: p2.id,
          status: "ACTIVE",
          stack: 2000,
          seatIndex: 1,
        },
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

  it("times out once and still progresses without stale preflop/deal-error loop", async () => {
    const hostId = `host-${roomSlug}`;
    const p2Id = `p2-${roomSlug}`;

    const host = io(GATEWAY_URL, { query: { roomId: roomSlug, userId: hostId }, transports: ["websocket"] });
    const p2 = io(GATEWAY_URL, { query: { roomId: roomSlug, userId: p2Id }, transports: ["websocket"] });
    clients.push(host, p2);

    const stateSignatures: string[] = [];
    const errors: string[] = [];
    let timeoutEvents = 0;
    const hostTimerEvents: { playerId?: string; phase?: string }[] = [];

    const onState = (evt: any) => {
      const state = evt?.state;
      if (!state) return;
      const sig = `${state.phase}|b${(state.board || []).length}|a${state.activePlayerId || "none"}`;
      stateSignatures.push(sig);
    };
    host.on("EVENT_STATE_UPDATE", onState);
    p2.on("EVENT_STATE_UPDATE", onState);

    const onError = (evt: any) => {
      const m = String(evt?.message || evt?.code || "unknown");
      errors.push(m);
    };
    host.on("EVENT_ERROR", onError);
    p2.on("EVENT_ERROR", onError);

    host.on("EVENT_TURN_TIMER", (evt: any) => {
      timeoutEvents++;
      hostTimerEvents.push({ playerId: evt?.playerId, phase: evt?.phase });
    });

    await new Promise<void>((resolve) => {
      host.on("connect", () => {
        host.emit("INTENT_JOIN_ROOM", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
        host.emit("INTENT_REQUEST_SNAPSHOT", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      p2.on("connect", () => {
        p2.emit("INTENT_JOIN_ROOM", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
        p2.emit("INTENT_REQUEST_SNAPSHOT", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });
        resolve();
      });
    });

    host.emit("INTENT_START_GAME", { schema_version: 1, room_id: roomSlug, client_msg_id: crypto.randomUUID() });

    await new Promise((r) => setTimeout(r, 35_000));

    const progressedOutOfPreflop = stateSignatures.some((s) => !s.startsWith("PRE_FLOP_BETTING"));
    expect(timeoutEvents > 0 || progressedOutOfPreflop).toBe(true);
    expect(stateSignatures.length).toBeGreaterThanOrEqual(2);

    const uniqueSigs = new Set(stateSignatures);
    expect(uniqueSigs.size).toBeGreaterThan(1);

    const preflopOnly = [...uniqueSigs].every((s) => s.startsWith("PRE_FLOP_BETTING"));
    expect(preflopOnly).toBe(false);

    const deckErrors = errors.filter((e) => e.includes("Insufficient deck for DEAL_FLOP"));
    expect(deckErrors.length).toBe(0);
    expect(hostTimerEvents.some((evt) => evt.phase === "timebank")).toBe(false);
    const duplicateBaseStarts = hostTimerEvents.some((evt, idx) => {
      if (idx === 0 || evt.phase !== "base") return false;
      const prev = hostTimerEvents[idx - 1];
      return prev.phase === "base" && prev.playerId === evt.playerId;
    });
    expect(duplicateBaseStarts).toBe(false);
  }, 90_000);
});

