/**
 * Multi-player simulation stress tests for the NLH engine.
 * Runs 2–7 players for 30+ rounds each with invariant checks.
 */
import { describe, it, expect } from "vitest";
import { runSimulation } from "./utils/simulation-harness";

const DEFAULT_ROUNDS = 30;
const DEFAULT_STARTING_STACK = 100000; // Large enough to avoid busts in 30+ rounds
const DEFAULT_MAX_ACTIONS_PER_HAND = 500;
const BASE_SEED = 12345;

function runScenario(
  playerCount: number,
  rounds: number = DEFAULT_ROUNDS,
  seedOffset?: number
) {
  return runSimulation({
    playerCount,
    startingStack: DEFAULT_STARTING_STACK,
    baseSeed: BASE_SEED + (seedOffset ?? playerCount) * 1000,
    rounds,
    maxActionsPerHand: DEFAULT_MAX_ACTIONS_PER_HAND
  });
}

function expectSuccess(result: ReturnType<typeof runSimulation>) {
  if (!result.success) {
    const ctx = (result.lastError as any)?.simulationContext;
    const replay = ctx ? `\nReplay: seed=${ctx.baseSeed} playerCount=${ctx.playerCount} round=${ctx.round}` : "";
    const failures = result.failures.map(f => `${f.check}: ${f.message}`).join("\n");
    throw new Error(
      `Simulation failed: ${result.summary}${replay}\n${failures || result.lastError?.message || ""}`
    );
  }
  expect(result.success).toBe(true);
  expect(result.failures, "Invariant failures: " + JSON.stringify(result.failures)).toHaveLength(0);
  expect(result.roundsCompleted).toBeGreaterThanOrEqual(1);
  expect(result.handsCompleted).toBeGreaterThanOrEqual(1);
}

describe("Simulation stress suite", () => {
  it("2-player game × 30 rounds", () => {
    const result = runScenario(2, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
    expect(result.handsCompleted).toBeGreaterThanOrEqual(DEFAULT_ROUNDS);
  });

  it("3-player game × 30 rounds", () => {
    const result = runScenario(3, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
  });

  it("4-player game × 30 rounds", () => {
    const result = runScenario(4, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
  });

  it("5-player game × 30 rounds", () => {
    const result = runScenario(5, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
  });

  it("6-player game × 30 rounds", () => {
    const result = runScenario(6, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
  });

  it("7-player game × 30 rounds", () => {
    const result = runScenario(7, DEFAULT_ROUNDS);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(DEFAULT_ROUNDS);
  });

  it("2-player extended stress × 50 rounds", () => {
    const result = runScenario(2, 50);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(50);
  });

  it("4-player extended stress × 50 rounds", () => {
    const result = runScenario(4, 50);
    expectSuccess(result);
    expect(result.roundsCompleted).toBe(50);
  });
});
