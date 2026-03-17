import { describe, expect, it } from "vitest";
import { NLHMachine } from "../src/variants/NLH";
import { runSimulation } from "./utils/simulation-harness";

function timeoutStyleActionSelector(ctx: {
  actions: { type: string; amount?: number }[];
  rng: () => number;
}) {
  const { actions, rng } = ctx;
  const check = actions.find((a) => a.type === "CHECK");
  if (check) return check;
  const call = actions.find((a) => a.type === "CALL");
  if (call) return call;
  const fold = actions.find((a) => a.type === "FOLD");
  if (fold && rng() < 0.9) return fold;
  return actions[Math.floor(rng() * actions.length)];
}

describe("timeout/deadlock regression bucket", () => {
  it("progresses through repeated timeout-style default actions without stalling", () => {
    const result = runSimulation({
      playerCount: 6,
      startingStack: 25_000,
      baseSeed: 2026031301,
      rounds: 40,
      maxActionsPerHand: 400,
      maxRepeatedStateSignatures: 12,
      actionSelector: ({ actions, rng }) => timeoutStyleActionSelector({ actions, rng }),
      rebuyOnBust: true,
    });

    if (!result.success) {
      const ctx = (result.lastError as any)?.simulationContext;
      throw new Error(
        `timeout regression failed: ${result.summary}\n` +
          `seed=${ctx?.baseSeed} round=${ctx?.round} handStep=${ctx?.handStep}\n` +
          `${result.lastError?.message ?? "unknown error"}`
      );
    }

    expect(result.roundsCompleted).toBe(40);
    expect(result.handsCompleted).toBeGreaterThan(0);
    expect(result.failures).toHaveLength(0);
  });

  it("preflop deck exhaustion reproducer throws deterministically and does not hang test loop", () => {
    const engine = new NLHMachine();
    for (let i = 0; i < 25; i++) {
      engine.addPlayer({
        id: `p${i}`,
        stack: 1000,
        status: "ACTIVE",
        seatIndex: i,
        holeCards: [],
        bet: 0,
        hasActed: false,
      });
    }

    engine.startHand({ seed: 777001 });
    let state = engine.getState();
    let actionCount = 0;
    let error: Error | null = null;

    while (state.phase === "PRE_FLOP_BETTING" && actionCount < 200) {
      const player = state.players[state.activePlayerIndex];
      const toCall = state.currentBet - (player.bet || 0);
      try {
        engine.handleAction(player.id, { type: toCall > 0 ? "CALL" : "CHECK" });
      } catch (e) {
        error = e as Error;
        break;
      }
      state = engine.getState();
      actionCount++;
    }

    expect(actionCount).toBeLessThan(200);
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/Insufficient deck for DEAL_FLOP/);
  });
});

