/**
 * V2Player — Seat component: glass-panel avatar, status badge, chip count.
 *
 * Avatar uses initials — ai-studio sessions are anonymous (no photo URLs).
 * handStrength / handType are never shown for opponents (hidden info rule,
 * sanitised by gateway; see AGENTS.md).
 *
 * v1 equivalent: components/poker/Seat.tsx
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { V2PlayerProps } from "@/lib/overbet-to-v2-view";
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface V2PlayerComponentProps {
  player: V2PlayerProps;
  isCurrentTurn?: boolean;
  winnerId?: string;
  compact?: boolean;
}

// ── Avatar (initials, v2-styled) ──────────────────────────────────────────────

const V2Avatar = React.memo(function V2Avatar({
  username,
  size = 96,
  isActive,
  isFolded,
}: {
  username: string;
  size?: number;
  isActive: boolean;
  isFolded: boolean;
}) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <div
      data-testid="v2-player-avatar"
      className={cn(
        "rounded-full flex items-center justify-center font-bold transition-all duration-300",
        "bg-[--v2-surface-container] border-2",
        isActive
          ? "v2-avatar-glow-active v2-active-ring border-[--v2-tertiary]"
          : isFolded
          ? "v2-avatar-glow-inactive border-white/5"
          : "border-white/10"
      )}
      style={{ width: size, height: size, fontSize: size * 0.35, color: "var(--v2-on-surface)" }}
    >
      {initials}
    </div>
  );
});

// ── Status badge label ────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  called:      "bg-yellow-400/20 text-yellow-400 border-yellow-400/40",
  folded:      "bg-white/5 text-[--v2-on-surface-variant] border-white/10 opacity-40",
  checked:     "bg-[--v2-tertiary]/20 text-[--v2-tertiary] border-[--v2-tertiary]/40",
  raised:      "bg-[--v2-secondary]/20 text-[--v2-secondary] border-[--v2-secondary]/40",
  all_in:      "bg-[--v2-secondary]/30 text-[--v2-secondary] border-[--v2-secondary]/60",
  active:      "bg-[--v2-tertiary]/15 text-[--v2-tertiary] border-[--v2-tertiary]/30",
  sitting_out: "bg-white/5 text-[--v2-on-surface-variant] border-white/10 opacity-40",
  pending:     "",
};

// ── Role chips ────────────────────────────────────────────────────────────────

function DealerChip() {
  return (
    <div className="w-5 h-5 rounded-full bg-[--gold,#f59e0b] text-black font-extrabold text-[8px] flex items-center justify-center shadow-md">
      D
    </div>
  );
}

function SBChipBadge() {
  return (
    <div className="w-5 h-5 rounded-full bg-[--accent,#3b82f6] text-white font-black text-[7px] flex items-center justify-center shadow-md">
      SB
    </div>
  );
}

function BBChipBadge() {
  return (
    <div className="w-5 h-5 rounded-full bg-[--v2-secondary,#ff6d8b] text-white font-black text-[7px] flex items-center justify-center shadow-md">
      BB
    </div>
  );
}

// ── V2Player ──────────────────────────────────────────────────────────────────

export const V2Player = React.memo(function V2Player({
  player,
  isCurrentTurn = false,
  winnerId,
  compact = false,
}: V2PlayerComponentProps) {
  const isFolded = player.status === "folded";
  const isWinner = winnerId === player.id;
  const avatarSize = compact ? 64 : 80;

  return (
    <div
      data-testid="v2-player-root"
      className={cn(
        "flex flex-col items-center gap-2 transition-opacity duration-500",
        isFolded && "opacity-50"
      )}
    >
      <div className="relative">
        {/* Status badge */}
        <AnimatePresence mode="wait">
          {player.status !== "pending" && player.status !== "active" && (
            <motion.div
              key={player.status}
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, mass: 0.8 }}
              className={cn(
                "absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full border",
                "text-[0.55rem] font-bold uppercase tracking-widest font-headline z-10 whitespace-nowrap",
                "shadow-lg shadow-black/50",
                STATUS_STYLES[player.status] ?? ""
              )}
            >
              {player.status.replaceAll("_", " ")}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Winner glow ring */}
        {isWinner && (
          <div className="absolute -inset-1.5 rounded-full v2-winner-card pointer-events-none" />
        )}

        <V2Avatar
          username={player.username}
          size={avatarSize}
          isActive={isCurrentTurn}
          isFolded={isFolded}
        />
      </div>

      {/* Name + role chips */}
      <div className="flex flex-col items-center gap-0.5">
        <p
          className="font-headline font-bold text-sm text-[--v2-on-surface] leading-tight"
          style={{ fontFamily: "var(--v2-font-headline)" }}
        >
          {player.username}
        </p>

        {/* Role chips row */}
        {(player.isDealer || player.isSB || player.isBB) && (
          <div className="flex items-center gap-1">
            {player.isDealer && <DealerChip />}
            {player.isSB && <SBChipBadge />}
            {player.isBB && <BBChipBadge />}
          </div>
        )}

        {/* Chip count */}
        <motion.span
          key={player.chips}
          initial={{ opacity: 0.5, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[0.6rem] font-semibold uppercase tracking-widest text-[--v2-on-surface-variant]"
          style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)" }}
        >
          {player.chips}
        </motion.span>
      </div>

      {/* Bet bubble */}
      <AnimatePresence>
        {player.bet > 0 && (
          <motion.div
            key={`bet-${player.id}-${player.bet}`}
            data-testid="v2-player-bet"
            initial={{ scale: 0.5, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -8 }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 inline-flex items-center"
          >
            <span
              className="text-xs font-headline font-bold"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-tertiary)" }}
            >
              {player.bet}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
