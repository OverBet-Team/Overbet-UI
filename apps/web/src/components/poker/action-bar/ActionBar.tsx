"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { X, Check, ArrowUpRight } from "lucide-react";
import { BankDisplay } from "./BankDisplay";
import { TimerRing } from "./TimerRing";
import { ActionButton } from "./ActionButton";
import { BetSlider } from "./BetSlider";
import type { ActionBarProps } from "./types";

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

  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Clamp raiseAmount to valid range (derived state)
  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);

  const handleRaise = useCallback(() => {
    onAction("RAISE", clampedRaise);
    setShowRaiseSlider(false);
  }, [onAction, clampedRaise]);

  const handleAllIn = useCallback(() => {
    onAction("ALL_IN");
    setShowRaiseSlider(false);
  }, [onAction]);

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
        <nav
          aria-label="Game actions"
          className="glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-around items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]"
        >
          <ActionButton
            variant="fold"
            icon={<X size={24} />}
            label="Fold"
            shortcut="F"
            compact
            testId="action-fold"
            onClick={() => onAction("FOLD")}
          />

          <ActionButton
            variant={toCall > 0 ? "call" : "check"}
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
            compact
            testId="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          />

          {canRaise && (
            <ActionButton
              variant="raise"
              icon={<ArrowUpRight size={24} />}
              label="Raise"
              shortcut="R"
              compact
              active={showRaiseSlider}
              testId="action-raise"
              onClick={() => setShowRaiseSlider((v) => !v)}
            />
          )}

          <ActionButton
            variant="all-in"
            icon={<span className="text-2xl font-bold">★</span>}
            label="All-In"
            shortcut="A"
            compact
            testId="action-all-in"
            onClick={() => onAction("ALL_IN")}
          />
        </nav>

        <AnimatePresence>
          {showRaiseSlider && canRaise && (
            <BetSlider
              value={raiseAmount}
              min={minRaiseTo}
              max={maxRaiseTo}
              pot={pot}
              onChange={setRaiseAmount}
              onConfirm={handleRaise}
              onAllIn={handleAllIn}
              compact
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Desktop: unified action panel ──────────────────────────────────────────
  return (
    <div data-testid="action-bar" className="flex flex-col w-full font-body">
      <nav
        aria-label="Game actions"
        className="glass-dock rounded-2xl border border-[--outline-variant]/15 px-5 py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] flex items-center gap-4"
      >
        {/* Left cluster: Bank + Timer */}
        <div className="flex items-center gap-4 shrink-0">
          <BankDisplay amount={bank ?? stack} />

          {turnTimer && turnTimer.playerId === userId && (
            <TimerRing timer={turnTimer} />
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-10 bg-white/10 shrink-0" />

        {/* Center: Action buttons */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <ActionButton
            variant="fold"
            icon={<X size={18} className="text-[--danger]" />}
            label="Fold"
            testId="action-fold"
            onClick={() => onAction("FOLD")}
          />

          <ActionButton
            variant={toCall > 0 ? "call" : "check"}
            icon={<Check size={18} />}
            label={toCall > 0 ? `Call ${toCall}` : "Check"}
            testId="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          />

          {canRaise && (
            <ActionButton
              variant="raise"
              icon={<ArrowUpRight size={18} />}
              label="Raise"
              active={showRaiseSlider}
              testId="action-raise"
              onClick={() => setShowRaiseSlider((v) => !v)}
            />
          )}
        </div>

        <AnimatePresence>
          {showRaiseSlider && canRaise && (
            <>
              {/* Separator */}
              <div className="w-px h-10 bg-white/10 shrink-0" />

              <BetSlider
                value={raiseAmount}
                min={minRaiseTo}
                max={maxRaiseTo}
                pot={pot}
                onChange={setRaiseAmount}
                onConfirm={handleRaise}
                onAllIn={handleAllIn}
              />
            </>
          )}
        </AnimatePresence>
      </nav>
    </div>
  );
}
