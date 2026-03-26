"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Check } from "lucide-react";
import { BankDisplay } from "./BankDisplay";
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

  // Clamp raiseAmount to valid range (derived state)
  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);

  const handleRaise = useCallback(() => {
    onAction("RAISE", clampedRaise);
  }, [onAction, clampedRaise]);

  const handleAllIn = useCallback(() => {
    onAction("ALL_IN");
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
            // Focus the slider input
            const slider = document.querySelector<HTMLInputElement>('input[type="range"][aria-label="Bet amount"]');
            slider?.focus();
          }
          break;
        case "enter":
          if (canRaise) handleRaise();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, canRaise, handleRaise, onAction]);


  // ── Mobile compact layout ─────────────────────────────────────────────────
  // ── Mobile compact layout ─────────────────────────────────────────────────
  if (compact) {
    const inactiveClasses = !isActive ? "opacity-40 grayscale-[0.4] pointer-events-none" : "";

    return (
      <div data-testid="action-bar" className="flex flex-col w-full font-body">
        <nav
          aria-label="Game actions"
          className={`glass-dock rounded-t-[1.5rem] border-t border-[--outline-variant]/20 flex justify-around items-center px-4 pb-8 pt-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] transition-all duration-300 ${inactiveClasses}`}
        >
          <ActionButton
            variant="fold"
            icon={<X size={24} />}
            label="Fold"
            shortcut="F"
            compact
            disabled={!isActive}
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
            disabled={!isActive}
            testId="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          />


          <ActionButton
            variant="all-in"
            icon={<span className="text-2xl font-bold">★</span>}
            label="All-In"
            shortcut="A"
            compact
            disabled={!isActive}
            testId="action-all-in"
            onClick={() => onAction("ALL_IN")}
          />
        </nav>

        {canRaise && (
          <BetSlider
            value={raiseAmount}
            min={minRaiseTo}
            max={maxRaiseTo}
            pot={pot}
            onChange={setRaiseAmount}
            onConfirm={handleRaise}
            onAllIn={handleAllIn}
            disabled={!isActive}
            compact
          />
        )}
      </div>
    );
  }

  // ── Desktop: unified action panel ──────────────────────────────────────────
  const inactiveClasses = !isActive ? "opacity-40 grayscale-[0.4] pointer-events-none" : "";

  return (
    <div data-testid="action-bar" className="flex flex-col w-full font-body">
      <nav
        aria-label="Game actions"
        className={`glass-dock rounded-2xl border border-[--outline-variant]/15 px-5 py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 transition-all duration-300 ${inactiveClasses}`}
      >
        {/* Left cluster: Bank + Timer */}
        <div className="flex items-center gap-4 shrink-0">
          <BankDisplay 
            amount={bank ?? stack} 
            timer={turnTimer}
          />
        </div>

        {/* Separator */}
        <div className="w-px h-10 bg-white/10 shrink-0" />

        {/* Center: Action buttons */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <ActionButton
            variant="fold"
            icon={<X size={18} className="text-[--danger]" />}
            label="Fold"
            disabled={!isActive}
            testId="action-fold"
            onClick={() => onAction("FOLD")}
          />

          <ActionButton
            variant={toCall > 0 ? "call" : "check"}
            icon={<Check size={18} />}
            label={toCall > 0 ? `Call ${toCall}` : "Check"}
            disabled={!isActive}
            testId="action-check-call"
            onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          />

        </div>

        {canRaise && (
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
              disabled={!isActive}
            />
          </>
        )}
      </nav>
    </div>
  );
}
