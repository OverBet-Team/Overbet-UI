"use client";

// OverBet — ActionBar (3-section glass dock redesign)
// Mobile: icon-above-label columns in rounded glass dock
// Desktop: 3-section horizontal layout (Bank+Timer | Actions | Bet Control)
// Keyboard shortcuts: F=fold, C=call/check, R=raise, A=all-in

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ArrowUpRight, Circle } from "lucide-react";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import type { TurnTimer } from "./Seat";

/** All player action types the ActionBar can emit. */
export type PlayerActionType = "FOLD" | "CALL" | "CHECK" | "RAISE" | "ALL_IN";


interface ActionBarProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
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
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer countdown
  useEffect(() => {
    if (!turnTimer || turnTimer.playerId !== userId) {
      setTimeLeft(0);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((turnTimer.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [turnTimer, userId]);

  // Keep raiseAmount in valid range when game state changes
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
    setShowRaisePanel(false);
  }, [onAction, clampedRaise]);

  const closeRaisePanel = useCallback(() => {
    setShowRaisePanel(false);
  }, []);

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
          setShowRaisePanel((v) => !v);
          break;
        case "a":
          onAction("ALL_IN");
          break;
        case "escape":
          setShowRaisePanel(false);
          break;
        case "enter":
          if (showRaisePanel) handleRaise();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, showRaisePanel, handleRaise, onAction]);

  // ── Inactive state ────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <nav
        data-testid="action-bar-inactive"
        className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-center items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] opacity-35 grayscale-[0.5]"
      >
        <div className="flex-1 py-3.5 text-center font-semibold text-sm text-white/40">
          Waiting for turn…
        </div>
      </nav>
    );
  }

  const raisePanelNode =
    showRaisePanel && canRaise ? (
      <>
        {/* Backdrop */}
        <div
          data-testid="raise-modal-backdrop"
          onClick={closeRaisePanel}
          className={
            compact
              ? "fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm"
              : "fixed inset-0 z-[999] bg-black/30"
          }
        />

        {/* Panel */}
        <div
          data-testid="raise-modal"
          className="glass-panel rounded-[18px] p-4 flex flex-col gap-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] overflow-y-auto"
          style={
            compact
              ? {
                  position: "fixed",
                  left: 10,
                  right: 10,
                  bottom: "calc(86px + env(safe-area-inset-bottom, 0px))",
                  zIndex: 1000,
                  borderRadius: 18,
                  maxHeight: "66dvh",
                }
              : {
                  position: "fixed",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "min(560px, calc(100vw - 24px))",
                  bottom: 84,
                  zIndex: 1000,
                  borderRadius: 18,
                  maxHeight: "60dvh",
                }
          }
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <span className="text-white/[0.68] text-[11px] font-bold uppercase tracking-wider font-body">
              Raise Amount
            </span>
            <button
              onClick={closeRaisePanel}
              aria-label="Close raise panel"
              className="w-7 h-7 rounded-full border border-white/[0.14] bg-white/5 text-white/75 text-base cursor-pointer hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
            >
              ×
            </button>
          </div>

          {/* Amount display */}
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider font-body">
              Raise To
            </span>
            <ChipAmount
              amount={clampedRaise}
              iconSize={16}
              amountStyle={{
                color: "var(--tertiary)",
                fontSize: 24,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
              }}
            />
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            step={1}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full"
            aria-label="Adjust raise amount"
          />

          {/* Presets */}
          {presets.length > 0 ? (
            <div className="flex gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRaiseAmount(preset.value)}
                  className="flex-1 py-2 rounded-lg border border-white/[0.14] bg-white/5 text-white/80 text-xs font-semibold cursor-pointer hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[--ring-active]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Confirm raise */}
          <button
            onClick={handleRaise}
            className="w-full py-3 rounded-[14px] border-0 bg-[--tertiary] text-white font-bold text-sm font-body hover:bg-[--tertiary-dim] transition-colors shadow-[0_4px_20px_rgba(129,236,255,0.35)] hover:shadow-[0_4px_28px_rgba(129,236,255,0.5)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>Raise to</span>
              <ChipAmount
                amount={clampedRaise}
                iconSize={12}
                iconColor="#ffffff"
                amountStyle={{ color: "inherit", fontSize: 14, fontWeight: 700 }}
              />
              <span>↵</span>
            </span>
          </button>
        </div>
      </>
    ) : null;

  // ── Mobile layout (keep existing compact vertical layout) ─────────────────
  if (compact) {
    return (
      <div data-testid="action-bar" className="flex flex-col w-full font-body">
        {/* Raise panel */}
        {typeof document !== "undefined"
          ? createPortal(raisePanelNode, document.body)
          : raisePanelNode}

        {/* Glass dock action bar */}
        <nav className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-around items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
          {/* Fold */}
          <ActionButton
            icon={<X size={24} />}
            label="Fold"
            shortcut="F"
            variant="danger"
            testId="action-fold"
            onClick={() => {
              setShowRaisePanel(false);
              onAction("FOLD");
            }}
          />

          {/* Call / Check */}
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
            onClick={() => {
              setShowRaisePanel(false);
              onAction(toCall > 0 ? "CALL" : "CHECK");
            }}
          />

          {/* Raise */}
          {canRaise ? (
            <ActionButton
              icon={<ArrowUpRight size={24} />}
              label="Raise"
              shortcut="R"
              variant="accent"
              active={showRaisePanel}
              testId="action-raise"
              onClick={() => setShowRaisePanel((v) => !v)}
            />
          ) : null}

          {/* All-In */}
          <ActionButton
            icon={<span className="text-2xl font-bold">★</span>}
            label="All-In"
            shortcut="A"
            variant="gold"
            testId="action-all-in"
            onClick={() => {
              setShowRaisePanel(false);
              onAction("ALL_IN");
            }}
          />
        </nav>
      </div>
    );
  }

  // ── Desktop 3-section layout ──────────────────────────────────────────────
  const isUserTurn = turnTimer && turnTimer.playerId === userId;
  const maxTurnTime = turnTimer?.total ? turnTimer.total / 1000 : 30;
  const timerProgress = maxTurnTime > 0 ? timeLeft / maxTurnTime : 0;

  return (
    <div data-testid="action-bar" className="flex flex-col w-full font-body">
      {/* Raise panel */}
      {typeof document !== "undefined"
        ? createPortal(raisePanelNode, document.body)
        : raisePanelNode}

      {/* 3-section glass dock */}
      <nav className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 px-8 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] h-[100px] flex items-center justify-between">
        
        {/* LEFT: Bank & Timer */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-[--on-surface-variant]/40 font-headline mb-0.5">
              Your Bank
            </span>
            <div className="flex items-center gap-2">
              <Circle size={18} className="text-[--on-surface-variant]/30 fill-current" />
              <span className="font-headline font-bold text-3xl tracking-tighter text-[--on-surface]">
                {stack}
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-white/5 mx-2" />

          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10">
              <svg className="absolute inset-0 w-full h-full -rotate-90 p-0.5" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray="289.02"
                  strokeDashoffset={289.02 * (1 - timerProgress)}
                  className={`transition-all duration-1000 ease-linear ${
                    !isUserTurn ? "text-white/10" :
                    timeLeft > 15 ? "text-[--tertiary]" :
                    timeLeft > 5 ? "text-yellow-400" : "text-red-500"
                  }`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[0.7rem] font-mono font-bold ${
                  !isUserTurn ? "text-[--on-surface-variant]/20" :
                  timeLeft > 15 ? "text-[--on-surface]" :
                  timeLeft > 5 ? "text-yellow-400" : "text-red-500 animate-pulse"
                }`}>
                  {isUserTurn ? timeLeft : "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.5rem] font-bold uppercase tracking-[0.2em] text-[--on-surface-variant]/40 font-headline">
                Time Bank
              </span>
              <span className={`text-[0.6rem] font-bold uppercase tracking-widest font-headline ${
                !isUserTurn ? "text-[--on-surface-variant]/20" : "text-[--on-surface]/80"
              }`}>
                {isUserTurn ? (timeLeft > 5 ? "Active" : "Critical") : "Waiting"}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER: Action Buttons */}
        <div className="flex items-center gap-5">
          <button
            data-testid="action-fold"
            onClick={() => {
              setShowRaisePanel(false);
              onAction("FOLD");
            }}
            className="flex flex-col items-center gap-1 group px-4 focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2 rounded-lg"
          >
            <X size={20} className="text-red-500/80 group-hover:scale-110 transition-transform" />
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[--on-surface-variant]/50 group-hover:text-[--on-surface] transition-colors">
              Fold
            </span>
          </button>

          <button
            data-testid="action-check-call"
            onClick={() => {
              setShowRaisePanel(false);
              onAction(toCall > 0 ? "CALL" : "CHECK");
            }}
            className="w-36 h-14 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center gap-2 group hover:bg-white/[0.04] transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
          >
            <Check size={18} className="text-[--tertiary] group-hover:scale-110 transition-transform" />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[--on-surface]">
              {toCall > 0 ? `Call ${toCall}` : "Check"}
            </span>
          </button>

          {canRaise && (
            <button
              data-testid="action-raise"
              onClick={() => setShowRaisePanel((v) => !v)}
              className={`w-36 h-14 bg-white/[0.04] border ${
                showRaisePanel ? "border-[--tertiary]/40 bg-[--tertiary]/10" : "border-white/10"
              } rounded-xl flex items-center justify-center gap-2 group hover:bg-white/[0.08] transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2`}
            >
              <ArrowUpRight size={18} className="text-[--tertiary] group-hover:scale-110 transition-transform" />
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[--on-surface]">
                Raise
              </span>
            </button>
          )}
        </div>

        {/* RIGHT: Bet Controller */}
        <div className="flex items-center gap-6 bg-black/30 rounded-2xl px-6 py-2.5 border border-white/5">
          <div className="flex flex-col min-w-[60px]">
            <span className="text-[0.55rem] font-bold text-[--on-surface-variant]/40 uppercase font-headline tracking-widest">
              Amount
            </span>
            <div className="h-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={raiseAmount}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{
                    y: 0,
                    opacity: 1,
                    scale: raiseAmount > currentBet ? [1, 1.05, 1] : 1,
                    color: raiseAmount > currentBet ? ["#00e5ff", "#ffffff", "#00e5ff"] : "#00e5ff",
                  }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{
                    y: { type: "spring", stiffness: 500, damping: 30 },
                    scale: { repeat: Infinity, duration: 2 },
                    color: { repeat: Infinity, duration: 2 },
                  }}
                  className="text-xl font-headline font-bold leading-none block"
                >
                  {raiseAmount}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
          <div className="w-32">
            <input
              type="range"
              className="bet-slider w-full"
              min={minRaiseTo}
              max={maxRaiseTo}
              step={1}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              aria-label="Adjust raise amount"
            />
          </div>
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setRaiseAmount(preset.value)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[0.6rem] font-bold hover:bg-white/10 transition-colors uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-[--ring-active]"
              >
                {preset.label}
              </button>
            ))}
            <button
              data-testid="action-all-in"
              onClick={() => {
                setShowRaisePanel(false);
                onAction("ALL_IN");
              }}
              className="px-3 py-1.5 rounded-lg bg-[--tertiary]/10 border border-[--tertiary]/20 text-[0.6rem] font-bold text-[--tertiary] hover:bg-[--tertiary]/20 transition-colors uppercase tracking-widest focus-visible:ring-2 focus-visible:ring-[--ring-active]"
            >
              All-In
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

// ── Action Button (mobile only) ───────────────────────────────────────────────

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
      {/* Icon container */}
      <div className="w-12 h-12 flex items-center justify-center rounded-xl">
        {icon}
      </div>

      {/* Label */}
      <span className="font-body font-medium text-[10px] tracking-wide">{label}</span>

      {/* Keyboard shortcut badge (desktop only) */}
      <span className="hidden md:inline text-[8px] font-mono opacity-35">{shortcut}</span>
    </motion.button>
  );
});
