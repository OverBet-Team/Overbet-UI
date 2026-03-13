/**
 * Reusable simulation harness for NLH engine stress tests.
 * Deterministic action driver, trace capture, and replay-friendly failure context.
 */
import type { PokerAction } from "../../src/types";
import type { GameState, Player } from "../../src/types";
import { NLHMachine } from "../../src/variants/NLH";
import { runAllInvariants, type InvariantFailure } from "./invariants";

/** Simple seeded PRNG for deterministic action choice (mulberry32) */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ActionTraceEntry {
  round: number;
  handStep: number;
  phase: string;
  playerId: string;
  action: PokerAction;
  toCall?: number;
  stack?: number;
}

export interface SimulationConfig {
  playerCount: number;
  startingStack: number;
  baseSeed: number;
  rounds: number;
  maxActionsPerHand: number;
  /** When true, rebuy busted players to startingStack so simulation can complete target rounds */
  rebuyOnBust?: boolean;
}

export interface SimulationResult {
  success: boolean;
  roundsCompleted: number;
  handsCompleted: number;
  folds: number;
  allIns: number;
  showdowns: number;
  failures: InvariantFailure[];
  lastError?: Error & { simulationContext?: Record<string, unknown> };
  actionTrace: ActionTraceEntry[];
  summary: string;
}

/** Derive legal actions for current player from engine state */
function getLegalActions(state: GameState, playerCount?: number): PokerAction[] {
  const actions: PokerAction[] = [];
  const p = state.players[state.activePlayerIndex];
  if (!p) return actions;

  const toCall = state.currentBet - (p.bet || 0);
  const canCheck = toCall <= 0;
  const minRaiseAmount = state.currentBet + (state.minRaise ?? state.bigBlind);

  actions.push({ type: "FOLD" });
  if (canCheck) actions.push({ type: "CHECK" });
  if (p.stack > 0 && toCall > 0) actions.push({ type: "CALL" });
  if (p.stack > 0) {
    const bb = state.bigBlind || 20;
    const minTarget = state.currentBet + (state.minRaise ?? bb);
    const maxTarget = p.bet + p.stack;
    const safeRaiseCap = state.currentBet + bb * 2;
    if (maxTarget > state.currentBet) {
      const raiseTarget = Math.min(
        Math.max(minTarget, state.currentBet + 1),
        safeRaiseCap,
        maxTarget
      );
      if (raiseTarget <= maxTarget && raiseTarget > state.currentBet) {
        actions.push({ type: "RAISE", amount: raiseTarget });
      }
    }
    if (playerCount !== 2 && p.stack > bb * 50) {
      actions.push({ type: "ALL_IN" });
    }
  }

  return actions;
}

/** Pick a legal action deterministically. Prefer CHECK/CALL to keep hands progressing. */
function pickAction(
  state: GameState,
  actions: PokerAction[],
  rng: () => number
): PokerAction {
  if (actions.length === 0) throw new Error("No legal actions");
  if (actions.length === 1) return actions[0];

  const toCall = state.currentBet - (state.players[state.activePlayerIndex]?.bet ?? 0);
  const checkOrCall = actions.find(a => a.type === "CHECK" || a.type === "CALL");
  if (checkOrCall && rng() < 0.85) return checkOrCall;

  const idx = Math.floor(rng() * actions.length);
  return actions[idx];
}

/** Build rich failure context for replay */
function buildFailureContext(
  config: SimulationConfig,
  round: number,
  handStep: number,
  state: GameState,
  trace: ActionTraceEntry[],
  err?: Error
): Record<string, unknown> {
  return {
    baseSeed: config.baseSeed,
    handSeed: config.baseSeed + round,
    playerCount: config.playerCount,
    round,
    handStep,
    phase: state?.phase,
    activePlayerIndex: state?.activePlayerIndex,
    dealerIndex: state?.dealerIndex,
    pot: state?.pot,
    board: state?.board,
    currentBet: state?.currentBet,
    players: state?.players?.map(p => ({
      id: p.id,
      stack: p.stack,
      status: p.status,
      bet: p.bet,
      hasActed: p.hasActed
    })),
    traceWindow: trace.slice(-20),
    errorMessage: err?.message
  };
}

export function runSimulation(config: SimulationConfig): SimulationResult {
  const { playerCount, startingStack, baseSeed, rounds, maxActionsPerHand, rebuyOnBust = true } = config;
  const trace: ActionTraceEntry[] = [];
  let handsCompleted = 0;
  let folds = 0;
  let allIns = 0;
  let showdowns = 0;
  const invariantFailures: InvariantFailure[] = [];
  let lastError: Error | undefined;

  const engine = new NLHMachine();
  for (let i = 0; i < playerCount; i++) {
    engine.addPlayer({
      id: `p${i}`,
      stack: startingStack,
      status: "ACTIVE",
      seatIndex: i,
      holeCards: [],
      bet: 0,
      hasActed: false
    });
  }

  const totalChipsAtStart = playerCount * startingStack;
  let roundsCompleted = 0;

  for (let round = 0; round < rounds; round++) {
    let state = engine.getState();
    let activeCount = state.players.filter(p =>
      ["ACTIVE", "ALL_IN"].includes(p.status)
    ).length;
    if (activeCount < 2 && rebuyOnBust) {
      state.players.forEach(p => {
        if (p.stack === 0) {
          p.stack = startingStack;
          p.status = "ACTIVE";
          p.holeCards = [];
          p.bet = 0;
          p.hasActed = false;
        } else if (p.status === "FOLDED") {
          p.status = "ACTIVE";
          p.holeCards = [];
          p.bet = 0;
          p.hasActed = false;
        }
      });
      activeCount = state.players.filter(p =>
        ["ACTIVE", "ALL_IN"].includes(p.status)
      ).length;
    }
    if (activeCount < 2) {
      break;
    }

    const handSeed = baseSeed + round;
    try {
      engine.startHand({ seed: handSeed });
    } catch (e) {
      lastError = e as Error;
      (lastError as any).simulationContext = buildFailureContext(
        config,
        round,
        0,
        state,
        trace,
        lastError
      );
      return {
        success: false,
        roundsCompleted: round,
        handsCompleted,
        folds,
        allIns,
        showdowns,
        failures: invariantFailures,
        lastError,
        actionTrace: trace,
        summary: `Failed at round ${round} on startHand: ${(e as Error).message}`
      };
    }

    state = engine.getState();
    const totalAtHandStart =
      state.players.reduce((s, p) => s + p.stack, 0) +
      state.pot +
      (state.sidePots || []).reduce((s, sp) => s + sp.amount, 0);

    let handStep = 0;

    while (state.phase.endsWith("BETTING")) {

      if (handStep >= maxActionsPerHand) {
        const err = new Error(
          `Stall: exceeded maxActionsPerHand ${maxActionsPerHand} in round ${round}`
        ) as Error & { simulationContext?: Record<string, unknown> };
        err.simulationContext = buildFailureContext(
          config,
          round,
          handStep,
          state,
          trace,
          err
        );
        return {
          success: false,
          roundsCompleted: round,
          handsCompleted,
          folds,
          allIns,
          showdowns,
          failures: invariantFailures,
          lastError: err,
          actionTrace: trace,
          summary: `Stall at round ${round}, handStep ${handStep}`
        };
      }

      const pid = state.players[state.activePlayerIndex]?.id;
      if (!pid) {
        const err = new Error(`No active player at round ${round}, handStep ${handStep}`);
        (err as any).simulationContext = buildFailureContext(
          config,
          round,
          handStep,
          state,
          trace,
          err
        );
        return {
          success: false,
          roundsCompleted: round,
          handsCompleted,
          folds,
          allIns,
          showdowns,
          failures: invariantFailures,
          lastError: err,
          actionTrace: trace,
          summary: `No active player at round ${round}`
        };
      }

      const actions = getLegalActions(state, playerCount);
      const rng = mulberry32(handSeed + handStep * 1000 + pid.charCodeAt(1));
      const action = pickAction(state, actions, rng);

      const toCall = state.currentBet - (state.players[state.activePlayerIndex]?.bet ?? 0);
      trace.push({
        round,
        handStep,
        phase: state.phase,
        playerId: pid,
        action,
        toCall: toCall > 0 ? toCall : undefined,
        stack: state.players[state.activePlayerIndex]?.stack
      });

      if (action.type === "FOLD") folds++;
      if (action.type === "ALL_IN") allIns++;

      try {
        engine.handleAction(pid, action);
      } catch (e) {
        lastError = e as Error;
        (lastError as any).simulationContext = buildFailureContext(
          config,
          round,
          handStep,
          state,
          trace,
          lastError
        );
        return {
          success: false,
          roundsCompleted: round,
          handsCompleted,
          folds,
          allIns,
          showdowns,
          failures: invariantFailures,
          lastError,
          actionTrace: trace,
          summary: `Exception at round ${round} handStep ${handStep}: ${(e as Error).message}`
        };
      }

      state = engine.getState();
      handStep++;

      const failures = runAllInvariants(state, totalAtHandStart);
      if (failures.length > 0) {
        invariantFailures.push(...failures);
        const err = new Error(
          `Invariant violation: ${failures.map(f => f.message).join("; ")}`
        ) as Error & { simulationContext?: Record<string, unknown> };
        err.simulationContext = buildFailureContext(
          config,
          round,
          handStep,
          state,
          trace,
          err
        );
        return {
          success: false,
          roundsCompleted: round,
          handsCompleted,
          folds,
          allIns,
          showdowns,
          failures: invariantFailures,
          lastError: err,
          actionTrace: trace,
          summary: `Invariant failure at round ${round} handStep ${handStep}`
        };
      }
    }

    state = engine.getState();
    if (state.phase === "CLEANUP") {
      handsCompleted++;
      if (state.players.some(p => p.status === "ACTIVE" || p.status === "ALL_IN")) {
        showdowns++;
      }
    }
    roundsCompleted = round + 1;
  }

  const success = invariantFailures.length === 0 && !lastError;
  return {
    success,
    roundsCompleted,
    handsCompleted,
    folds,
    allIns,
    showdowns,
    failures: invariantFailures,
    lastError,
    actionTrace: trace,
    summary: `Completed ${rounds} rounds, ${handsCompleted} hands, folds=${folds} allIns=${allIns} showdowns=${showdowns}`
  };
}
