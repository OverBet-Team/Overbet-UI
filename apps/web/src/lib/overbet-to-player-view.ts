/**
 * Adapter: maps Overbet room/game state to PlayerPerspectiveView props.
 * Hero = local player anchored to the bottom-center of the seated table view.
 * Opponents retain their physical seat index so the renderer can lay them out
 * in a scalable, hero-relative arrangement.
 */

import type { PlayerData } from "@/components/poker/Seat";
import { getPotDisplayAmounts } from "@/lib/pot-display";

export interface OpponentForView {
  id: string;
  username: string;
  chips: number;
  bet: number;
  status: string;
  seatIndex: number;
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
  seatIndex?: number;
}

export interface PlayerViewState {
  hero: HeroForView;
  opponents: OpponentForView[];
  board: (string | null)[];
  totalPot: number;
  currentRoundAmount: number;
  dealerId: string;
  activePlayerId: string;
  phase?: string;
}

export function toPlayerViewState(
  players: PlayerData[],
  gameState: {
    board?: string[];
    pot?: number;
    sidePots?: { amount?: number }[];
    phase?: string;
    dealerId?: string;
    activePlayerId?: string;
    players?: any[];
  } | null,
  userId: string,
): PlayerViewState | null {
  const mySeat = players.find((player) => player.id === userId && player.seatIndex !== undefined);
  if (!mySeat) return null;

  const gatewayPlayers = Array.isArray(gameState?.players) ? gameState.players : [];
  const opponents = players
    .filter((player) => player.id !== userId && player.seatIndex !== undefined && player.status !== "PENDING")
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player) => {
      const gatewayPlayer = gatewayPlayers.find((candidate: any) => candidate.id === player.id) || {};

      return {
        id: player.id,
        username: player.username,
        chips: gatewayPlayer.chips ?? gatewayPlayer.stack ?? player.chips,
        bet: gatewayPlayer.bet ?? player.bet ?? 0,
        status: gatewayPlayer.status ?? player.status ?? "ACTIVE",
        seatIndex: player.seatIndex,
        cards: gatewayPlayer.cards ?? gatewayPlayer.holeCards ?? player.cards,
        isDealer: (gameState?.dealerId ?? "") === player.id,
        isActive: (gameState?.activePlayerId ?? "") === player.id,
      } satisfies OpponentForView;
    });

  const gatewayHero = gatewayPlayers.find((candidate: any) => candidate.id === userId) || {};
  const heroCards = gatewayHero.cards ?? gatewayHero.holeCards ?? mySeat.cards ?? [];
  const board = Array.from({ length: 5 }, (_, index) => (gameState?.board ?? [])[index] ?? null);
  const { totalPot, currentRoundAmount } = getPotDisplayAmounts(gameState);

  return {
    hero: {
      id: mySeat.id,
      username: mySeat.username,
      chips: gatewayHero.chips ?? gatewayHero.stack ?? mySeat.chips,
      bet: gatewayHero.bet ?? mySeat.bet ?? 0,
      status: gatewayHero.status ?? mySeat.status ?? "ACTIVE",
      cards: Array.isArray(heroCards) ? heroCards : [],
      seatIndex: mySeat.seatIndex,
    },
    opponents,
    board,
    totalPot,
    currentRoundAmount,
    dealerId: gameState?.dealerId ?? "",
    activePlayerId: gameState?.activePlayerId ?? "",
    phase: gameState?.phase,
  };
}
