"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChipAmount, ChipIcon } from "./ChipAmount";

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

  useEffect(() => {
    setRaiseAmount((previous) => Math.min(Math.max(previous, minRaiseTo), maxRaiseTo));
  }, [maxRaiseTo, minRaiseTo]);

  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);

  const presets = useMemo(
    () =>
      pot > 0
        ? [
            { label: "½ Pot", value: Math.min(Math.max(Math.round(pot * 0.5), minRaiseTo), maxRaiseTo) },
            { label: "Pot", value: Math.min(Math.max(pot, minRaiseTo), maxRaiseTo) },
            { label: "2× Pot", value: Math.min(Math.max(pot * 2, minRaiseTo), maxRaiseTo) },
          ]
        : [],
    [pot, minRaiseTo, maxRaiseTo],
  );

  const closeRaisePanel = useCallback(() => {
    setShowRaisePanel(false);
  }, []);

  const confirmRaise = useCallback(() => {
    onAction("RAISE", clampedRaise);
    setShowRaisePanel(false);
  }, [clampedRaise, onAction]);

  useEffect(() => {
    if (!isActive) return;

    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (event.key.toLowerCase()) {
        case "f":
          onAction("FOLD");
          break;
        case "c":
          onAction(toCall > 0 ? "CALL" : "CHECK");
          break;
        case "r":
          if (canRaise) setShowRaisePanel((value) => !value);
          break;
        case "a":
          onAction("ALL_IN");
          break;
        case "escape":
          setShowRaisePanel(false);
          break;
        case "enter":
          if (showRaisePanel && canRaise) confirmRaise();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canRaise, confirmRaise, isActive, onAction, showRaisePanel, toCall]);

  if (!isActive) {
    return (
      <div
        data-testid="action-bar-inactive"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: 0.82,
        }}
      >
        <div
          style={{
            minWidth: compact ? "100%" : 320,
            maxWidth: compact ? "100%" : 420,
            padding: compact ? "12px 16px" : "14px 18px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(10, 9, 19, 0.82)",
            color: "rgba(255,255,255,0.38)",
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            textAlign: "center",
            boxShadow: "0 12px 26px rgba(0,0,0,0.24)",
            backdropFilter: "blur(18px)",
          }}
        >
          Waiting for turn…
        </div>
      </div>
    );
  }

  const raisePanel = showRaisePanel && canRaise ? (
    <>
      <div
        data-testid="raise-modal-backdrop"
        onClick={closeRaisePanel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          background: compact ? "rgba(5,4,10,0.6)" : "rgba(5,4,10,0.48)",
          backdropFilter: "blur(6px)",
        }}
      />
      <div
        data-testid="raise-modal"
        style={{
          position: "fixed",
          left: "50%",
          bottom: compact ? "calc(92px + env(safe-area-inset-bottom, 0px))" : 42,
          transform: "translateX(-50%)",
          width: compact ? "min(92vw, 420px)" : "min(560px, calc(100vw - 48px))",
          zIndex: 1000,
          borderRadius: 26,
          padding: compact ? "18px 16px" : "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "linear-gradient(180deg, rgba(16,13,28,0.98) 0%, rgba(11,10,20,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 28px 70px rgba(0,0,0,0.52)",
          backdropFilter: "blur(24px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Raise amount
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ChipIcon size={14} color="#c5b8ff" />
              <input
                type="number"
                value={raiseAmount}
                min={minRaiseTo}
                max={maxRaiseTo}
                onChange={(event) => setRaiseAmount(Number(event.target.value))}
                onBlur={() => setRaiseAmount(clampedRaise)}
                style={{
                  width: 120,
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.14)",
                  padding: "0 0 6px",
                  color: "#ffffff",
                  background: "transparent",
                  fontSize: compact ? 28 : 34,
                  fontWeight: 800,
                  outline: "none",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            </div>
          </div>
          <button
            onClick={closeRaisePanel}
            aria-label="Close raise panel"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.74)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            value={raiseAmount}
            step={Math.max(1, Math.round((maxRaiseTo - minRaiseTo) / 100))}
            onChange={(event) => setRaiseAmount(Number(event.target.value))}
            style={{ width: "100%", accentColor: "#8c84ff" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
            <span>{minRaiseTo}</span>
            <span>{maxRaiseTo}</span>
          </div>
        </div>

        {presets.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))`, gap: 8 }}>
            {presets.map(({ label, value }) => {
              const selected = raiseAmount === value;
              return (
                <button
                  key={label}
                  onClick={() => setRaiseAmount(value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: selected ? "1px solid rgba(140,132,255,0.42)" : "1px solid rgba(255,255,255,0.08)",
                    background: selected ? "rgba(140,132,255,0.18)" : "rgba(255,255,255,0.04)",
                    color: selected ? "#d4ccff" : "rgba(255,255,255,0.66)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={confirmRaise}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 18px",
            borderRadius: 18,
            border: "1px solid rgba(140,132,255,0.22)",
            background: "linear-gradient(135deg, #7a5af8 0%, #9d7fff 100%)",
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 16px 32px rgba(106, 85, 230, 0.32)",
          }}
        >
          Raise to
          <ChipAmount
            amount={clampedRaise}
            iconSize={13}
            iconColor="#ffffff"
            amountStyle={{ color: "inherit", fontSize: 15, fontWeight: 800 }}
          />
        </button>
      </div>
    </>
  ) : null;

  return (
    <div data-testid="action-bar" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {typeof document !== "undefined" ? createPortal(raisePanel, document.body) : raisePanel}
      <div
        style={{
          width: "100%",
          maxWidth: compact ? "100%" : 540,
          display: "grid",
          gridTemplateColumns: canRaise ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
          gap: compact ? 8 : 10,
          padding: compact ? "8px" : "10px",
          borderRadius: compact ? 24 : 999,
          background: "rgba(10, 9, 19, 0.9)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 18px 36px rgba(0,0,0,0.24)",
          backdropFilter: "blur(24px)",
        }}
      >
        <ActionButton
          testId="action-fold"
          compact={compact}
          tone="danger"
          label="Fold"
          shortcut="F"
          onClick={() => {
            setShowRaisePanel(false);
            onAction("FOLD");
          }}
        />

        <ActionButton
          testId="action-check-call"
          compact={compact}
          tone={toCall > 0 ? "info" : "neutral"}
          label={
            toCall > 0 ? (
              <>
                <span>Call</span>
                <ChipAmount
                  amount={toCall}
                  iconSize={compact ? 10 : 11}
                  iconColor="#8fd5ff"
                  amountStyle={{ color: "inherit", fontSize: compact ? 12 : 13, fontWeight: 700 }}
                />
              </>
            ) : (
              "Check"
            )
          }
          shortcut="C"
          onClick={() => {
            setShowRaisePanel(false);
            onAction(toCall > 0 ? "CALL" : "CHECK");
          }}
        />

        {canRaise && (
          <ActionButton
            testId="action-raise"
            compact={compact}
            tone="success"
            active={showRaisePanel}
            label={showRaisePanel ? "Raise Open" : "Raise"}
            shortcut="R"
            onClick={() => setShowRaisePanel((value) => !value)}
          />
        )}

        <ActionButton
          testId="action-all-in"
          compact={compact}
          tone="accent"
          label="All-In"
          shortcut="A"
          onClick={() => {
            setShowRaisePanel(false);
            onAction("ALL_IN");
          }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  testId,
  label,
  shortcut,
  onClick,
  compact,
  tone,
  active = false,
}: {
  testId: string;
  label: React.ReactNode;
  shortcut: string;
  onClick: () => void;
  compact?: boolean;
  tone: "danger" | "info" | "success" | "accent" | "neutral";
  active?: boolean;
}) {
  const palette = {
    danger: {
      color: "#ff6b84",
      background: active ? "rgba(255,107,132,0.16)" : "rgba(255,255,255,0.02)",
      border: active ? "rgba(255,107,132,0.3)" : "rgba(255,255,255,0.06)",
    },
    info: {
      color: "#8fd5ff",
      background: active ? "rgba(143,213,255,0.16)" : "rgba(255,255,255,0.02)",
      border: active ? "rgba(143,213,255,0.3)" : "rgba(255,255,255,0.06)",
    },
    success: {
      color: "#78edb6",
      background: active ? "rgba(120,237,182,0.16)" : "rgba(255,255,255,0.02)",
      border: active ? "rgba(120,237,182,0.3)" : "rgba(255,255,255,0.06)",
    },
    accent: {
      color: "#b89cff",
      background: active ? "rgba(184,156,255,0.16)" : "rgba(255,255,255,0.02)",
      border: active ? "rgba(184,156,255,0.3)" : "rgba(255,255,255,0.06)",
    },
    neutral: {
      color: "rgba(255,255,255,0.82)",
      background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.02)",
      border: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
    },
  }[tone];

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        minHeight: compact ? 54 : 58,
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 6 : 4,
        padding: compact ? "12px 10px" : "11px 12px 10px",
        borderRadius: compact ? 16 : 18,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        cursor: "pointer",
        transition: "transform 0.16s ease, border-color 0.16s ease, background 0.16s ease",
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-1px)";
        event.currentTarget.style.background = active ? palette.background : "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.background = palette.background;
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: compact ? 13 : 15, fontWeight: 700, lineHeight: 1.1 }}>
        {label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em" }}>{shortcut}</span>
    </button>
  );
}
