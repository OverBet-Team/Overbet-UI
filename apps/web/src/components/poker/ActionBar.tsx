"use client";

// OverBet — ActionBar (Simplified: 3 permanent buttons, no modals)
// Desktop: FOLD | CHECK/CALL | RAISE with inline slider
// Mobile: Compact vertical button layout
// Keyboard shortcuts: F=fold, C=call/check, R=raise (shows slider), A=all-in

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check, ArrowUpRight, Coins } from "lucide-react";
import { ChipAmount } from "./ChipAmount";
import type { TurnTimer } from "./Seat";

export type PlayerActionType = "FOLD" | "CALL" | "CHECK" | "RAISE" | "ALL_IN";

interface ActionBarProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  bank?: number;
  compact?: boolean;
  turnTimer?: TurnTimer | null;
  userId?: string;
  onAction: (actionType: PlayerActionType, amount?: number) => void;
}

export function ActionBar({
  isActive,
  stack,
  currentBet,
  playerBet,
  minRaise,
  pot = 0,
  bank,
  compact = false,
  turnTimer = null,
  userId,
  onAction,
}: ActionBarProps) {
  const minRaiseTo = Math.max(currentBet + minRaise, currentBet * 2, 1);
  const maxRaiseTo = stack + playerBet;
  const toCall = Math.max(0, currentBet - playerBet);
  const canRaise = maxRaiseTo > minRaiseTo;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Keep raiseAmount in valid range
  useEffect(() => {
    setRaiseAmount((prev) => Math.min(Math.max(prev, minRaiseTo), maxRaiseTo));
  }, [minRaiseTo, maxRaiseTo]);

  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);

  // Quick-bet presets
  const presets =
    pot > 0
      ? [
          { label: "½ Pot", value: Math.min(Math.max(Math.round(pot * 0.5), minRaiseTo), maxRaiseTo) },
          { label: "Pot", value: Math.min(Math.max(pot, minRaiseTo), maxRaiseTo) },
          { label: "2× Pot", value: Math.min(Math.max(pot * 2, minRaiseTo), maxRaiseTo) },
        ]
      : [];

  const handleRaise = useCallback(() => {
    onAction("RAISE", clampedRaise);
    setShowRaiseSlider(false);
  }, [onAction, clampedRaise]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key.toLowerCase()) {
        case "f":
          onAction("FOLD");
          break;
        case "c":
          onAction(toCall > 0 ? "CALL" : "CHECK");
          break;
        case "r":
          if (canRaise) {
            setShowRaiseSlider((v) => !v);
          }
          break;
        case "a":
          onAction("ALL_IN");
          break;
        case "escape":
          setShowRaiseSlider(false);
          break;
        case "enter":
          if (showRaiseSlider && canRaise) handleRaise();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, canRaise, showRaiseSlider, handleRaise, onAction]);

  // ── Inactive state ────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <nav
        data-testid="action-bar-inactive"
        className="glass-dock rounded-2xl border border-[--outline-variant]/15 px-5 py-6 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] flex justify-center items-center opacity-35 grayscale-[0.5]"
      >
        <div className="flex-1 py-3.5 text-center font-semibold text-sm text-white/40">
          Waiting for turn…
        </div>
      </nav>
    );
  }

  // ── Mobile compact layout ─────────────────────────────────────────────────
  if (compact) {
    return (
      <div data-testid="action-bar" className="flex flex-col w-full font-body">
        <nav className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-around items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
          <ActionButton
            icon={<X size={24} />}
            label="Fold"
            shortcut="F"
            variant="danger"
            testId="action-fold"
            onClick={() => onAction("FOLD")}
          />

          <ActionButton
            icon={<Check size={24} />}
            label={
              toCall > 0 ? (
                <span className="flex flex-col items-center">
                  <span>Call</span>
                  <span className="text-[--tertiary] font-bold text-[9px]">{toCall}</span>
                </span>
              ) : (
                "Check"
              )
            }
            shortcut="C"
            variant={toCall > 0 ? "primary" : "default"}
            testId="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          />

          {canRaise && (
            <ActionButton
              icon={<ArrowUpRight size={24} />}
              label="Raise"
              shortcut="R"
              variant="accent"
              testId="action-raise"
              onClick={() => setShowRaiseSlider((v) => !v)}
              active={showRaiseSlider}
            />
          )}

          <ActionButton
            icon={<span className="text-2xl font-bold">★</span>}
            label="All-In"
            shortcut="A"
            variant="gold"
            testId="action-all-in"
            onClick={() => onAction("ALL_IN")}
          />
        </nav>

        {/* Inline raise slider for mobile (expands below buttons) */}
        {showRaiseSlider && canRaise && (
          <div className="glass-panel mx-2 mb-2 p-4 flex flex-col gap-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs uppercase tracking-wider">Raise To</span>
              <ChipAmount
                amount={clampedRaise}
                iconSize={14}
                amountStyle={{ color: "var(--tertiary)", fontSize: 18, fontWeight: 700 }}
              />
            </div>
            <input
              type="range"
              min={minRaiseTo}
              max={maxRaiseTo}
              step={1}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="w-full"
            />
            {presets.length > 0 && (
              <div className="flex gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setRaiseAmount(preset.value)}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleRaise}
              className="w-full py-2.5 rounded-lg bg-[--tertiary] text-white font-bold text-sm hover:bg-[--tertiary-dim]"
            >
              Raise to {clampedRaise}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: unified action panel ──────────────────────────────────────────
  return (
    <div data-testid="action-bar" className="flex flex-col w-full font-body">
      <nav className="glass-dock rounded-2xl border border-[--outline-variant]/15 px-5 py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] flex items-center gap-4">

        {/* Left cluster: Bank + Timer */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
              YOUR BANK
            </span>
            <div className="flex items-center gap-1.5">
              <Coins size={14} className="text-[--gold]" />
              <span className="text-2xl font-bold text-[--on-surface] tabular-nums font-headline">
                {bank ?? stack}
              </span>
            </div>
          </div>

          {turnTimer && turnTimer.playerId === userId && (
            <TimerRingIndicator timer={turnTimer} />
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-10 bg-white/10 shrink-0" />

        {/* Center: Action buttons */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* FOLD — smaller, destructive feel */}
          <button
            data-testid="action-fold"
            onClick={() => onAction("FOLD")}
            className="flex items-center gap-2 px-4 h-[48px] rounded-xl bg-[--surface-container-high] border border-white/10 transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[--ring-magenta]"
          >
            <X size={18} className="text-[--danger]" />
            <span className="text-sm font-bold uppercase tracking-wide text-white/70">Fold</span>
          </button>

          {/* CHECK/CALL — large, prominent */}
          <button
            data-testid="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
            className={`flex items-center gap-2.5 min-w-[140px] justify-center h-[56px] rounded-xl bg-[--surface-container-high] border border-white/10 transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[--ring-cyan] ${
              toCall > 0 ? "text-[--tertiary]" : "text-white/90"
            }`}
          >
            <Check size={18} />
            <span className="text-sm font-bold uppercase tracking-wide">
              {toCall > 0 ? `Call ${toCall}` : "Check"}
            </span>
          </button>

          {/* RAISE — large, prominent */}
          {canRaise && (
            <button
              data-testid="action-raise"
              onClick={() => setShowRaiseSlider((v) => !v)}
              className={`flex items-center gap-2.5 min-w-[140px] justify-center h-[56px] rounded-xl bg-[--surface-container-high] border border-white/10 text-[--tertiary] transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[--ring-cyan] ${
                showRaiseSlider ? "ring-1 ring-[--tertiary]/40" : ""
              }`}
            >
              <ArrowUpRight size={18} />
              <span className="text-sm font-bold uppercase tracking-wide">Raise</span>
            </button>
          )}
        </div>

        {/* Right: Raise controls (conditional) */}
        {showRaiseSlider && canRaise && (
          <>
            <div className="w-px h-10 bg-white/10 shrink-0" />
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Amount</span>
                <span className="text-2xl font-bold text-[--tertiary] tabular-nums">{clampedRaise}</span>
              </div>
              <input
                type="range"
                min={minRaiseTo}
                max={maxRaiseTo}
                step={1}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="bet-slider w-28"
              />
              {presets.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setRaiseAmount(preset.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                data-testid="action-all-in"
                onClick={() => onAction("ALL_IN")}
                className="bg-white/5 border-2 border-[--gold]/40 rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase text-[--gold] hover:bg-[--gold]/10 transition-colors"
              >
                All-In
              </button>
              <button
                onClick={handleRaise}
                className="bg-[--tertiary] text-black font-bold rounded-lg px-4 py-2 text-sm hover:opacity-90 whitespace-nowrap"
              >
                Confirm ↵
              </button>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}


// ── Timer Ring Indicator ─────────────────────────────────────────────────────
const TimerRingIndicator = React.memo(function TimerRingIndicator({ timer }: { timer: TurnTimer }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, timer.expiresAt - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setTimeLeft(Math.max(0, timer.expiresAt - Date.now())), 100);
    return () => clearInterval(iv);
  }, [timer.expiresAt]);

  const secs = Math.ceil(timeLeft / 1000);
  const progress = timer.total > 0 ? timeLeft / timer.total : 0;
  const circumference = 2 * Math.PI * 16;
  const offset = circumference * (1 - progress);
  const color = progress < 0.2 ? "var(--danger)" : "var(--tertiary)";
  const isTimebank = timer.phase === "timebank";

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg className="-rotate-90" width={40} height={40} viewBox="0 0 40 40">
          <circle cx={20} cy={20} r={16} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
          <circle cx={20} cy={20} r={16} fill="none" stroke={color} strokeWidth={2.5}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke 0.2s" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white tabular-nums">
          {secs}
        </span>
      </div>
      {isTimebank && (
        <div className="flex flex-col">
          <span className="text-[8px] font-bold uppercase tracking-wider text-white/50">TIME BANK</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-[--tertiary]">ACTIVE</span>
        </div>
      )}
    </div>
  );
});

// ── Mobile Action Button ──────────────────────────────────────────────────────
const ActionButton = React.memo(function ActionButton({
  icon,
  label,
  shortcut,
  variant,
  active = false,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  shortcut: string;
  variant: "default" | "primary" | "accent" | "danger" | "gold";
  active?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const variantClasses = {
    default: "text-[--on-surface-variant] bg-white/5 hover:text-white hover:bg-white/10",
    primary: "text-[--tertiary] bg-[--tertiary]/10 hover:bg-[--tertiary]/20",
    accent: "text-[--tertiary] bg-[--tertiary]/10 hover:bg-[--tertiary]/20",
    danger: "text-[--secondary] bg-[--secondary]/10 hover:bg-[--secondary]/20",
    gold: "text-[--gold] bg-[--gold]/10 hover:bg-[--gold]/20",
  };

  return (
    <motion.button
      data-testid={testId}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`
        flex flex-col items-center justify-center gap-1 px-4 py-1 rounded-xl
        transition-all duration-300 cursor-pointer
        focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2
        ${variantClasses[variant]}
        ${active ? "bg-[--tertiary]/20 scale-105" : ""}
      `}
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-xl">
        {icon}
      </div>
      <span className="font-body font-medium text-[10px] tracking-wide">{label}</span>
      <span className="hidden md:inline text-[8px] font-mono opacity-35">{shortcut}</span>
    </motion.button>
  );
});
