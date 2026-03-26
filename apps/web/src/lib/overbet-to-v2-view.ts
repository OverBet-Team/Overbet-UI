/**
 * Adapter: maps PlayerViewState (output of overbet-to-player-view.ts)
 * into prop shapes for V2 presentation components.
 *
 * Rules:
 * - Pure functions only — no React, no sockets, no DB access.
 * - Consumes PlayerViewState output; does NOT duplicate its logic.
 * - Normalises status strings from uppercase (engine) to lowercase (v2 UI).
 * - NEVER exposes handStrength / handType for opponents — hidden information
 *   is sanitised by the gateway, not the client. (AGENTS.md constraint)
 * - All functions return new objects — no mutation of inputs.
 *
 * When to add here (lib/README.md rule):
 *   Pure function, reused by more than one component, converts data shapes.
 */

import type {
  PlayerViewState,
  OpponentForView,
  HeroForView,
} from "@/lib/overbet-to-player-view";
import type { TurnTimer } from "@/components/poker/Seat";

// ── V2 prop types ─────────────────────────────────────────────────────────────

export type V2Status =
  | "active"
  | "folded"
  | "called"
  | "raised"
  | "all_in"
  | "sitting_out"
  | "pending";

export interface V2PlayerProps {
  id: string;
  username: string;
  chips: number;
  bet: number;
  status: V2Status;
  seatIndex: number;
  isDealer: boolean;
  isActive: boolean;
  isSB: boolean;
  isBB: boolean;
  cards?: string[];
  /** Only set for the hero at showdown. Always undefined for opponents. */
  handStrength?: string;
  /** Only set for the hero at showdown. Always undefined for opponents. */
  handType?: string;
}

export interface V2HeroProps extends Omit<V2PlayerProps, "seatIndex"> {
  seatIndex: 0; // hero is always bottom-centre
  cards: string[]; // hero always has a cards array (may be empty pre-deal)
}

export interface V2TableViewProps {
  hero: V2HeroProps;
  opponents: V2PlayerProps[];
  board: (string | null)[]; // 5 slots; null = unrevealed / empty
  totalPot: number;
  currentRoundAmount: number;
  phase?: string;
  dealerId: string;
  activePlayerId: string;
  turnTimer?: TurnTimer | null;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
}

// ── Parsed card shape ─────────────────────────────────────────────────────────

export interface ParsedCard {
  rank: string;       // Engine rank: A, 2-9, T, J, Q, K
  suit: string;       // Engine suit: h, d, s, c
  displayRank: string; // Human-readable: T → "10", others unchanged
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SUITS = new Set(["h", "d", "s", "c"]);
const VALID_RANKS = new Set(["A", "K", "Q", "J", "T", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * Parse an engine card string (e.g. "Ah", "Tc", "2d") into display parts.
 * Returns null for invalid input (unknown suit or rank).
 */
export function parseCard(card: string): ParsedCard | null {
  if (!card || card.length < 2) return null;
  const suit = card[card.length - 1].toLowerCase();
  const rank = card.slice(0, -1).toUpperCase();
  if (!VALID_SUITS.has(suit) || !VALID_RANKS.has(rank)) return null;
  const displayRank = rank === "T" ? "10" : rank;
  return { rank, suit, displayRank };
}

/** Normalise engine uppercase status to v2 lowercase status. */
function normaliseStatus(status: string): V2Status {
  switch (status.toUpperCase()) {
    case "ACTIVE":      return "active";
    case "FOLDED":      return "folded";
    case "CALLED":      return "called";
    case "RAISED":      return "raised";
    case "ALL_IN":      return "all_in";
    case "SITTING_OUT": return "sitting_out";
    case "PENDING":     return "pending";
    default:            return "active";
  }
}

// ── Public adapter functions ──────────────────────────────────────────────────

/**
 * Map a single opponent from the v1 view state to V2PlayerProps.
 *
 * handStrength and handType are intentionally omitted — the gateway
 * sanitises opponent hole cards and the engine does not broadcast
 * hand-strength metadata for opponents during play.
 */
export function toV2Player(opponent: OpponentForView): V2PlayerProps {
  return {
    id:        opponent.id,
    username:  opponent.username,
    chips:     opponent.chips,
    bet:       opponent.bet,
    status:    normaliseStatus(opponent.status),
    seatIndex: opponent.seatIndex,
    isDealer:  opponent.isDealer,
    isActive:  opponent.isActive,
    isSB:      opponent.isSB,
    isBB:      opponent.isBB,
    // cards: undefined — defense-in-depth: strip opponent hole cards at the adapter
    // layer even though the gateway already sanitises them. (AGENTS.md constraint)
    // handStrength: undefined — hidden information rule
    // handType:     undefined — hidden information rule
  };
}

/**
 * Map the hero from HeroForView to a partial V2HeroProps base.
 * Role flags (isDealer, isActive, isSB, isBB) require PlayerViewState
 * IDs — use toV2TableProps() to get the fully resolved hero props.
 */
export function toV2Hero(hero: HeroForView): V2HeroProps {
  return {
    id:        hero.id,
    username:  hero.username,
    chips:     hero.chips,
    bet:       hero.bet,
    status:    normaliseStatus(hero.status),
    seatIndex: 0,
    isDealer:  false, // resolved in toV2TableProps
    isActive:  false, // resolved in toV2TableProps
    isSB:      false, // resolved in toV2TableProps
    isBB:      false, // resolved in toV2TableProps
    cards:     Array.isArray(hero.cards) ? hero.cards : [],
  };
}

/**
 * Map a full PlayerViewState (plus optional runtime context) to V2TableViewProps.
 *
 * This is the primary entry point — call this from V2GameContainer.
 * It resolves hero role flags from the viewState IDs and maps all opponents.
 */
export function toV2TableProps(
  viewState: PlayerViewState,
  turnTimer?: TurnTimer | null,
  winnerId?: string,
  winnerCards?: string[],
  compactMode?: boolean
): V2TableViewProps {
  const heroBase = toV2Hero(viewState.hero);

  return {
    hero: {
      ...heroBase,
      isDealer: viewState.dealerId      === viewState.hero.id,
      isActive: viewState.activePlayerId === viewState.hero.id,
      isSB:     viewState.sbPlayerId     === viewState.hero.id,
      isBB:     viewState.bbPlayerId     === viewState.hero.id,
    },
    opponents:          viewState.opponents.map(toV2Player),
    board:              viewState.board,
    totalPot:           viewState.totalPot,
    currentRoundAmount: viewState.currentRoundAmount,
    phase:              viewState.phase,
    dealerId:           viewState.dealerId,
    activePlayerId:     viewState.activePlayerId,
    turnTimer,
    winnerId,
    winnerCards,
    compactMode,
  };
}
