"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";
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
  const [showSlider, setShowSlider] = useState(false);

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
            setShowSlider(prev => !prev);
          }
          break;
        case "enter":
          if (canRaise && showSlider) handleRaise();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, canRaise, handleRaise, onAction, showSlider]);


  // ── Mobile compact layout ─────────────────────────────────────────────────
  if (compact) {
    const inactiveClasses = !isActive ? "opacity-40 grayscale-[0.4] pointer-events-none" : "";

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto px-2 pb-4 flex flex-col items-center gap-2">
          {/* Bet Slider - Floating above the main bar when active */}
          <AnimatePresence>
            {isActive && canRaise && showSlider && (
              <div className="w-full pointer-events-auto">
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
              </div>
            )}
          </AnimatePresence>

          {/* Main Action Bar */}
          <div className={`w-full pointer-events-auto transition-all duration-300 ${inactiveClasses}`}>
            <div className="glass-panel rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <BankDisplay 
                amount={bank ?? stack} 
                timer={turnTimer}
                className="shrink-0"
              />

              <div className="flex items-center gap-2 flex-1 justify-end">
                <ActionButton
                  variant="fold"
                  label="FOLD"
                  compact
                  onClick={() => onAction("FOLD")}
                  disabled={!isActive}
                />
                <ActionButton
                  variant={toCall > 0 ? "call" : "check"}
                  label={toCall > 0 ? `CALL ${toCall}` : "CHECK"}
                  compact
                  onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
                  disabled={!isActive}
                />
                {canRaise && (
                  <ActionButton
                    variant="raise"
                    label={showSlider ? "BACK" : "RAISE"}
                    compact
                    onClick={() => setShowSlider(!showSlider)}
                    active={showSlider}
                    disabled={!isActive}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: unified action panel ──────────────────────────────────────────
  const inactiveClasses = !isActive ? "opacity-40 grayscale-[0.4] pointer-events-none" : "";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 pb-8 flex flex-col items-center gap-6">
        {/* Bet Slider - Floating above the main bar when active */}
        <AnimatePresence>
          {isActive && canRaise && showSlider && (
            <div className="w-full max-w-2xl pointer-events-auto">
              <BetSlider
                value={raiseAmount}
                min={minRaiseTo}
                max={maxRaiseTo}
                pot={pot}
                onChange={setRaiseAmount}
                onConfirm={handleRaise}
                onAllIn={handleAllIn}
                compact={compact}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Main Action Bar */}
        <div className={`w-full pointer-events-auto transition-all duration-500 ${inactiveClasses}`}>
          <div className="glass-panel rounded-2xl border border-white/10 p-4 flex items-center justify-between gap-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {/* Left: Bank & Timer */}
            <BankDisplay 
              amount={bank ?? stack} 
              timer={turnTimer}
              className="shrink-0"
            />

            {/* Center: Action Buttons */}
            <div className="flex items-center gap-4 flex-1 justify-center">
              <ActionButton
                variant="fold"
                label="FOLD"
                shortcut="F"
                onClick={() => onAction("FOLD")}
                disabled={!isActive}
              />
              <ActionButton
                variant={toCall > 0 ? "call" : "check"}
                label={toCall > 0 ? `CALL ${toCall.toLocaleString()}` : "CHECK"}
                shortcut="C"
                onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
                disabled={!isActive}
              />
              {canRaise && (
                <ActionButton
                  variant="raise"
                  label={showSlider ? "CANCEL" : "RAISE"}
                  shortcut="R"
                  onClick={() => setShowSlider(!showSlider)}
                  active={showSlider}
                  disabled={!isActive}
                />
              )}
              {!canRaise && stack > 0 && (
                <ActionButton
                  variant="all-in"
                  label="ALL-IN"
                  shortcut="A"
                  onClick={handleAllIn}
                  disabled={!isActive}
                />
              )}
            </div>

            {/* Right: Pot Display (Desktop) */}
            <div className="hidden lg:flex flex-col items-end shrink-0 min-w-[120px]">
              <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-white/40 mb-1">CURRENT POT</span>
              <span className="text-2xl font-bold text-[--color-tertiary] font-mono">{pot.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
