"use client";

// OverBet — GameLog (Moon Poker LogPanel port)
// Scrollable hand history with visual hierarchy: phase headers, action rows, win highlights.

import React, { useEffect, useRef } from "react";
import { ChipAmount } from "./ChipAmount";
interface GameLogEntry {
  type: string;
  payload: any;
  timestamp: number;
}

interface PlayerInfo {
  id: string;
  username: string;
}

interface GameLogProps {
  logs: GameLogEntry[];
  players: PlayerInfo[];
}

// ── Card formatter ────────────────────────────────────────────────────────────
const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  h: { symbol: "♥", color: "#ef4444" },
  d: { symbol: "♦", color: "#ef4444" },
  s: { symbol: "♠", color: "rgba(255,255,255,0.9)" },
  c: { symbol: "♣", color: "rgba(255,255,255,0.9)" },
};

function CardChip({ card }: { card: string }) {
  if (!card || card.length < 2) return <span style={{ color: "rgba(255,255,255,0.5)" }}>{card}</span>;
  const suitChar = card[card.length - 1].toLowerCase();
  const rankStr = card.slice(0, -1).toUpperCase().replace("T", "10");
  const suit = SUIT_SYMBOLS[suitChar];
  if (!suit) return <span style={{ color: "rgba(255,255,255,0.5)" }}>{card}</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 1,
      background: "rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 5px",
      fontSize: 10, fontWeight: 700, fontFamily: "Outfit, sans-serif",
      color: suit.color, whiteSpace: "nowrap",
    }}>
      {rankStr}{suit.symbol}
    </span>
  );
}

// ── Phase display names ───────────────────────────────────────────────────────
const PHASE_NAMES: Record<string, string> = {
  PRE_FLOP_BETTING: "Pre-Flop",
  FLOP_BETTING: "Flop",
  TURN_BETTING: "Turn",
  RIVER_BETTING: "River",
  SHOWDOWN: "Showdown",
  CLEANUP: "Hand Over",
};

// ── Action colors ─────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  FOLD: "#f87171",
  CALL: "#93c5fd",
  CHECK: "rgba(255,255,255,0.6)",
  RAISE: "#6ee7b7",
  ALL_IN: "#a78bfa",
};

export const GameLog: React.FC<GameLogProps> = ({ logs, players }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getUsername = (id: string) => {
    const player = players.find((p) => p.id === id);
    return player?.username ?? `Player_${id.slice(0, 4)}`;
  };

  const renderEntry = (log: GameLogEntry, index: number) => {
    const { type, payload } = log;

    switch (type) {
      case "HAND_INIT":
        return (
          <div key={index} style={{
            borderTop: "1px solid rgba(255,255,255,0.07)", margin: "10px 0 6px",
            paddingTop: 8, textAlign: "center",
            color: "rgba(255,255,255,0.22)", fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.12em",
          }}>
            ─── New Hand ───
          </div>
        );

      case "PHASE_CHANGE": {
        const name = PHASE_NAMES[payload.phase];
        if (!name) return null;
        return (
          <div key={index} style={{
            marginTop: 8, marginBottom: 4,
            color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.1em",
            borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 4,
          }}>
            {name}
          </div>
        );
      }

      case "POST_BLINDS_ANTES":
        return (
          <div key={index} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {payload.smallBlind && (
              <Row>
                <Name>{getUsername(payload.smallBlind.playerId)}</Name>
                <span style={{ color: "rgba(255,255,255,0.45)" }}> posts SB </span>
                <Chip>{payload.smallBlind.amount}</Chip>
              </Row>
            )}
            {payload.bigBlind && (
              <Row>
                <Name>{getUsername(payload.bigBlind.playerId)}</Name>
                <span style={{ color: "rgba(255,255,255,0.45)" }}> posts BB </span>
                <Chip>{payload.bigBlind.amount}</Chip>
              </Row>
            )}
          </div>
        );

      case "PLAYER_ACTION": {
        const name = getUsername(payload.playerId);
        const color = ACTION_COLORS[payload.action] ?? "rgba(255,255,255,0.6)";
        const label =
          payload.action === "FOLD" ? "folds" :
          payload.action === "CHECK" ? "checks" :
          payload.action === "CALL" ? "calls" :
          payload.action === "RAISE" ? "raises to" :
          payload.action === "ALL_IN" ? "goes ALL-IN" :
          payload.action.toLowerCase();
        return (
          <Row key={index}>
            <Name>{name}</Name>
            <span style={{ color }}> {label} </span>
            {payload.amount > 0 && <Chip color={color}>{payload.amount}</Chip>}
          </Row>
        );
      }

      case "DEAL_FLOP":
      case "DEAL_TURN":
      case "DEAL_RIVER": {
        const label = type === "DEAL_FLOP" ? "Flop" : type === "DEAL_TURN" ? "Turn" : "River";
        return (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
              {label}
            </span>
            <div style={{ display: "flex", gap: 3 }}>
              {(payload.cards ?? []).map((c: string, i: number) => (
                <CardChip key={i} card={c} />
              ))}
            </div>
          </div>
        );
      }

      case "WIN":
        return (
          <div key={index} style={{
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
            background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.18)",
            borderRadius: 8, padding: "5px 8px", marginTop: 4,
          }}>
            <span style={{ color: "#eab308", fontSize: 9, lineHeight: 1 }}>♦</span>
            <Name>{getUsername(payload.playerId)}</Name>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>wins</span>
            <Chip color="#fbbf24">{payload.amount}</Chip>
            {payload.handName && (
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontStyle: "italic" }}>
                ({payload.handName})
              </span>
            )}
          </div>
        );

      case "EARLY_WIN":
        return (
          <div key={index} style={{
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
            background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.18)",
            borderRadius: 8, padding: "5px 8px", marginTop: 4,
          }}>
            <span style={{ color: "#eab308", fontSize: 9, lineHeight: 1 }}>♦</span>
            <Name>{getUsername(payload.winnerId)}</Name>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>wins</span>
            <Chip color="#fbbf24">{payload.amount}</Chip>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontStyle: "italic" }}>
              (uncontested)
            </span>
          </div>
        );

      case "UNCALLED_BET_RETURNED":
        return (
          <Row key={index}>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Uncalled </span>
            <Chip>{payload.amount}</Chip>
            <span style={{ color: "rgba(255,255,255,0.3)" }}> returned to </span>
            <Name>{getUsername(payload.playerId)}</Name>
          </Row>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", maxHeight: 420,
      background: "rgba(14,11,24,0.92)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, overflow: "hidden", backdropFilter: "blur(20px)",
      fontFamily: "Outfit, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Hand Log
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
          {logs.length} events
        </span>
      </div>

      {/* Scrollable log */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "20px 0", fontSize: 12, fontStyle: "italic" }}>
            Waiting for action…
          </div>
        ) : (
          logs.map((log, i) => renderEntry(log, i))
        )}
      </div>
    </div>
  );
};

// ── Inline helpers ────────────────────────────────────────────────────────────
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3, fontSize: 11 }}>
      {children}
    </div>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "#fff", fontWeight: 600, fontSize: 11 }}>{children}</span>
  );
}

function Chip({ children, color = "rgba(167,139,250,0.9)" }: { children: React.ReactNode; color?: string }) {
  return (
    <ChipAmount
      amount={children as number | string}
      iconSize={10}
      iconColor={color}
      amountStyle={{ color, fontSize: 11, fontWeight: 700 }}
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 4,
        padding: "1px 6px",
      }}
    />
  );
}
