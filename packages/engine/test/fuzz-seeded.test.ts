import { describe, expect, it } from "vitest";
import { runSimulation } from "./utils/simulation-harness";

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("seeded fuzz simulation", () => {
  it("runs replayable timeout-heavy multiplayer fuzz rounds", () => {
    const masterSeed = 2026031302;
    const rng = mulberry32(masterSeed);
    const scenarios = 16;

    for (let i = 0; i < scenarios; i++) {
      const playerCount = 2 + Math.floor(rng() * 6); // 2..7
      const rounds = 18 + Math.floor(rng() * 24); // 18..41
      const startingStack = 12_000 + Math.floor(rng() * 88_000);
      const seed = masterSeed + i * 997;

      const result = runSimulation({
        playerCount,
        startingStack,
        baseSeed: seed,
        rounds,
        maxActionsPerHand: 500,
        maxRepeatedStateSignatures: 14,
        actionSelector: ({ actions, rng: localRng }) => {
          const check = actions.find((a) => a.type === "CHECK");
          if (check && localRng() < 0.72) return check;
          const call = actions.find((a) => a.type === "CALL");
          if (call && localRng() < 0.7) return call;
          const fold = actions.find((a) => a.type === "FOLD");
          if (fold && localRng() < 0.2) return fold;
          // Keep fuzz timeout-heavy while avoiding engine-legal raise edge noise.
          return check ?? call ?? fold ?? actions[0];
        },
      });

      if (!result.success) {
        const ctx = (result.lastError as any)?.simulationContext;
        throw new Error(
          [
            "Seeded fuzz failed.",
            `masterSeed=${masterSeed}`,
            `scenario=${i}`,
            `seed=${seed}`,
            `playerCount=${playerCount}`,
            `rounds=${rounds}`,
            `round=${ctx?.round ?? "n/a"}`,
            `handStep=${ctx?.handStep ?? "n/a"}`,
            `phase=${ctx?.phase ?? "n/a"}`,
            `activePlayer=${ctx?.activePlayerIndex ?? "n/a"}`,
            `error=${result.lastError?.message ?? "unknown"}`,
          ].join(" ")
        );
      }

      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.roundsCompleted).toBe(rounds);
    }
  });
});

