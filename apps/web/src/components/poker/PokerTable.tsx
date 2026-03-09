/**
 * PokerTable — 10-seat oval layout with Moon Poker visual language
 *
 * Seat positions are distributed around an ellipse using CSS absolute
 * positioning. Seats 0–9 are placed clockwise starting from the bottom-center
 * (the "hero" seat convention used by PokerNow / Moon Poker).
 *
 * Board cards use the new PlayingCard component with proper suit symbols.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seat, PlayerData, TurnTimer } from "./Seat";
import PlayingCard from "./PlayingCard";

interface PokerTableProps {
  players: (PlayerData | undefined)[];
  dealerId: string;
  activePlayerId: string;
  userId: string;
  board: string[];
  pots: { amount: number; type: string }[];
  handleSeatClick: (seatIndex: number) => void;
  turnTimer?: TurnTimer | null;
}

/**
 * 10 seat positions placed around an ellipse (% of container width/height).
 * Origin is top-left of the container.
 * Each entry is { top, left } as percentage strings, plus a label offset hint.
 *
 * Layout (clockwise from bottom-center):
 *   0 = bottom-center  (hero)
 *   1 = bottom-right
 *   2 = right
 *   3 = top-right
 *   4 = top-center-right
 *   5 = top-center-left
 *   6 = top-left
 *   7 = left
 *   8 = bottom-left
 *   9 = bottom-center-left (between 8 and 0)
 */
// 10 seats distributed around an ellipse, clockwise from bottom-center.
// Positions match Moon Poker's table layout (hero = seat 0 at bottom).
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: "90%",  left: "50%" },   // 0 — bottom center (hero)
  { top: "80%",  left: "74%" },   // 1 — bottom right
  { top: "58%",  left: "93%" },   // 2 — right
  { top: "28%",  left: "86%" },   // 3 — upper right
  { top: "7%",   left: "65%" },   // 4 — top right
  { top: "7%",   left: "35%" },   // 5 — top left
  { top: "28%",  left: "14%" },   // 6 — upper left
  { top: "58%",  left: "7%" },    // 7 — left
  { top: "80%",  left: "26%" },   // 8 — bottom left
  { top: "90%",  left: "30%" },   // 9 — bottom center-left
];

// Approximate offset from seat toward table center for card deal animation
const CENTER_OFFSETS: { x: number; y: number }[] = [
  { x: 0,    y: -160 },  // 0
  { x: -120, y: -120 },  // 1
  { x: -160, y: 0 },     // 2
  { x: -120, y: 120 },   // 3
  { x: -60,  y: 160 },   // 4
  { x: 60,   y: 160 },   // 5
  { x: 120,  y: 120 },   // 6
  { x: 160,  y: 0 },     // 7
  { x: 120,  y: -120 },  // 8
  { x: 80,   y: -160 },  // 9
];

const MAX_SEATS = 10;

export function PokerTable({
  players,
  dealerId,
  activePlayerId,
  userId,
  board,
  pots,
  handleSeatClick,
  turnTimer,
}: PokerTableProps) {
  // Map players by seatIndex for O(1) lookup
  const tableSeats = Array.from({ length: MAX_SEATS }).map((_, i) =>
    players.find((p) => p?.seatIndex === i)
  );

  // Community card slots: always show 5 slots, filled or dashed
  const communitySlots = Array.from({ length: 5 }).map((_, i) => board[i] ?? null);

  return (
    <div
      className="relative w-full max-w-5xl my-10"
      style={{ aspectRatio: "2.1 / 1" }}
    >
      {/* ── Moon Poker dark velvet table ─────────────────────────────── */}
      {/* Outer shadow ring */}
      <div
        className="absolute inset-0 rounded-[200px]"
        style={{
          background: "transparent",
          boxShadow: "0 30px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      />
      {/* Table rail */}
      <div
        className="absolute inset-0 rounded-[200px]"
        style={{
          background: "linear-gradient(180deg, #2a2040 0%, #1a1530 100%)",
          border: "10px solid #1a1530",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      />
      {/* Felt surface */}
      <div
        className="absolute rounded-[180px]"
        style={{
          inset: "10px",
          background: "radial-gradient(ellipse 90% 70% at 50% 55%, #1f1848 0%, #181338 30%, #130f2e 60%, #0e0b22 100%)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
        }}
      />
      {/* Inner rail highlight line */}
      <div
        className="absolute rounded-[175px] pointer-events-none"
        style={{
          inset: "14px",
          border: "1px solid rgba(120,80,240,0.15)",
        }}
      />
      {/* Center glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "25%", left: "50%", transform: "translateX(-50%)",
          width: "50%", height: "35%",
          background: "radial-gradient(ellipse, rgba(100,50,220,0.25) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* ── Center content ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {/* Watermark */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "0.25em",
            color: "rgba(255,255,255,0.04)",
            textTransform: "uppercase",
            fontFamily: "Outfit, Inter, sans-serif",
            marginBottom: 24,
            userSelect: "none",
          }}
        >
          OverBet
        </div>

        {/* Community cards */}
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {communitySlots.map((card, i) =>
              card ? (
                <motion.div
                  key={`${card}-${i}`}
                  initial={{ opacity: 0, y: -16, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 24 }}
                >
                  <PlayingCard card={card} size="md" />
                </motion.div>
              ) : (
                <motion.div
                  key={`empty-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <PlayingCard dashed size="md" />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        {/* Pots */}
        <div className="flex items-center gap-2 mt-5">
          <AnimatePresence>
            {pots &&
              pots.map((pot, i) => (
                <motion.div
                  key={`${pot.type}-${i}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    border:
                      pot.type === "MAIN"
                        ? "1px solid rgba(239,68,68,0.35)"
                        : "1px solid rgba(99,102,241,0.35)",
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(8px)",
                    color: pot.type === "MAIN" ? "#f87171" : "#a5b4fc",
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: "Outfit, Inter, sans-serif",
                    letterSpacing: "0.01em",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                  }}
                >
                  {pot.type === "MAIN" ? "POT" : "SIDE"}: ${pot.amount}
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Seats ───────────────────────────────────────────────────────── */}
      {SEAT_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute z-10"
          style={{
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Seat
            player={tableSeats[i]}
            seatIndex={i}
            isDealer={tableSeats[i]?.id === dealerId}
            isActive={tableSeats[i]?.id === activePlayerId}
            isSelf={tableSeats[i]?.id === userId}
            onSeatClick={handleSeatClick}
            timer={turnTimer}
            centerOffset={CENTER_OFFSETS[i]}
          />
        </div>
      ))}
    </div>
  );
}
