"use client";

// OverBet — ActionBar
// Moon Poker action zone: ghost pill buttons, raise slider, quick-bet presets.
// Keyboard shortcuts: F=fold, C=call/check, R=raise, A=all-in

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const presets = pot > 0 ? [
    { label: "½ Pot", value: Math.min(Math.max(Math.round(pot * 0.5), minRaiseTo), maxRaiseTo) },
    { label: "Pot",   value: Math.min(Math.max(pot, minRaiseTo), maxRaiseTo) },
    { label: "2× Pot", value: Math.min(Math.max(pot * 2, minRaiseTo), maxRaiseTo) },
  ] : [];

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
        case "f": onAction("FOLD"); break;
        case "c": onAction(toCall > 0 ? "CALL" : "CHECK"); break;
        case "r": setShowRaisePanel(v => !v); break;
        case "a": onAction("ALL_IN"); break;
        case "escape": setShowRaisePanel(false); break;
        case "enter": if (showRaisePanel) handleRaise(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, showRaisePanel, handleRaise, onAction]);

  // ── Inactive state ────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div data-testid="action-bar-inactive" className="flex w-full gap-3 opacity-35 pointer-events-none grayscale-[0.5]">
        <div className="flex-1 py-3.5 text-center font-semibold text-sm text-white/40 border border-white/[0.07] rounded-full bg-white/[0.03] tracking-tight font-body">
          Waiting for turn…
        </div>
      </div>
    );
  }

  const raisePanelNode = showRaisePanel && canRaise ? (
    <>
      {/* Backdrop — compact uses blur, non-compact is lighter */}
      <div
        data-testid="raise-modal-backdrop"
        onClick={closeRaisePanel}
        className={compact
          ? "fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm"
          : "fixed inset-0 z-[999] bg-black/30"}
      />

      {/* Panel — position varies by compact, layout classes are shared */}
      <div
        data-testid="raise-modal"
        className="bg-[--bg-surface] border border-white/10 rounded-[18px] p-4 flex flex-col gap-3 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] overflow-y-auto"
        style={compact
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
            }}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <span className="text-white/[0.68] text-[11px] font-bold uppercase tracking-wider font-body">
            Raise Amount
          </span>
          <button
            onClick={closeRaisePanel}
            aria-label="Close raise panel"
            className="w-7 h-7 rounded-full border border-white/[0.14] bg-white/5 text-white/75 text-base cursor-pointer hover:bg-white/10 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Amount display */}
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider font-body">
            Raise To
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ChipIcon size={13} color="rgba(167,139,250,0.8)" />
            <input
              type="number"
              value={raiseAmount}
              min={minRaiseTo}
              max={maxRaiseTo}
              onChange={e => setRaiseAmount(Number(e.target.value))}
              onBlur={() => setRaiseAmount(clampedRaise)}
              className="w-20 px-2 py-1 text-right font-bold text-base text-white bg-white/[0.08] border border-white/12 rounded-lg outline-none font-body num-font focus:border-[--accent]/50 transition-colors"
            />
          </div>
        </div>

        {/* Slider — keep inline style for dynamic gradient and accent */}
        <div style={{ position: "relative" }}>
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            value={raiseAmount}
            step={Math.max(1, Math.round((maxRaiseTo - minRaiseTo) / 100))}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            style={{
              width: "100%", accentColor: "#7c3aed",
              background: `linear-gradient(to right, #7c3aed ${((raiseAmount - minRaiseTo) / (maxRaiseTo - minRaiseTo)) * 100}%, rgba(255,255,255,0.1) 0%)`,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{minRaiseTo}</span>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{maxRaiseTo}</span>
          </div>
        </div>

        {/* Quick-bet presets */}
        {presets.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {presets.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setRaiseAmount(value)}
                className={`flex-1 py-1.5 rounded-[10px] border-0 text-[11px] font-semibold cursor-pointer font-body transition-all hover:bg-[--accent]/20 hover:text-violet-300 ${
                  raiseAmount === value
                    ? "bg-[--accent]/35 text-violet-300"
                    : "bg-white/[0.06] text-white/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Confirm raise */}
        <button
          onClick={handleRaise}
          className="w-full py-3 rounded-[14px] border-0 bg-[--accent] text-white font-bold text-sm font-body hover:bg-[--accent-hover] transition-colors shadow-[0_4px_20px_rgba(59,130,246,0.35)] hover:shadow-[0_4px_28px_rgba(59,130,246,0.5)] cursor-pointer"
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
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
    <div data-testid="action-bar" style={{ display: "flex", flexDirection: "column", width: "100%", gap: 8, fontFamily: "Outfit, sans-serif" }}>

      {/* Raise panel (shown when raise button clicked) */}
      {typeof document !== "undefined" ? createPortal(raisePanelNode, document.body) : raisePanelNode}

      {/* Main action row — Moon Poker pill buttons */}
      <div className="flex items-center justify-center flex-nowrap gap-1.5 px-3 py-1.5 bg-[--bg-surface]/85 border border-white/[0.08] rounded-full backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]">

        {/* Fold */}
        <ActionPill
          label="Fold"
          ariaLabel="Fold"
          testId="action-fold"
          shortcut="F"
          color="#f87171"
          hoverClass="hover:bg-[--danger]/10"
          compact={compact}
          onClick={() => { setShowRaisePanel(false); onAction("FOLD"); }}
        />

        <div className="w-px h-7 bg-white/[0.07]" />

        {/* Call / Check */}
        <ActionPill
          label={toCall > 0 ? (
            <>
              <span>Call</span>
              <ChipAmount
                amount={toCall}
                iconSize={10}
                iconColor="#93c5fd"
                amountStyle={{ color: "inherit", fontSize: compact ? 12 : 13, fontWeight: 600 }}
              />
            </>
          ) : "Check"}
          ariaLabel={toCall > 0 ? `Call ${toCall}` : "Check"}
          testId="action-check-call"
          shortcut="C"
          color={toCall > 0 ? "#93c5fd" : "rgba(255,255,255,0.7)"}
          hoverClass={toCall > 0 ? "hover:bg-[--accent]/10" : "hover:bg-white/[0.07]"}
          compact={compact}
          onClick={() => { setShowRaisePanel(false); onAction(toCall > 0 ? "CALL" : "CHECK"); }}
        />

        {canRaise && (
          <>
            <div className="w-px h-7 bg-white/[0.07]" />

            {/* Raise — active when panel is open */}
            <ActionPill
              label={showRaisePanel ? "▲ Raise" : "Raise"}
              ariaLabel={showRaisePanel ? "Close raise panel" : "Open raise panel"}
              testId="action-raise"
              shortcut="R"
              color="#6ee7b7"
              hoverClass="hover:bg-[--success]/10"
              activeClass="bg-[--success]/10"
              active={showRaisePanel}
              compact={compact}
              onClick={() => setShowRaisePanel(v => !v)}
            />
          </>
        )}

        <div className="w-px h-7 bg-white/[0.07]" />

        {/* All-In */}
        <ActionPill
          label="All-In"
          ariaLabel="All in"
          testId="action-all-in"
          shortcut="A"
          color="#a78bfa"
          hoverClass="hover:bg-violet-500/12"
          compact={compact}
          onClick={() => { setShowRaisePanel(false); onAction("ALL_IN"); }}
        />
      </div>
    </div>
  );
}

// ── Pill button ───────────────────────────────────────────────────────────────
// Hover state is handled entirely via Tailwind `hover:` classes — no JS state needed.
// `activeClass` applies the hover background permanently (used when raise panel is open).
function ActionPill({
  label, ariaLabel, shortcut, color, hoverClass, activeClass, onClick, active = false, compact = false, testId,
}: {
  label: React.ReactNode;
  ariaLabel?: string;
  shortcut: string;
  color: string;
  hoverClass: string;
  /** Background class applied permanently when active=true (same color as hover bg). */
  activeClass?: string;
  onClick: () => void;
  active?: boolean;
  compact?: boolean;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border-0 cursor-pointer transition-colors whitespace-nowrap font-semibold tracking-tight",
        compact ? "min-h-[42px] px-3 py-2 text-[13px]" : "min-h-[40px] px-5 py-2.5 text-[14px]",
        hoverClass,
        active && activeClass ? activeClass : "bg-transparent",
      ].join(" ")}
      style={{ color }}
    >
      {label}
      <span className="text-[9px] font-normal opacity-35 font-mono">
        {shortcut}
      </span>
    </button>
  );
}
