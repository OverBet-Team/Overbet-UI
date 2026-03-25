"use client";

// OverBet — ActionBar (Moon Poker glass dock redesign)
// Mobile: icon-above-label columns in rounded glass dock
// Desktop: horizontal integrated layout with raise slider
// Keyboard shortcuts: F=fold, C=call/check, R=raise, A=all-in

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChipAmount, ChipIcon } from "./ChipAmount";

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
  onAction,
}: ActionBarProps) {
  const minRaiseTo = Math.max(currentBet + minRaise, currentBet * 2, 1);
  const maxRaiseTo = stack + playerBet;
  const toCall = Math.max(0, currentBet - playerBet);
  const canRaise = maxRaiseTo > minRaiseTo;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);
  const [showRaisePanel, setShowRaisePanel] = useState(false);

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

  // ── Active state ──────────────────────────────────────────────────────────
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
          icon={<span className="text-2xl">×</span>}
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
          icon={<span className="text-2xl">✓</span>}
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
            icon={<span className="text-2xl">↗</span>}
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

// ── Action Button ─────────────────────────────────────────────────────────────

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
