/**
 * V2Controls — Glass-panel action bar for the hero's turn.
 *
 * Integrates with ai-studio's ActionBar interface:
 * - Props match ActionBarProps (isActive, stack, currentBet, playerBet, minRaise, onAction)
 * - Uses PlayerActionType from ActionBar
 * - Derives timer progress from TurnTimer (timestamp-based, not a countdown integer)
 *
 * v1 equivalent: components/poker/ActionBar.tsx
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ArrowUpRight, Zap } from "lucide-react";
import type { TurnTimer } from "@/components/poker/Seat";

export type PlayerActionType = "FOLD" | "CALL" | "CHECK" | "RAISE" | "ALL_IN";

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ── Timer ring circumference: r=46, C = 2π×46 ─────────────────────────────
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 46;

interface TimerProgress { remaining: number; total: number; fraction: number }
const NO_TIMER: TimerProgress = { remaining: 0, total: 0, fraction: 0 };

function useTimerProgress(timer: TurnTimer | null | undefined): TimerProgress {
  const [progress, setProgress] = useState<TimerProgress>(() => {
    if (!timer) return NO_TIMER;
    const remaining = Math.max(0, timer.expiresAt - Date.now());
    const fraction = timer.total > 0 ? remaining / timer.total : 0;
    return { remaining: Math.round(remaining / 1000), total: Math.round(timer.total / 1000), fraction };
  });

  useEffect(() => {
    if (!timer) { setProgress(NO_TIMER); return; }
    // Immediately snapshot current time to avoid stale-now on timer change
    const tick = () => {
      const remaining = Math.max(0, timer.expiresAt - Date.now());
      const fraction = timer.total > 0 ? remaining / timer.total : 0;
      setProgress({ remaining: Math.round(remaining / 1000), total: Math.round(timer.total / 1000), fraction });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timer]);

  return progress;
}

interface V2ControlsProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  compact?: boolean;
  onAction: (type: PlayerActionType, amount?: number) => void;
  turnTimer?: TurnTimer | null;
}

export const V2Controls = React.memo(function V2Controls({
  isActive,
  stack,
  currentBet,
  playerBet,
  minRaise,
  pot,
  onAction,
  turnTimer,
}: V2ControlsProps) {
  const callAmount = Math.max(0, currentBet - playerBet);
  const isCheck = callAmount === 0;
  const canRaise = minRaise <= stack;
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaise, setShowRaise] = useState(false);

  // Keep raiseAmount in range when minRaise or stack changes
  useEffect(() => {
    setRaiseAmount((prev) => Math.min(Math.max(prev, minRaise), stack));
  }, [minRaise, stack]);

  const { remaining, total, fraction } = useTimerProgress(turnTimer);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      switch (e.key.toLowerCase()) {
        case "f": onAction("FOLD"); break;
        case "c": onAction(isCheck ? "CHECK" : "CALL"); break;
        case "a": onAction("ALL_IN"); break;
        case "r": setShowRaise((v) => !v); break;
        case "enter":
          if (showRaise) onAction("RAISE", raiseAmount);
          break;
        case "escape":
          setShowRaise(false);
          break;
      }
    },
    [isActive, isCheck, showRaise, raiseAmount, onAction]
  );

  useEffect(() => {
    if (!isActive) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isActive, handleKey]);

  // ── Timer color ──────────────────────────────────────────────────────────
  const timerColor =
    !isActive
      ? "rgba(255,255,255,0.1)"
      : fraction > 0.5
      ? "var(--v2-tertiary, #81ecff)"
      : fraction > 0.2
      ? "#facc15"
      : "#ef4444";

  // ── Inactive placeholder ─────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div
        data-testid="v2-controls-inactive"
        className="fixed bottom-0 left-0 w-full px-10 pb-8 z-40 pointer-events-none"
      >
        <div className="w-full h-[80px] v2-glass-panel rounded-[32px] px-8 flex items-center justify-center opacity-30">
          <p
            className="text-[0.6rem] font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)" }}
          >
            Waiting…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 w-full px-10 pb-8 z-40">
      <div className="w-full v2-glass-panel rounded-[32px] px-8 py-4 flex items-center justify-between gap-6">

        {/* Left: Stack + timer ring */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span
              className="text-[0.5rem] font-bold uppercase tracking-[0.2em] mb-0.5"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)", opacity: 0.5 }}
            >
              Your Stack
            </span>
            <motion.span
              key={stack}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-headline font-bold text-2xl tracking-tighter"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              {stack}
            </motion.span>
          </div>

          {/* Timer ring */}
          {turnTimer && (
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90 p-0.5" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="46" fill="none"
                  stroke={timerColor}
                  strokeWidth="6"
                  strokeDasharray={TIMER_CIRCUMFERENCE}
                  strokeDashoffset={TIMER_CIRCUMFERENCE * (1 - fraction)}
                  style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.5s" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-[0.65rem] font-bold"
                  style={{ fontFamily: "var(--v2-font-mono)", color: timerColor }}
                >
                  {remaining}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Action buttons */}
        <div className="flex items-center gap-4">
          {/* Fold */}
          <button
            data-testid="v2-action-fold"
            onClick={() => onAction("FOLD")}
            className="flex flex-col items-center gap-1 group px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
          >
            <X size={18} className="text-red-400/80 group-hover:scale-110 transition-transform" />
            <span
              className="text-[0.55rem] font-bold uppercase tracking-widest"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)", opacity: 0.6 }}
            >
              Fold
            </span>
          </button>

          {/* Check / Call */}
          <button
            data-testid="v2-action-check-call"
            onClick={() => onAction(isCheck ? "CHECK" : "CALL")}
            className="h-12 px-6 bg-white/[0.03] border border-white/5 rounded-xl flex items-center gap-2 hover:bg-white/[0.06] transition-all"
          >
            <Check size={16} style={{ color: "var(--v2-tertiary)" }} />
            <span
              className="text-[0.6rem] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              {isCheck ? "Check" : `Call ${callAmount}`}
            </span>
          </button>

          {/* Raise toggle — hidden when stack < minRaise (short stack) */}
          <button
            data-testid="v2-action-raise"
            onClick={() => setShowRaise((v) => !v)}
            disabled={!canRaise}
            className={cn(
              "h-12 px-6 border rounded-xl flex items-center gap-2 transition-all",
              !canRaise && "opacity-30 cursor-not-allowed",
              showRaise && canRaise
                ? "bg-[--v2-tertiary]/10 border-[--v2-tertiary]/30"
                : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
            )}
          >
            <ArrowUpRight size={16} style={{ color: "var(--v2-tertiary)" }} />
            <span
              className="text-[0.6rem] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface)" }}
            >
              Raise
            </span>
          </button>

          {/* All-in */}
          <button
            data-testid="v2-action-all-in"
            onClick={() => onAction("ALL_IN")}
            className="h-12 px-5 bg-[--v2-secondary]/10 border border-[--v2-secondary]/20 rounded-xl flex items-center gap-2 hover:bg-[--v2-secondary]/20 transition-all"
          >
            <Zap size={16} style={{ color: "var(--v2-secondary)" }} />
            <span
              className="text-[0.6rem] font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-secondary)" }}
            >
              All-In
            </span>
          </button>
        </div>

        {/* Right: Bet slider (shown when showRaise) */}
        <AnimatePresence mode="wait">
          {showRaise ? (
            <motion.div
              key="raise-controls"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-4 bg-black/30 rounded-2xl px-5 py-2.5 border border-white/5 min-w-[240px]"
            >
              <div className="flex flex-col min-w-[52px]">
                <span
                  className="text-[0.5rem] font-bold uppercase tracking-widest mb-0.5"
                  style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)", opacity: 0.5 }}
                >
                  Amount
                </span>
                <motion.span
                  key={raiseAmount}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-lg font-bold leading-none"
                  style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-tertiary)" }}
                >
                  {raiseAmount}
                </motion.span>
              </div>

              <input
                type="range"
                className="v2-bet-slider w-24"
                min={minRaise}
                max={stack}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
              />

              <div className="flex gap-1.5">
                {pot != null && (
                  <button
                    onClick={() => setRaiseAmount(Math.min(Math.floor(pot / 2), stack))}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[0.55rem] font-bold hover:bg-white/10 transition-colors uppercase tracking-widest"
                    style={{ fontFamily: "var(--v2-font-headline)", color: "var(--v2-on-surface-variant)" }}
                  >
                    ½ Pot
                  </button>
                )}
                <button
                  onClick={() => onAction("RAISE", raiseAmount)}
                  className="px-3 py-1 rounded-lg border text-[0.55rem] font-bold transition-colors uppercase tracking-widest"
                  style={{
                    background: "rgba(129,236,255,0.1)",
                    borderColor: "rgba(129,236,255,0.3)",
                    color: "var(--v2-tertiary)",
                    fontFamily: "var(--v2-font-headline)",
                  }}
                >
                  Raise
                </button>
              </div>
            </motion.div>
          ) : (
            <div key="stack-spacer" className="min-w-[240px]" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
