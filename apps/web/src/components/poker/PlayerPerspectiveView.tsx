"use client";

/**
 * PlayerPerspectiveView — Moon Poker seated player view.
 * Hero at bottom center, opponents in flexbox layout (row on mobile, flanking on desktop).
 * No empty seats. Uses new AvatarRing, StatusBadge, PotDisplay, HeroHand components.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import StatusBadge from "./StatusBadge";
import AvatarRing from "./AvatarRing";
import PotDisplay from "./PotDisplay";
import HeroHand from "./HeroHand";
import { PokerTable } from "./PokerTable";
import HandStrengthRing from "./HandStrengthRing";
import HandAnalysisWidget from "./HandAnalysisWidget";
import type { PlayerViewState, OpponentForView } from "@/lib/overbet-to-player-view";
import type { TurnTimer } from "@/components/poker/Seat";

// ═══════════════════════════════════════════════════════════════════════════
// PlayerPerspectiveView — Moon Poker seated player view.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate dynamic scale based on player count
 * More players = smaller avatars to prevent crowding
 */
function getPlayerScale(total: number): number {
  if (total <= 3) return 1;
  if (total <= 5) return 0.85;
  if (total <= 8) return 0.75;
  return 0.65;
}


export const PlayerPerspectiveView = React.memo(function PlayerPerspectiveView({
  viewState,
  winnerId,
  winnerCards,
  compactMode,
  turnTimer,
}: {
  viewState: PlayerViewState;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
  turnTimer?: TurnTimer | null;
}) {
  const { hero, opponents, board, totalPot, currentRoundAmount, phase, activePlayerId } =
    viewState;
  
  // Calculate dynamic scaling based on opponent count
  const playerScale = getPlayerScale(opponents.length);

  return (
    <div
      data-testid="player-perspective"
      className="flex flex-col h-full w-full relative overflow-hidden bg-[--bg-base]"
    >
      {/* Table Layer */}
      <div className="absolute inset-0 flex items-center justify-center p-8 md:p-12">
        <PokerTable
          players={[hero, ...opponents]}
          dealerId={viewState.dealerId}
          activePlayerId={activePlayerId}
          userId={hero.id}
          board={board}
          pots={[{ amount: totalPot, type: 'MAIN' }]}
          handleSeatClick={() => {}}
          turnTimer={turnTimer}
        />
      </div>

      {/* Overlays (Hand Analysis, etc.) */}
      {!compactMode && (hero.handStrength !== undefined || hero.handType !== undefined) && (
        <div className="absolute top-24 right-8 z-40">
          <HandAnalysisWidget
            handType={hero.handType}
            handStrength={hero.handStrength}
          />
        </div>
      )}

      {/* Hero Hand - Floating at the bottom center */}
      <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <AnimatePresence mode="wait">
          {hero.cards && hero.cards.length > 0 && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <HeroHand cards={hero.cards} size={compactMode ? "sm" : "md"} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default PlayerPerspectiveView;
