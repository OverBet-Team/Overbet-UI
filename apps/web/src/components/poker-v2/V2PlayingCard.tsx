/**
 * V2PlayingCard — Premium white card renderer for the v2 UI.
 *
 * Visual design: white face, cyan winner glow, spring deal animation.
 * CSS classes: v2-poker-card-premium, v2-winner-card, v2-suit-red/black.
 * All v2 CSS is scoped under .v2-root (applied by V2GameContainer).
 *
 * v1 equivalent: components/poker/PlayingCard.tsx
 */

import React from "react";
import { motion } from "framer-motion";
import { CARD_SIZES, RANK_DISPLAY, SUIT_SYMBOLS, type CardSize } from "./card-constants";
import { parseCard } from "@/lib/overbet-to-v2-view";

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface V2PlayingCardProps {
  card?: string | null;
  size?: CardSize;
  faceDown?: boolean;
  winning?: boolean;
  dealDelay?: number;
}

export const V2PlayingCard = React.memo(function V2PlayingCard({
  card,
  size = "xl",
  faceDown = false,
  winning = false,
  dealDelay = 0,
}: V2PlayingCardProps) {
  const dim = CARD_SIZES[size];

  // ── Placeholder (no card) ──────────────────────────────────────────────────
  if (!card) {
    return (
      <div
        data-testid="v2-card-placeholder"
        className="rounded-lg border border-white/5 bg-white/[0.01] flex items-center justify-center"
        style={{ width: dim.w, height: dim.h }}
      >
        <div
          className="rounded-full border border-white/5 opacity-10"
          style={{ width: dim.w * 0.3, height: dim.w * 0.3 }}
        />
      </div>
    );
  }

  const parsed = parseCard(card);

  // ── Face-down ──────────────────────────────────────────────────────────────
  if (faceDown || !parsed) {
    return (
      <motion.div
        data-testid="v2-card-back"
        className="v2-poker-card-premium rounded-lg relative overflow-hidden"
        style={{ width: dim.w, height: dim.h }}
        initial={{ opacity: 0, y: 20, rotateY: 180 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{
          type: "spring",
          stiffness: 120,
          damping: 14,
          mass: 0.8,
          delay: dealDelay,
        }}
      >
        {/* Dark back face */}
        <div className="absolute inset-0 bg-[#1a1a2e] rounded-lg" />
        <div
          className="absolute inset-[3px] rounded-md border border-white/10"
          style={{
            background:
              "repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 6px)",
          }}
        />
      </motion.div>
    );
  }

  // ── Face-up ────────────────────────────────────────────────────────────────
  const { suit } = parsed;
  const suitInfo = SUIT_SYMBOLS[suit];
  const isRed = suit === "h" || suit === "d";
  const suitColorClass = isRed ? "v2-suit-red" : "v2-suit-black";
  const rankDisplay = RANK_DISPLAY[parsed.rank] ?? parsed.rank;

  return (
    <motion.div
      data-testid="v2-card-face"
      className={cn(
        "v2-poker-card-premium rounded-lg relative overflow-hidden select-none",
        winning && "v2-winner-card"
      )}
      style={{ width: dim.w, height: dim.h }}
      initial={{ opacity: 0, y: 20, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 14,
        mass: 0.8,
        delay: dealDelay,
      }}
    >
      {/* Top-left corner */}
      <div
        className={cn("absolute top-1 left-1 flex flex-col items-center leading-none font-bold", suitColorClass)}
        style={{ fontSize: dim.corner }}
      >
        <span>{rankDisplay}</span>
        <span style={{ fontSize: dim.corner * 0.9 }}>{suitInfo?.symbol}</span>
      </div>

      {/* Center suit */}
      <div
        className={cn("absolute inset-0 flex items-center justify-center font-bold", suitColorClass)}
        style={{ fontSize: dim.suit }}
      >
        {suitInfo?.symbol}
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div
        className={cn(
          "absolute bottom-1 right-1 flex flex-col items-center leading-none font-bold rotate-180",
          suitColorClass
        )}
        style={{ fontSize: dim.corner }}
      >
        <span>{rankDisplay}</span>
        <span style={{ fontSize: dim.corner * 0.9 }}>{suitInfo?.symbol}</span>
      </div>
    </motion.div>
  );
});
