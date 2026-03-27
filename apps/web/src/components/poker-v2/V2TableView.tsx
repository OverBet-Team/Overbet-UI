/**
 * V2TableView — Arc layout: hero bottom, opponents in ellipse, board + pot.
 *
 * Arc math ported from new-UI/src/App.tsx:
 *   startAngle=210, endAngle=-30, rx=42-44%, ry=32-34% (percent of container).
 *   x = 50 + rx * cos(rad)  →  left %
 *   y = 54 - ry * sin(rad)  →  top  % (54 biases ellipse slightly downward)
 *
 * .v2-root scoping applied at root — all v2-tokens.css classes available.
 *
 * v1 equivalent: components/poker/PlayerPerspectiveView.tsx
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { V2TableViewProps } from "@/lib/overbet-to-v2-view";
import { PHASE_NAMES } from "@/lib/gameLogFormatters";
import { V2Player } from "./V2Player";
import { V2PlayingCard } from "./V2PlayingCard";
import "./v2-tokens.css";

// ── Arc position helpers ──────────────────────────────────────────────────────

const ARC_START = 210;
const ARC_END   = -30;
const ARC_MID   = (ARC_START + ARC_END) / 2; // 90° — straight up

function getOpponentPosition(
  index: number,
  count: number
): { left: string; top: string } {
  if (count === 0) return { left: "50%", top: "30%" };

  // Single-opponent: centre them at the top of the arc (90°)
  if (count === 1) {
    const radian = (ARC_MID * Math.PI) / 180;
    const rx = 42;
    const ry = 32;
    const x = 50 + rx * Math.cos(radian);
    const y = 54 - ry * Math.sin(radian);
    return { left: `${x}%`, top: `${y}%` };
  }

  const angleRange = ARC_START - ARC_END;
  const angleStep = angleRange / (count - 1);
  const angle = ARC_START - index * angleStep;
  const radian = (angle * Math.PI) / 180;

  const rx = count > 5 ? 44 : 42;
  const ry = count > 5 ? 34 : 32;

  const x = 50 + rx * Math.cos(radian);
  const y = 54 - ry * Math.sin(radian);

  return { left: `${x}%`, top: `${y}%` };
}

function getOpponentScale(count: number): number {
  if (count <= 2) return 1;
  if (count <= 4) return 0.9;
  if (count <= 6) return 0.8;
  return 0.7;
}

// ── V2TableView ───────────────────────────────────────────────────────────────

export const V2TableView = React.memo(function V2TableView({
  hero,
  opponents,
  board,
  totalPot,
  currentRoundAmount,
  phase,
  dealerId,
  activePlayerId,
  turnTimer,
  winnerId,
  winnerCards,
  compactMode = false,
}: V2TableViewProps) {
  const opponentScale = getOpponentScale(opponents.length);
  const phaseLabel = phase ? (PHASE_NAMES[phase] ?? phase) : null;

  return (
    <div className="v2-root absolute inset-0 overflow-hidden select-none">
      {/* Atmospheric grain */}
      <div className="v2-grain-overlay" aria-hidden />

      {/* Felt depth gradient */}
      <div className="v2-table-gradient" aria-hidden />

      {/* ── Opponents (absolute, arc-positioned) ──────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {opponents.map((opponent, i) => {
          const pos = getOpponentPosition(i, opponents.length);
          return (
            <div
              key={opponent.id}
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
              style={{ left: pos.left, top: pos.top, transform: `translate(-50%, -50%) scale(${opponentScale})` }}
            >
              <V2Player
                player={opponent}
                isCurrentTurn={activePlayerId === opponent.id}
                winnerId={winnerId}
                compact={compactMode}
              />
            </div>
          );
        })}
      </div>

      {/* ── Center area: pot + board ───────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none -translate-y-8">

        {/* Phase label */}
        {phaseLabel && (
          <AnimatePresence mode="wait">
            <motion.p
              key={phaseLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 0.5, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="text-[0.5rem] font-bold uppercase tracking-[0.3em] mb-2"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              {phaseLabel}
            </motion.p>
          </AnimatePresence>
        )}

        {/* Total pot */}
        <div data-testid="v2-total-pot" className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-1 opacity-40">
            <p
              className="text-[0.5rem] uppercase tracking-[0.3em] font-bold"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              Total Pot
            </p>
          </div>
          <motion.span
            key={totalPot}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.85 }}
            className="font-bold tracking-tighter block"
            style={{
              fontFamily: "var(--v2-font-headline)",
              color: "var(--v2-on-surface)",
              fontSize: compactMode ? 48 : 72,
              lineHeight: 1,
            }}
          >
            {totalPot}
          </motion.span>
          {currentRoundAmount > 0 && (
            <span
              className="text-[0.55rem] font-bold uppercase tracking-widest opacity-40 mt-1 block"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              Round: {currentRoundAmount}
            </span>
          )}
        </div>

        {/* Board cards */}
        <div data-testid="v2-board-cards" className="flex gap-3 items-center">
          {board.map((card, i) => (
            <div key={`board-${i}-${card ?? "empty"}`} data-testid={`v2-board-card-${i}`}>
              <V2PlayingCard
                card={card ?? undefined}
                size={compactMode ? "sm" : "md"}
                winning={winnerCards?.includes(card ?? "") ?? false}
                dealDelay={i * 0.1}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Hero zone ─────────────────────────────────────────────────────── */}
      <div className="absolute bottom-[180px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4">
        {/* Hero hole cards */}
        <div
          data-testid="v2-hero-cards"
          className="relative flex items-end justify-center"
          style={{ width: 200, height: 120 }}
        >
          {hero.cards.length > 0 ? (
            hero.cards.map((card, i) => {
              const isWinning = winnerCards?.includes(card) ?? false;
              const rotate = hero.cards.length === 2
                ? (i === 0 ? -8 : 8)
                : 0;
              const xOffset = hero.cards.length === 2
                ? (i === 0 ? -40 : 40)
                : 0;
              return (
                <motion.div
                  key={`hero-card-${card}`}
                  className="absolute"
                  initial={{ y: 100, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1, rotate, x: xOffset }}
                  transition={{
                    delay: 0.6 + i * 0.15,
                    type: "spring",
                    stiffness: 100,
                    damping: 12,
                    mass: 1,
                  }}
                  whileHover={{ y: -12, scale: 1.08, zIndex: 50, transition: { duration: 0.15 } }}
                  style={{ zIndex: i + 10, filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.5))" }}
                >
                  <V2PlayingCard
                    card={card}
                    size={compactMode ? "sm" : "md"}
                    winning={isWinning}
                  />
                </motion.div>
              );
            })
          ) : (
            // Pre-deal: two placeholders
            <>
              <motion.div
                className="absolute"
                style={{ x: -40, rotate: -8, zIndex: 10 }}
              >
                <V2PlayingCard size={compactMode ? "sm" : "md"} />
              </motion.div>
              <motion.div
                className="absolute"
                style={{ x: 40, rotate: 8, zIndex: 11 }}
              >
                <V2PlayingCard size={compactMode ? "sm" : "md"} />
              </motion.div>
            </>
          )}
        </div>

        {/* Hero player info */}
        <V2Player
          player={hero}
          isCurrentTurn={activePlayerId === hero.id}
          winnerId={winnerId}
          compact={compactMode}
        />
      </div>
    </div>
  );
});
