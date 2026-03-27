/**
 * Adapter: maps Overbet room/game state to PlayerPerspectiveView props.
 * Hero = local player (always seat 0 / bottom center).
 * Opponents = other seated players, ordered by physical seatIndex for arc placement.
 */

import type { PlayerData } from "@/components/poker/Seat";
import { getPotDisplayAmounts } from "@/lib/pot-display";

/**
 * Partial shape of a player record from the game engine state.
 * The engine may use `stack` or `chips` for the same concept, and
 * `cards` or `holeCards` depending on game phase. We accept both
 * and normalize downstream.
 */
export interface GameEnginePlayer {
  id: string;
  chips?: number;
  stack?: number;
  bet?: number;
  status?: string;
  cards?: string[];
  holeCards?: string[];
  displayName?: string;
  username?: string;
  handName?: string;
}

export interface OpponentForView {
  id: string;
  username: string;
  chips: number;
  bet: number;
  /** Uppercase status: ACTIVE, FOLDED, CALLED, RAISED, ALL_IN, etc. */
  status: string;
  seatIndex: number; // physical seat for arc ordering
  cards?: string[];
  isDealer: boolean;
  isActive: boolean;
  isSB: boolean;
  isBB: boolean;
  /** Optional hand strength from 0-1 (future: from backend analysis) */
  handStrength?: number;
  /** Optional hand classification (e.g., 'Two Pair', 'Flush') */
  handType?: string;
}

export interface HeroForView {
  id: string;
  username: string;
  chips: number;
  bet: number;
  /** Uppercase status: ACTIVE, FOLDED, CALLED, RAISED, ALL_IN, etc. */
  status: string;
  cards: string[];
  seatIndex: number;
  /** Optional hand strength from 0-1 (future: from backend analysis) */
  handStrength?: number;
  /** Optional hand classification (e.g., 'Two Pair', 'Flush') */
  handType?: string;
}

export interface PlayerViewState {
  hero: HeroForView;
  opponents: OpponentForView[];
  board: (string | null)[];
  totalPot: number;
  currentRoundAmount: number;
  dealerId: string;
  activePlayerId: string;
  sbPlayerId: string;
  bbPlayerId: string;
  phase?: string;
}

/** Normalize status strings to uppercase for consistent UI matching. */
function normalizeStatus(status: string | undefined): string {
  return (status ?? "ACTIVE").toUpperCase();
}

export interface GameStateForView {
  board?: string[];
  pot?: number;
  sidePots?: { amount?: number }[];
  phase?: string;
  dealerId?: string;
  activePlayerId?: string;
  sbPlayerId?: string;
  bbPlayerId?: string;
  players?: GameEnginePlayer[];
}

export function toPlayerViewState(
  players: PlayerData[],
  gameState: GameStateForView | null,
  userId: string
): PlayerViewState | null {
  const mySeat = players.find((p) => p.id === userId && p.seatIndex !== undefined);
  if (!mySeat) return null;

  const gPlayers: GameEnginePlayer[] = Array.isArray(gameState?.players) ? gameState.players : [];
  const opponents = players
    .filter((p) => p.id !== userId && p.seatIndex !== undefined && p.status !== "PENDING")
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p): OpponentForView => {
      const gp = gPlayers.find((x) => x.id === p.id);
      return {
        id: p.id,
        username: p.username,
        chips: gp?.chips ?? gp?.stack ?? p.chips,
        bet: gp?.bet ?? p.bet ?? 0,
        status: normalizeStatus(gp?.status ?? p.status),
        seatIndex: p.seatIndex,
        cards: gp?.cards ?? gp?.holeCards ?? p.cards,
        isDealer: (gameState?.dealerId ?? "") === p.id,
        isActive: (gameState?.activePlayerId ?? "") === p.id,
        isSB: (gameState?.sbPlayerId ?? "") === p.id,
        isBB: (gameState?.bbPlayerId ?? "") === p.id,
      };
    });

  const myGp = gPlayers.find((x) => x.id === userId);
  const heroCards = myGp?.cards ?? myGp?.holeCards ?? mySeat.cards ?? [];

  const board = Array.from({ length: 5 }, (_, i) => (gameState?.board ?? [])[i] ?? null);

  const { totalPot, currentRoundAmount } = getPotDisplayAmounts(gameState);

  return {
    hero: {
      id: mySeat.id,
      username: mySeat.username,
      chips: myGp?.chips ?? myGp?.stack ?? mySeat.chips,
      bet: myGp?.bet ?? mySeat.bet ?? 0,
      status: normalizeStatus(myGp?.status ?? mySeat.status),
      cards: Array.isArray(heroCards) ? heroCards : [],
      seatIndex: mySeat.seatIndex,
      // TODO: Replace with backend hand evaluation when available
      handStrength: Array.isArray(heroCards) && heroCards.length > 0 ? 0.75 : undefined,
      handType: Array.isArray(heroCards) && heroCards.length > 0 ? "PAIR" : undefined,
    },
    opponents,
    board,
    totalPot,
    currentRoundAmount,
    dealerId: gameState?.dealerId ?? "",
    activePlayerId: gameState?.activePlayerId ?? "",
    sbPlayerId: gameState?.sbPlayerId ?? "",
    bbPlayerId: gameState?.bbPlayerId ?? "",
    phase: gameState?.phase,
  };
}
