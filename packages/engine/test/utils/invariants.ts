/**
 * Invariant validators for poker engine simulation.
 * Used during stress tests to catch state corruption.
 */
import type { GameState, Player } from "../../src/types";

export interface InvariantFailure {
  check: string;
  message: string;
  context?: Record<string, unknown>;
}

/** Full 52-card deck for duplicate detection */
const FULL_DECK = (() => {
  const suits = ["c", "d", "h", "s"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const out: string[] = [];
  for (const s of suits) for (const r of ranks) out.push(`${r}${s}`);
  return out;
})();

/** Validate no duplicate cards across hole cards, board, and deck remainder */
export function checkCardIntegrity(state: GameState): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const seen = new Map<string, string>();

  const track = (card: string, loc: string) => {
    if (!card) return;
    const prev = seen.get(card);
    if (prev) {
      failures.push({
        check: "card_integrity",
        message: `Duplicate card ${card}: seen in ${prev} and ${loc}`,
        context: { card, prev, loc }
      });
    } else {
      seen.set(card, loc);
    }
  };

  state.players.forEach((p, i) => {
    (p.holeCards || []).forEach((c, j) => track(c, `players[${i}].holeCards[${j}]`));
  });
  (state.board || []).forEach((c, i) => track(c, `board[${i}]`));
  (state.deck || []).forEach((c, i) => track(c, `deck[${i}]`));

  const invalid = [...seen.keys()].filter(c => !FULL_DECK.includes(c));
  if (invalid.length > 0) {
    failures.push({
      check: "card_validity",
      message: `Invalid card strings: ${invalid.join(", ")}`,
      context: { invalid }
    });
  }
  return failures;
}

/** Board length must match street. CLEANUP can have 0,3,4,5 (early fold stops dealing). */
export function checkBoardProgression(state: GameState): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const phase = state.phase;
  const board = state.board || [];
  const len = board.length;

  const bettingPhases: Record<string, number> = {
    PRE_FLOP_BETTING: 0,
    FLOP_BETTING: 3,
    TURN_BETTING: 4,
    RIVER_BETTING: 5
  };
  const dealPhases: Record<string, number> = {
    DEAL_FLOP: 3,
    DEAL_TURN: 4,
    DEAL_RIVER: 5,
    SHOWDOWN: 5
  };

  if (phase === "CLEANUP") {
    if (len !== 0 && len !== 3 && len !== 4 && len !== 5) {
      failures.push({
        check: "board_progression",
        message: `Phase CLEANUP expects board length 0,3,4, or 5, got ${len}`,
        context: { phase, boardLen: len, board }
      });
    }
    return failures;
  }

  const expected = bettingPhases[phase] ?? dealPhases[phase];
  if (expected !== undefined && len !== expected) {
    failures.push({
      check: "board_progression",
      message: `Phase ${phase} expects board length ${expected}, got ${len}`,
      context: { phase, boardLen: len, board }
    });
  }
  return failures;
}

/**
 * Chips conserved: sum(stacks) + pot + sum(sidePots) = constant.
 * Chips move between pot and sidePots during round end.
 */
export function checkChipConservation(
  state: GameState,
  totalChipsAtHandStart: number
): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const stackSum = (state.players || []).reduce((s, p) => s + (p.stack ?? 0), 0);
  const pot = state.pot ?? 0;
  const sidePotSum = (state.sidePots || []).reduce((s, sp) => s + (sp.amount ?? 0), 0);
  const total = stackSum + pot + sidePotSum;

  if (total !== totalChipsAtHandStart) {
    failures.push({
      check: "chip_conservation",
      message: `Chips not conserved: expected ${totalChipsAtHandStart}, got stacks=${stackSum} pot=${pot} sidePots=${sidePotSum} total=${total}`,
      context: { totalChipsAtHandStart, stackSum, pot, sidePotSum, total }
    });
  }
  return failures;
}

/** Active player index must point to ACTIVE player (or engine may have advanced) */
export function checkTurnValidity(state: GameState): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  if (!state.phase?.endsWith("BETTING")) return failures;

  const players = state.players || [];
  const idx = state.activePlayerIndex;
  if (idx < 0 || idx >= players.length) {
    failures.push({
      check: "turn_validity",
      message: `activePlayerIndex ${idx} out of range [0, ${players.length})`,
      context: { activePlayerIndex: idx, playerCount: players.length }
    });
    return failures;
  }
  const p = players[idx];
  if (p.status !== "ACTIVE" && p.status !== "ALL_IN") {
    failures.push({
      check: "turn_validity",
      message: `Active player index ${idx} points to ${p.status} player`,
      context: { activePlayerIndex: idx, playerId: p.id, status: p.status }
    });
  }
  return failures;
}

/** Valid statuses and basic sanity */
export function checkStatusSanity(state: GameState): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const valid: Record<string, boolean> = {
    ACTIVE: true,
    FOLDED: true,
    ALL_IN: true,
    BUSTED: true,
    SITTING_OUT: true
  };

  (state.players || []).forEach((p, i) => {
    if (!valid[p.status]) {
      failures.push({
        check: "status_sanity",
        message: `Invalid status "${p.status}" for player ${p.id}`,
        context: { playerIndex: i, playerId: p.id, status: p.status }
      });
    }
    if (typeof p.stack !== "number" || p.stack < 0) {
      failures.push({
        check: "status_sanity",
        message: `Invalid stack ${p.stack} for player ${p.id}`,
        context: { playerIndex: i, playerId: p.id, stack: p.stack }
      });
    }
  });
  return failures;
}

/** Run all invariant checks and return combined failures */
export function runAllInvariants(
  state: GameState,
  totalChipsAtHandStart: number
): InvariantFailure[] {
  return [
    ...checkCardIntegrity(state),
    ...checkBoardProgression(state),
    ...checkChipConservation(state, totalChipsAtHandStart),
    ...checkTurnValidity(state),
    ...checkStatusSanity(state)
  ];
}
