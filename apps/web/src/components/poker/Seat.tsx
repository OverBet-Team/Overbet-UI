"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { ChipAmount } from "./ChipAmount";

export interface PlayerData {
  id: string;
  username: string;
  chips: number;
  /** Uppercase status: ACTIVE, FOLDED, etc. */
  status: string;
  seatIndex: number;
  cards?: string[];
  bet?: number;
}

export interface TurnTimer {
  playerId: string;
  expiresAt: number;
  total: number;
  phase: "base" | "timebank";
  timeBankMs: number;
}

interface SeatProps {
  player: PlayerData | undefined;
  seatIndex: number;
  isDealer: boolean;
  isActive: boolean;
  isSelf: boolean;
  onSeatClick: (index: number) => void;
  timer?: TurnTimer | null;
  centerOffset?: { x: number; y: number };
}

const CIRCUMFERENCE = 2 * Math.PI * 34; // r=34

export function Seat({
  player,
  seatIndex,
  isDealer,
  isActive,
  isSelf,
  onSeatClick,
  timer,
  centerOffset = { x: 0, y: 0 },
}: SeatProps) {
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [displayTotal, setDisplayTotal] = React.useState<number>(1);
  const [timerPhase, setTimerPhase] = React.useState<"base" | "timebank">("base");

  React.useEffect(() => {
    const isMyTimer = isActive && timer && timer.playerId === player?.id;

    if (!isMyTimer) {
      setTimeLeft(0);
      return;
    }

    setDisplayTotal(timer.total);
    setTimerPhase(timer.phase);

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, timer.expiresAt - now);
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [isActive, timer, player?.id]);

  const progress = displayTotal > 0 ? timeLeft / displayTotal : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - progress);

  const timerColor =
    timerPhase === "timebank"
      ? progress < 0.2
        ? "#ef4444"
        : "#f97316"
      : progress < 0.2
      ? "#ef4444"
      : "#22c55e";

  const isTimerActive = isActive && timer?.playerId === player?.id && timeLeft > 0;
  const timeLeftSecs = Math.ceil(timeLeft / 1000);
  // Exception: Avatar uses fixed clamp geometry per design system
  const emptySeatSize = "clamp(44px, 5.5vw, 56px)";

  // ── Empty seat ──────────────────────────────────────────────────────────
  if (!player) {
    return (
      <button
        data-testid={`seat-empty-${seatIndex}`}
        onClick={() => onSeatClick(seatIndex)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: emptySeatSize,
          height: emptySeatSize,
          minWidth: 44,
          minHeight: 44,
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.25)",
          cursor: "pointer",
          transition: "all 0.2s ease",
          color: "rgba(255,255,255,0.2)",
          fontSize: "clamp(18px, 2.2vw, 22px)",
          fontWeight: 700,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(124,58,237,0.55)";
          e.currentTarget.style.background = "rgba(124,58,237,0.12)";
          e.currentTarget.style.color = "rgba(167,139,250,0.7)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
          e.currentTarget.style.background = "rgba(0,0,0,0.25)";
          e.currentTarget.style.color = "rgba(255,255,255,0.2)";
        }}
      >
        +
      </button>
    );
  }

  const isPending = player.status === "PENDING";
  const isFolded = player.status === "FOLDED";

  // Determine if we show face-up cards (self) or face-down (opponent)
  const hasFaceUpCards = isSelf && player.cards && player.cards.length === 2;
  const hasFaceDownCards = !isSelf && player.cards && player.cards.length === 2;

  return (
    <div
      data-testid={`seat-player-${seatIndex}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: isPending ? 0.7 : isFolded ? 0.5 : 1,
        animation: isPending ? "pulse 2s infinite" : undefined,
      }}
    >
      {/* Bet chip — floats above avatar */}
      <AnimatePresence>
        {player.bet && player.bet > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -4 }}
            exit={{ opacity: 0, scale: 0, x: centerOffset.x, y: centerOffset.y }}
            style={{
              position: "absolute",
              top: -28,
              background: "rgba(0,0,0,0.7)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 999,
              padding: "2px 10px",
              color: "#f87171",
              fontWeight: 700,
              fontSize: 11,
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              zIndex: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              fontFamily: "Outfit, Inter, sans-serif",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span>Bet</span>
              <ChipAmount
                amount={player.bet}
                iconSize={11}
                iconColor="#f87171"
                amountStyle={{ color: "inherit" }}
              />
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Avatar circle with SVG timer ring */}
      <div style={{ position: "relative", width: 64, height: 64 }}>
        {/* Active glow ring */}
        {isActive && (
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid rgba(124,58,237,0.6)",
              boxShadow: "0 0 16px rgba(124,58,237,0.35)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        )}

        {/* SVG timer ring */}
        {isTimerActive && (
          <svg
            style={{
              position: "absolute",
              top: -6,
              left: -6,
              width: 76,
              height: 76,
              transform: "rotate(-90deg)",
              pointerEvents: "none",
            }}
            viewBox="0 0 76 76"
          >
            <circle
              cx="38"
              cy="38"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            <circle
              cx="38"
              cy="38"
              r="34"
              fill="none"
              stroke={timerColor}
              strokeWidth="3"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 0.05s linear, stroke 0.3s ease",
              }}
            />
          </svg>
        )}

        {/* Avatar body */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: isActive
              ? "linear-gradient(135deg, #1e1b4b, #312e81)"
              : "linear-gradient(135deg, #1f2937, #111827)",
            border: isActive
              ? "3px solid rgba(124,58,237,0.7)"
              : isPending
              ? "3px solid rgba(99,102,241,0.4)"
              : isFolded
              ? "3px solid rgba(239,68,68,0.3)"
              : "3px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: isActive ? "#c4b5fd" : "rgba(255,255,255,0.7)",
            fontFamily: "Outfit, Inter, sans-serif",
            boxShadow: isActive
              ? "0 4px 20px rgba(124,58,237,0.4)"
              : "0 4px 12px rgba(0,0,0,0.5)",
            transition: "all 0.25s ease",
            position: "relative",
          }}
        >
          {player.username?.[0]?.toUpperCase()}

          {/* Countdown badge */}
          {isTimerActive && (
            <div
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 20,
                height: 20,
                padding: "0 4px",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 900,
                border: `1px solid ${timerColor}`,
                background:
                  timerPhase === "timebank"
                    ? "rgba(249,115,22,0.9)"
                    : "rgba(34,197,94,0.9)",
                color: "#fff",
                zIndex: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            >
              {timeLeftSecs}
            </div>
          )}

          {/* TIME BANK label */}
          {isTimerActive && timerPhase === "timebank" && (
            <div
              style={{
                position: "absolute",
                bottom: -14,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 7,
                fontWeight: 700,
                color: "#fb923c",
                whiteSpace: "nowrap",
                background: "rgba(0,0,0,0.75)",
                padding: "1px 4px",
                borderRadius: 4,
                border: "1px solid rgba(249,115,22,0.3)",
              }}
            >
              TIME BANK
            </div>
          )}

          {/* Dealer button */}
          {isDealer && !isPending && (
            <div
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                color: "#111",
                fontSize: 9,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #111",
                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                zIndex: 10,
              }}
            >
              D
            </div>
          )}

          {/* Pending indicator */}
          {isPending && (
            <div
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "rgba(99,102,241,0.9)",
                color: "#fff",
                fontSize: 8,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid rgba(255,255,255,0.2)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                zIndex: 10,
              }}
            >
              ···
            </div>
          )}
        </div>

        {/* Hole cards — Moon Poker style, anchored to avatar */}
        <AnimatePresence>
          {(hasFaceUpCards || hasFaceDownCards) && !isPending && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0,
                x: centerOffset.x * 0.3,
                y: centerOffset.y * 0.3,
              }}
              animate={{ opacity: 1, scale: 1, x: -36, y: -10 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "flex",
                gap: -8,
              }}
            >
              {hasFaceUpCards ? (
                // Self — show face-up cards with suit symbols
                <>
                  <PlayingCard
                    card={player.cards![0]}
                    size="xs"
                    rotate={-8}
                    style={{ zIndex: 2 }}
                  />
                  <PlayingCard
                    card={player.cards![1]}
                    size="xs"
                    rotate={-3}
                    style={{ marginLeft: -10, zIndex: 1 }}
                  />
                </>
              ) : (
                // Opponent — face-down
                <>
                  <PlayingCard faceDown size="xs" rotate={-8} style={{ zIndex: 2 }} />
                  <PlayingCard
                    faceDown
                    size="xs"
                    rotate={-3}
                    style={{ marginLeft: -10, zIndex: 1 }}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name + chip label */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          zIndex: 10,
        }}
      >
        <div
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            border: isActive
              ? "1px solid rgba(124,58,237,0.6)"
              : isPending
              ? "1px solid rgba(99,102,241,0.35)"
              : isFolded
              ? "1px solid rgba(239,68,68,0.25)"
              : "1px solid rgba(255,255,255,0.1)",
            background: isActive
              ? "rgba(124,58,237,0.25)"
              : isPending
              ? "rgba(99,102,241,0.12)"
              : "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: isActive ? "#c4b5fd" : isPending ? "#a5b4fc" : "rgba(255,255,255,0.8)",
            fontFamily: "Outfit, Inter, sans-serif",
            whiteSpace: "nowrap",
            maxWidth: 100,
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: isActive ? "0 2px 12px rgba(124,58,237,0.3)" : undefined,
          }}
        >
          {player.username}
          {isSelf && " (You)"}
          {isPending && " (WAITING)"}
          {isFolded && " (FOLDED)"}
        </div>

        {/* Chip count */}
        <div
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid rgba(99,102,241,0.2)",
            background: "rgba(99,102,241,0.08)",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "monospace",
            color: "#a5b4fc",
          }}
        >
          <ChipAmount
            amount={player.chips}
            iconSize={10}
            iconColor="#a5b4fc"
            amountStyle={{ color: "inherit", fontFamily: "monospace" }}
          />
        </div>

        {/* Time bank bar */}
        {isTimerActive && timer && timer.timeBankMs > 0 && (
          <div style={{ width: 64, marginTop: 2 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 7,
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Bank
              </span>
              <span
                style={{ fontSize: 7, fontFamily: "monospace", color: "#fb923c" }}
              >
                {timerPhase === "timebank"
                  ? `${timeLeftSecs}s`
                  : `${Math.round(timer.timeBankMs / 1000)}s`}
              </span>
            </div>
            <div
              style={{
                height: 3,
                width: "100%",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 999,
                  transition: "width 0.1s linear",
                  width:
                    timerPhase === "timebank"
                      ? `${(timeLeft / timer.timeBankMs) * 100}%`
                      : "100%",
                  background: "#f97316",
                  opacity: timerPhase === "timebank" ? 1 : 0.35,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
