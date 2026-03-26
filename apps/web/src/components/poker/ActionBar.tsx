"use client";

// OverBet — ActionBar (Simplified: 3 permanent buttons, no modals)
// Desktop: FOLD | CHECK/CALL | RAISE with inline slider
// Mobile: Compact vertical button layout
// Keyboard shortcuts: F=fold, C=call/check, R=raise (shows slider), A=all-in

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check, ArrowUpRight } from "lucide-react";
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
        className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-center items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] opacity-35 grayscale-[0.5]"
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

  // ── Desktop: 3 buttons + inline slider ────────────────────────────────────
  return (
    <div data-testid="action-bar" className="flex flex-col w-full font-body">
      <nav className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 px-6 py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-6">
        
        {/* FOLD button */}
        <button
          data-testid="action-fold"
          onClick={() => onAction("FOLD")}
          className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl bg-[--secondary]/10 hover:bg-[--secondary]/20 text-[--secondary] transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active]"
        >
          <X size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">Fold</span>
          <span className="text-[8px] font-mono opacity-35">F</span>
        </button>

        {/* CHECK/CALL button */}
        <button
          data-testid="action-check-call"
          onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          className={`flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active] ${
            toCall > 0
              ? "bg-[--tertiary]/10 hover:bg-[--tertiary]/20 text-[--tertiary]"
              : "bg-white/5 hover:bg-white/10 text-white/80"
          }`}
        >
          <Check size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {toCall > 0 ? `Call ${toCall}` : "Check"}
          </span>
          <span className="text-[8px] font-mono opacity-35">C</span>
        </button>

        {/* RAISE button */}
        {canRaise && (
          <button
            data-testid="action-raise"
            onClick={() => setShowRaiseSlider((v) => !v)}
            className={`flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active] ${
              showRaiseSlider
                ? "bg-[--tertiary]/20 text-[--tertiary] scale-105"
                : "bg-[--tertiary]/10 hover:bg-[--tertiary]/20 text-[--tertiary]"
            }`}
          >
            <ArrowUpRight size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Raise</span>
            <span className="text-[8px] font-mono opacity-35">R</span>
          </button>
        )}

        {/* ALL-IN button */}
        <button
          data-testid="action-all-in"
          onClick={() => onAction("ALL_IN")}
          className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl bg-[--gold]/10 hover:bg-[--gold]/20 text-[--gold] transition-all focus-visible:ring-2 focus-visible:ring-[--ring-active]"
        >
          <span className="text-xl font-bold">★</span>
          <span className="text-xs font-bold uppercase tracking-wider">All-In</span>
          <span className="text-[8px] font-mono opacity-35">A</span>
        </button>

        {/* Inline raise slider (shows when RAISE clicked) */}
        {showRaiseSlider && canRaise && (
          <div className="flex items-center gap-4 px-6 py-3 bg-black/30 rounded-xl border border-white/10">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Amount</span>
              <span className="text-lg font-bold text-[--tertiary]">{raiseAmount}</span>
            </div>
            <input
              type="range"
              min={minRaiseTo}
              max={maxRaiseTo}
              step={1}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="bet-slider w-32"
            />
            <div className="flex gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRaiseAmount(preset.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleRaise}
              className="px-4 py-2 rounded-lg bg-[--tertiary] text-white font-bold text-sm hover:bg-[--tertiary-dim] whitespace-nowrap"
            >
              Confirm ↵
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}

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
