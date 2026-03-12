/**
 * Adapter: maps Overbet room/game state to PlayerPerspectiveView props.
 * Hero = local player (always seat 0 / bottom center).
 * Opponents = other seated players, ordered by physical seatIndex for arc placement.
 */

import type { PlayerData } from "@/components/poker/Seat";

export interface OpponentForView {
  id: string;
  username: string;
  chips: number;
  bet: number;
  status: string;
  seatIndex: number; // physical seat for arc ordering
  cards?: string[];
  isDealer: boolean;
  isActive: boolean;
}

export interface HeroForView {
  id: string;
  username: string;
  chips: number;
  bet: number;
  status: string;
  cards: string[];
}

export interface PlayerViewState {
  hero: HeroForView;
  opponents: OpponentForView[];
  board: (string | null)[];
  pot: number;
  dealerId: string;
  activePlayerId: string;
}

export function toPlayerViewState(
  players: PlayerData[],
  gameState: { board?: string[]; pot?: number; dealerId?: string; activePlayerId?: string; players?: any[] } | null,
  userId: string
): PlayerViewState | null {
  const mySeat = players.find((p) => p.id === userId && p.seatIndex !== undefined);
  if (!mySeat) return null;

  const gPlayers = Array.isArray(gameState?.players) ? gameState.players : [];
  const opponents = players
    .filter((p) => p.id !== userId && p.seatIndex !== undefined && p.status !== "PENDING")
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => {
      const gp = gPlayers.find((x: any) => x.id === p.id) || {};
      return {
        id: p.id,
        username: p.username,
        chips: gp.chips ?? gp.stack ?? p.chips,
        bet: gp.bet ?? p.bet ?? 0,
        status: gp.status ?? p.status ?? "ACTIVE",
        seatIndex: p.seatIndex,
        cards: gp.cards ?? gp.holeCards ?? p.cards,
        isDealer: (gameState?.dealerId ?? "") === p.id,
        isActive: (gameState?.activePlayerId ?? "") === p.id,
      } as OpponentForView;
    });

  const myGp = gPlayers.find((x: any) => x.id === userId) || {};
  const heroCards = myGp.cards ?? myGp.holeCards ?? mySeat.cards ?? [];

  const board = Array.from({ length: 5 }, (_, i) => (gameState?.board ?? [])[i] ?? null);

  return {
    hero: {
      id: mySeat.id,
      username: mySeat.username,
      chips: myGp.chips ?? myGp.stack ?? mySeat.chips,
      bet: myGp.bet ?? mySeat.bet ?? 0,
      status: myGp.status ?? mySeat.status ?? "ACTIVE",
      cards: Array.isArray(heroCards) ? heroCards : [],
    },
    opponents,
    board,
    pot: gameState?.pot ?? 0,
    dealerId: gameState?.dealerId ?? "",
    activePlayerId: gameState?.activePlayerId ?? "",
  };
}
