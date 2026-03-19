import { describe, expect, it } from "vitest";

import { projectHeroTurnState } from "../src/lib/hero-turn-projection";

describe("projectHeroTurnState", () => {
  it("keeps hero actionable and visible with a live hero timer", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 2_000,
        phase: "base",
        timeBankMs: 5_000,
      },
      nowMs: 1_500,
    });

    expect(projection.heroHasAuthoritativeTurn).toBe(true);
    expect(projection.heroTimerExpiredLocally).toBe(false);
    expect(projection.heroCanAct).toBe(true);
    expect(projection.showHeroTimer).toBe(true);
    expect(projection.projectedViewActivePlayerId).toBe("u1");
  });

  it("does not suppress during base-time expiry while time bank remains", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 2_000,
        phase: "base",
        timeBankMs: 5_000,
      },
      nowMs: 2_500,
    });

    expect(projection.heroTimerExpiredLocally).toBe(false);
    expect(projection.heroCanAct).toBe(true);
    expect(projection.showHeroTimer).toBe(true);
    expect(projection.projectedViewActivePlayerId).toBe("u1");
  });

  it("suppresses hero cues once base + timebank deadline is elapsed", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 2_000,
        phase: "base",
        timeBankMs: 5_000,
      },
      nowMs: 7_000,
    });

    expect(projection.heroHasAuthoritativeTurn).toBe(true);
    expect(projection.heroTimerExpiredLocally).toBe(true);
    expect(projection.heroCanAct).toBe(false);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("");
  });

  it("suppresses hero cues after explicit timebank timer expiry", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 2_000,
        phase: "timebank",
        timeBankMs: 2_000,
      },
      nowMs: 2_000,
    });

    expect(projection.heroTimerExpiredLocally).toBe(true);
    expect(projection.heroCanAct).toBe(false);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("");
  });

  it("suppresses hero cues when hero status is not ACTIVE", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "FOLDED",
      phase: "FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 20_000,
        phase: "base",
        timeBankMs: 5_000,
      },
      nowMs: 10_000,
    });

    expect(projection.heroHasAuthoritativeTurn).toBe(true);
    expect(projection.heroCanAct).toBe(false);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("");
  });

  it("does not suppress non-hero active turns", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u2",
      turnTimer: {
        playerId: "u1",
        expiresAt: 1_000,
        phase: "timebank",
        timeBankMs: 1_000,
      },
      nowMs: 2_500,
    });

    expect(projection.heroHasAuthoritativeTurn).toBe(false);
    expect(projection.heroTimerExpiredLocally).toBe(false);
    expect(projection.heroCanAct).toBe(false);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("u2");
  });

  it("disables hero actionability in non-betting phases", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "CLEANUP",
      activePlayerId: "u1",
      turnTimer: {
        playerId: "u1",
        expiresAt: 9_000,
        phase: "timebank",
        timeBankMs: 1_000,
      },
      nowMs: 1_000,
    });

    expect(projection.isBettingPhase).toBe(false);
    expect(projection.heroHasAuthoritativeTurn).toBe(false);
    expect(projection.heroCanAct).toBe(false);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("u1");
  });

  it("keeps hero actionable when timer has not arrived yet", () => {
    const projection = projectHeroTurnState({
      userId: "u1",
      heroStatus: "ACTIVE",
      phase: "PRE_FLOP_BETTING",
      activePlayerId: "u1",
      turnTimer: null,
      nowMs: 10_000,
    });

    expect(projection.heroHasAuthoritativeTurn).toBe(true);
    expect(projection.heroTimerExpiredLocally).toBe(false);
    expect(projection.heroCanAct).toBe(true);
    expect(projection.showHeroTimer).toBe(false);
    expect(projection.projectedViewActivePlayerId).toBe("u1");
  });
});
