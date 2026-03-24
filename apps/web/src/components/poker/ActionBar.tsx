"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChipAmount, ChipIcon } from "./ChipAmount";

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

function SurfaceButton({
  children,
  onClick,
  testId,
  ariaLabel,
  emphasized,
  danger,
  compact,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
  emphasized?: boolean;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <motion.button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        minHeight: compact ? 44 : 52,
        padding: compact ? "0 14px" : "0 18px",
        borderRadius: 18,
        border: emphasized
          ? "1px solid rgba(129,236,255,0.36)"
          : danger
            ? "1px solid rgba(244,63,94,0.22)"
            : "1px solid rgba(255,255,255,0.08)",
        background: emphasized
          ? "linear-gradient(180deg, rgba(129,236,255,0.96) 0%, rgba(0,212,236,0.82) 100%)"
          : danger
            ? "linear-gradient(180deg, rgba(244,63,94,0.14) 0%, rgba(79,18,32,0.14) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        color: emphasized ? "#0e0e10" : danger ? "#ffadc0" : "#f6f3f5",
        fontSize: compact ? 12 : 13,
        fontWeight: 700,
        letterSpacing: emphasized ? "-0.02em" : "0.01em",
        cursor: "pointer",
        boxShadow: emphasized
          ? "0 16px 34px rgba(0, 227, 253, 0.2), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 30px rgba(0,0,0,0.18)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </motion.button>
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
  const maxRaiseTo = Math.max(minRaiseTo, stack + playerBet);
  const toCall = Math.max(0, currentBet - playerBet);
  const canRaise = maxRaiseTo > minRaiseTo;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);
  const [showRaisePanel, setShowRaisePanel] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    setRaiseAmount((previous) => Math.min(Math.max(previous, minRaiseTo), maxRaiseTo));
  }, [minRaiseTo, maxRaiseTo]);

  const clampedRaise = Math.min(Math.max(raiseAmount, minRaiseTo), maxRaiseTo);
  const sliderDisabled = minRaiseTo >= maxRaiseTo;
  const sliderPct = sliderDisabled ? 0 : ((clampedRaise - minRaiseTo) / (maxRaiseTo - minRaiseTo)) * 100;

  const presets = useMemo(() => {
    if (pot <= 0) return [];
    return [
      { label: "1/2 Pot", value: Math.min(Math.max(Math.round(pot * 0.5), minRaiseTo), maxRaiseTo) },
      { label: "Pot", value: Math.min(Math.max(Math.round(pot), minRaiseTo), maxRaiseTo) },
      { label: "2x Pot", value: Math.min(Math.max(Math.round(pot * 2), minRaiseTo), maxRaiseTo) },
    ];
  }, [pot, minRaiseTo, maxRaiseTo]);

  const confirmRaise = useCallback(() => {
    setActionPending(true);
    onAction("RAISE", clampedRaise);
    setShowRaisePanel(false);
  }, [clampedRaise, onAction]);

  useEffect(() => {
    if (!actionPending) return;
    if (!isActive) {
      setActionPending(false);
      return;
    }

    const timeout = window.setTimeout(() => setActionPending(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [actionPending, isActive]);

  useEffect(() => {
    if (!isActive || actionPending) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (event.key.toLowerCase()) {
        case "f":
          setActionPending(true);
          onAction("FOLD");
          break;
        case "c":
          setActionPending(true);
          onAction(toCall > 0 ? "CALL" : "CHECK");
          break;
        case "r":
          if (canRaise) setShowRaisePanel((previous) => !previous);
          break;
        case "a":
          setActionPending(true);
          onAction("ALL_IN");
          break;
        case "escape":
          setShowRaisePanel(false);
          break;
        case "enter":
          if (showRaisePanel && canRaise) {
            confirmRaise();
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionPending, canRaise, confirmRaise, isActive, onAction, showRaisePanel, toCall]);

  if (!isActive || actionPending) {
    return (
      <div
        data-testid="action-bar-inactive"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: compact ? 50 : 58,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)",
          color: "rgba(255,255,255,0.4)",
          fontSize: compact ? 11 : 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        Waiting for turn
      </div>
    );
  }

  return (
    <div data-testid="action-bar" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : `repeat(${canRaise ? 4 : 3}, minmax(0, 1fr))`,
          gap: 8,
          alignItems: "center",
        }}
      >
        <SurfaceButton
          testId="action-fold"
          ariaLabel="Fold"
          onClick={() => {
            setActionPending(true);
            setShowRaisePanel(false);
            onAction("FOLD");
          }}
          danger
          compact={compact}
        >
          <span style={{ fontSize: 14 }}>Fold</span>
        </SurfaceButton>

        <SurfaceButton
          testId="action-check-call"
          ariaLabel={toCall > 0 ? `Call ${toCall}` : "Check"}
          onClick={() => {
            setActionPending(true);
            setShowRaisePanel(false);
            onAction(toCall > 0 ? "CALL" : "CHECK");
          }}
          compact={compact}
        >
          {toCall > 0 ? (
            <>
              <span>Call</span>
              <ChipAmount
                amount={toCall}
                iconSize={10}
                iconColor="rgba(255,255,255,0.68)"
                amountStyle={{ color: "inherit", fontSize: compact ? 12 : 13, fontWeight: 700 }}
              />
            </>
          ) : (
            <span>Check</span>
          )}
        </SurfaceButton>

        {canRaise ? (
          <SurfaceButton
            testId="action-raise"
            ariaLabel={showRaisePanel ? "Close raise panel" : "Open raise panel"}
            onClick={() => setShowRaisePanel((previous) => !previous)}
            emphasized={showRaisePanel}
            compact={compact}
          >
            <span>Raise</span>
            <ChipAmount
              amount={clampedRaise}
              iconSize={10}
              iconColor={showRaisePanel ? "#0e0e10" : "rgba(255,255,255,0.68)"}
              amountStyle={{
                color: "inherit",
                fontSize: compact ? 12 : 13,
                fontWeight: 700,
              }}
            />
          </SurfaceButton>
        ) : null}

        <SurfaceButton
          testId="action-all-in"
          ariaLabel="All in"
          onClick={() => {
            setActionPending(true);
            setShowRaisePanel(false);
            onAction("ALL_IN");
          }}
          emphasized={!canRaise}
          compact={compact}
        >
          <span>All in</span>
        </SurfaceButton>
      </div>

      <AnimatePresence>
        {showRaisePanel && canRaise ? (
          <motion.div
            data-testid="raise-modal"
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            transition={{ duration: 0.16 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="stage-panel"
              style={{
                display: "grid",
                gridTemplateColumns: compact ? "1fr" : "auto minmax(160px, 1fr) auto",
                gap: compact ? 10 : 12,
                alignItems: "center",
                padding: compact ? 12 : 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Raise to
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 12px",
                    minHeight: compact ? 44 : 52,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
                  }}
                >
                  <ChipIcon size={12} color="#81ecff" />
                  <input
                    type="number"
                    value={raiseAmount}
                    min={minRaiseTo}
                    max={maxRaiseTo}
                    onChange={(event) => setRaiseAmount(Number(event.target.value))}
                    onBlur={() => setRaiseAmount(clampedRaise)}
                    style={{
                      width: compact ? 96 : 112,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "#f6f3f5",
                      fontSize: compact ? 16 : 18,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Min {minRaiseTo}</span>
                  <span style={{ textAlign: "center" }}>Pot {pot}</span>
                  <span style={{ textAlign: "right" }}>Max {maxRaiseTo}</span>
                </div>
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxRaiseTo}
                  step={Math.max(1, Math.round((maxRaiseTo - minRaiseTo) / 100))}
                  value={raiseAmount}
                  disabled={sliderDisabled}
                  onChange={(event) => setRaiseAmount(Number(event.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#00e3fd",
                    background: sliderDisabled
                      ? "rgba(255,255,255,0.05)"
                      : `linear-gradient(to right, #00e3fd ${sliderPct}%, rgba(255,255,255,0.12) 0%)`,
                  }}
                />

                {presets.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {presets.map((preset) => {
                      const active = clampedRaise === preset.value;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRaiseAmount(preset.value)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 34,
                            padding: "0 12px",
                            borderRadius: 999,
                            border: active
                              ? "1px solid rgba(129,236,255,0.32)"
                              : "1px solid rgba(255,255,255,0.08)",
                            background: active
                              ? "linear-gradient(180deg, rgba(129,236,255,0.16) 0%, rgba(255,255,255,0.05) 100%)"
                              : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                            color: active ? "#81ecff" : "rgba(255,255,255,0.72)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: compact ? "space-between" : "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowRaisePanel(false)}
                  style={{
                    height: compact ? 44 : 52,
                    padding: compact ? "0 14px" : "0 16px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <SurfaceButton emphasized compact={compact} onClick={confirmRaise}>
                  <span>Raise to</span>
                  <ChipAmount
                    amount={clampedRaise}
                    iconSize={10}
                    iconColor="#0e0e10"
                    amountStyle={{ color: "inherit", fontSize: compact ? 12 : 13, fontWeight: 700 }}
                  />
                </SurfaceButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
