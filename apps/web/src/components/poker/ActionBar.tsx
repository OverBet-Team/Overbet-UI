"use client";

// OverBet — ActionBar
// Moon Poker action zone: ghost pill buttons, raise slider, quick-bet presets.
// Keyboard shortcuts: F=fold, C=call/check, R=raise, A=all-in

import React, { useState, useEffect, useCallback } from "react";

interface ActionBarProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  compact?: boolean;
  onAction: (actionType: string, amount?: number) => void;
}

// ── Chip icon ─────────────────────────────────────────────────────────────────
function ChipIcon({ size = 12, color = "rgba(255,255,255,0.5)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="10" cy="10" r="2" fill={color} />
    </svg>
  );
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
        case "enter": if (showRaisePanel) handleRaise(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, toCall, showRaisePanel, handleRaise, onAction]);

  // ── Inactive state ────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div style={{
        display: "flex", width: "100%", gap: 12,
        opacity: 0.35, pointerEvents: "none", filter: "grayscale(0.5)",
      }}>
        <div style={{
          flex: 1, padding: "14px 0", textAlign: "center",
          fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 999,
          background: "rgba(255,255,255,0.03)", fontFamily: "Outfit, sans-serif",
          letterSpacing: "0.01em",
        }}>
          Waiting for turn…
        </div>
      </div>
    );
  }

  // ── Active state ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 8, fontFamily: "Outfit, sans-serif" }}>

      {/* Raise panel (shown when raise button clicked) */}
      {showRaisePanel && canRaise && (
        <div style={{
          ...(compact
            ? {
                position: "fixed",
                left: 10,
                right: 10,
                bottom: "calc(86px + env(safe-area-inset-bottom, 0px))",
                zIndex: 75,
                borderRadius: 18,
                maxHeight: "66dvh",
                overflowY: "auto",
              }
            : {}),
          background: "rgba(16,13,28,0.97)", border: "1px solid rgba(255,255,255,0.1)",
          padding: compact ? "14px 14px" : "16px 18px", display: "flex", flexDirection: "column", gap: 12,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Amount display */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                style={{
                  width: 80, padding: "4px 8px", textAlign: "right",
                  fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: 16,
                  color: "#fff", background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, outline: "none",
                  fontVariantNumeric: "tabular-nums",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)"; }}
              />
            </div>
          </div>

          {/* Slider */}
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
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 10, border: "none",
                    background: raiseAmount === value ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.06)",
                    color: raiseAmount === value ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    fontFamily: "Outfit, sans-serif", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(124,58,237,0.2)"; e.currentTarget.style.color = "#c4b5fd"; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = raiseAmount === value ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = raiseAmount === value ? "#c4b5fd" : "rgba(255,255,255,0.5)";
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Confirm raise */}
          <button
            onClick={handleRaise}
            style={{
              padding: "12px 0", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              color: "#fff", fontFamily: "Outfit, sans-serif",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 28px rgba(124,58,237,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.35)"; }}
          >
            Raise to {clampedRaise.toLocaleString()} ↵
          </button>
        </div>
      )}

      {/* Main action row — Moon Poker pill buttons */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexWrap: compact ? "wrap" : "nowrap",
        gap: compact ? 4 : 6,
        padding: compact ? "4px 8px" : "6px 12px",
        background: "rgba(10,8,20,0.85)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 999, backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>

        {/* Fold */}
        <ActionPill
          label="Fold"
          shortcut="F"
          color="#f87171"
          hoverBg="rgba(248,113,113,0.1)"
          compact={compact}
          onClick={() => onAction("FOLD")}
        />

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

        {/* Check / Call */}
        <ActionPill
          label={toCall > 0 ? `Call ${toCall.toLocaleString()}` : "Check"}
          shortcut="C"
          color={toCall > 0 ? "#93c5fd" : "rgba(255,255,255,0.7)"}
          hoverBg={toCall > 0 ? "rgba(147,197,253,0.1)" : "rgba(255,255,255,0.07)"}
          compact={compact}
          onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
        />

        {canRaise && (
          <>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

            {/* Raise */}
            <ActionPill
              label={showRaisePanel ? "▲ Raise" : "Raise"}
              shortcut="R"
              color="#6ee7b7"
              hoverBg="rgba(110,231,183,0.1)"
              active={showRaisePanel}
              compact={compact}
              onClick={() => setShowRaisePanel(v => !v)}
            />
          </>
        )}

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

        {/* All-In */}
        <ActionPill
          label="All-In"
          shortcut="A"
          color="#a78bfa"
          hoverBg="rgba(167,139,250,0.12)"
          compact={compact}
          onClick={() => onAction("ALL_IN")}
        />
      </div>
    </div>
  );
}

// ── Pill button ───────────────────────────────────────────────────────────────
function ActionPill({
  label, shortcut, color, hoverBg, onClick, active = false, compact = false,
}: {
  label: string; shortcut: string; color: string; hoverBg: string;
  onClick: () => void; active?: boolean; compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        minHeight: compact ? 42 : 40,
        padding: compact ? "8px 12px" : "10px 20px", borderRadius: 999, border: "none",
        background: active ? hoverBg : hovered ? hoverBg : "transparent",
        color, fontFamily: "Outfit, sans-serif", fontSize: compact ? 13 : 14, fontWeight: 600,
        cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {label}
      <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.35, fontFamily: "monospace" }}>
        {shortcut}
      </span>
    </button>
  );
}
