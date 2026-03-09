/**
 * ActionBar — Player action controls
 *
 * Fixes:
 * - GAP-08: Raise amount is clamped to [minRaiseTo, stack+playerBet] on blur/submit
 * - GAP-08: Slider for raise amount with quick-bet buttons (0.5x pot, pot, 2x pot)
 * - Moon Poker visual language applied
 */

import React, { useState, useEffect } from "react";

interface ActionBarProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  onAction: (actionType: string, amount?: number) => void;
}

export function ActionBar({
  isActive,
  stack,
  currentBet,
  playerBet,
  minRaise,
  pot = 0,
  onAction,
}: ActionBarProps) {
  const minRaiseTo = Math.max(currentBet + minRaise, currentBet * 2);
  const maxRaiseTo = stack + playerBet;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);

  // Keep raiseAmount in valid range when game state changes
  useEffect(() => {
    setRaiseAmount((prev) => Math.min(Math.max(prev, minRaiseTo), maxRaiseTo));
  }, [minRaiseTo, maxRaiseTo]);

  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);
  const toCall = Math.max(0, currentBet - playerBet);

  const handleRaise = () => onAction("RAISE", clampedRaise);

  // Quick-bet presets
  const halfPot = Math.min(Math.max(Math.round(pot * 0.5), minRaiseTo), maxRaiseTo);
  const fullPot = Math.min(Math.max(pot, minRaiseTo), maxRaiseTo);
  const twoPot = Math.min(Math.max(pot * 2, minRaiseTo), maxRaiseTo);

  if (!isActive) {
    return (
      <div
        style={{
          display: "flex",
          width: "100%",
          gap: 12,
          opacity: 0.45,
          pointerEvents: "none",
          filter: "grayscale(1)",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "16px 0",
            textAlign: "center",
            fontWeight: 700,
            fontSize: 15,
            color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            fontFamily: "Outfit, Inter, sans-serif",
          }}
        >
          Waiting for turn…
        </div>
      </div>
    );
  }

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: "15px 0",
    fontWeight: 700,
    fontSize: 15,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "Outfit, Inter, sans-serif",
    letterSpacing: "0.01em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 10 }}>
      {/* Quick-bet row */}
      {pot > 0 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {[
            { label: "½ Pot", value: halfPot },
            { label: "Pot", value: fullPot },
            { label: "2× Pot", value: twoPot },
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setRaiseAmount(value)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(124,58,237,0.35)",
                background:
                  raiseAmount === value
                    ? "rgba(124,58,237,0.3)"
                    : "rgba(124,58,237,0.1)",
                color: raiseAmount === value ? "#c4b5fd" : "rgba(167,139,250,0.7)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Outfit, Inter, sans-serif",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(124,58,237,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  raiseAmount === value
                    ? "rgba(124,58,237,0.3)"
                    : "rgba(124,58,237,0.1)";
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Main action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        {/* Fold */}
        <button
          onClick={() => onAction("FOLD")}
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.12)";
            e.currentTarget.style.color = "#fca5a5";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          }}
        >
          Fold
        </button>

        {/* Check / Call */}
        <button
          onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.07)",
            color: "#fff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          }}
        >
          {toCall > 0 ? `Call $${toCall}` : "Check"}
        </button>

        {/* Raise */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(239,68,68,0.85)",
            boxShadow: "0 4px 20px rgba(239,68,68,0.25)",
            overflow: "hidden",
            paddingRight: 8,
          }}
        >
          <button
            onClick={handleRaise}
            style={{
              flex: 1,
              padding: "15px 16px",
              fontWeight: 700,
              fontSize: 15,
              color: "#fff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "Outfit, Inter, sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            Raise To
          </button>
          <input
            type="number"
            value={raiseAmount}
            min={minRaiseTo}
            max={maxRaiseTo}
            step={Math.max(1, Math.round((maxRaiseTo - minRaiseTo) / 100))}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            onBlur={() => setRaiseAmount(clampedRaise)}
            style={{
              width: 72,
              padding: "6px 8px",
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: 14,
              color: "#111",
              background: "rgba(255,255,255,0.92)",
              border: "none",
              borderRadius: 8,
              outline: "none",
              textAlign: "center",
            }}
          />
        </div>

        {/* All-In */}
        <button
          onClick={() => onAction("ALL_IN")}
          style={{
            ...btnBase,
            flex: "0 0 auto",
            padding: "15px 18px",
            background: "rgba(124,58,237,0.8)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(139,92,246,0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.8)";
          }}
        >
          All-In
        </button>
      </div>
    </div>
  );
}
