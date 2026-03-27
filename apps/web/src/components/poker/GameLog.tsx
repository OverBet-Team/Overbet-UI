"use client";

// OverBet — GameLog (Moon Poker LogPanel port)
// Scrollable hand history with visual hierarchy: phase headers, action rows, win highlights.

import React, { useEffect, useRef } from "react";
import { ChipAmount } from "./ChipAmount";
import {
  SUIT_SYMBOLS,
  PHASE_NAMES,
  ACTION_COLORS,
  ACTION_CLASS,
  getActionLabel,
} from "@/lib/gameLogFormatters";

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

function CardChip({ card }: { card: string }) {
  if (!card || card.length < 2) return <span className="text-[--text-secondary]">{card}</span>;
  const suitChar = card[card.length - 1].toLowerCase();
  const rankStr = card.slice(0, -1).toUpperCase().replace("T", "10");
  const suit = SUIT_SYMBOLS[suitChar];
  if (!suit) return <span className="text-[--text-secondary]">{card}</span>;
  return (
    <span
      className="inline-flex items-center gap-0.5 bg-[--bg-elevated] rounded px-1 py-0.5 text-[11px] font-mono whitespace-nowrap"
      style={{ color: suit.color }}
    >
      {rankStr}{suit.symbol}
    </span>
  );
}

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
          <div
            key={index}
            className="border-t border-white/[0.07] mt-[10px] mb-[6px] pt-2 text-center text-[--text-muted] text-[9px] font-bold uppercase tracking-[0.12em]"
          >
            ─── New Hand ───
          </div>
        );

      case "PHASE_CHANGE": {
        const name = PHASE_NAMES[payload.phase];
        if (!name) return null;
        return (
          <div
            key={index}
            className="text-[--gold]/70 text-[10px] font-bold uppercase tracking-widest text-center py-1 border-t border-[--bg-elevated] mt-1"
          >
            {name}
          </div>
        );
      }

      case "POST_BLINDS_ANTES":
        return (
          <div key={index} className="flex flex-col gap-0.5">
            {payload.smallBlind && (
              <Row>
                <Name>{getUsername(payload.smallBlind.playerId)}</Name>
                <span className="text-[--text-muted]"> posts SB </span>
                <Chip>{payload.smallBlind.amount}</Chip>
              </Row>
            )}
            {payload.bigBlind && (
              <Row>
                <Name>{getUsername(payload.bigBlind.playerId)}</Name>
                <span className="text-[--text-muted]"> posts BB </span>
                <Chip>{payload.bigBlind.amount}</Chip>
              </Row>
            )}
          </div>
        );

      case "PLAYER_ACTION": {
        const name = getUsername(payload.playerId);
        const color = ACTION_COLORS[payload.action] ?? "rgba(255,255,255,0.6)";
        const actionClass = ACTION_CLASS[payload.action] ?? "text-[--text-secondary]";
        const label = getActionLabel(payload.action);
        return (
          <Row key={index}>
            <Name>{name}</Name>
            <span className={actionClass}> {label} </span>
            {payload.amount > 0 && <Chip color={color}>{payload.amount}</Chip>}
          </Row>
        );
      }

      case "DEAL_FLOP":
      case "DEAL_TURN":
      case "DEAL_RIVER": {
        const label = type === "DEAL_FLOP" ? "Flop" : type === "DEAL_TURN" ? "Turn" : "River";
        return (
          <div key={index} className="flex items-center gap-1.5 mt-1">
            <span className="text-[--text-muted] text-[9px] font-bold uppercase tracking-[0.08em] flex-shrink-0">
              {label}
            </span>
            <div className="flex gap-[3px]">
              {(payload.cards ?? []).map((c: string, i: number) => (
                <CardChip key={i} card={c} />
              ))}
            </div>
          </div>
        );
      }

      case "WIN":
        return (
          <div
            key={index}
            className="flex items-center flex-wrap gap-1 bg-[--gold]/[0.07] border border-[--gold]/[0.18] rounded-lg px-2 py-[5px] mt-1"
          >
            <span className="text-[--gold] text-[9px] leading-none">♦</span>
            <Name>{getUsername(payload.playerId)}</Name>
            <span className="text-[--text-muted]">wins</span>
            <Chip color="#fbbf24">{payload.amount}</Chip>
            {payload.handName ? (
              <span className="text-[--text-secondary] text-[10px] italic">
                ({payload.handName})
              </span>
            ) : null}
          </div>
        );

      case "EARLY_WIN":
        return (
          <div
            key={index}
            className="flex items-center flex-wrap gap-1 bg-[--gold]/[0.07] border border-[--gold]/[0.18] rounded-lg px-2 py-[5px] mt-1"
          >
            <span className="text-[--gold] text-[9px] leading-none">♦</span>
            <Name>{getUsername(payload.winnerId)}</Name>
            <span className="text-[--text-muted]">wins</span>
            <Chip color="#fbbf24">{payload.amount}</Chip>
            <span className="text-[--text-muted] text-[10px] italic">
              (uncontested)
            </span>
          </div>
        );

      case "UNCALLED_BET_RETURNED":
        return (
          <Row key={index}>
            <span className="text-[--text-muted]">Uncalled </span>
            <Chip>{payload.amount}</Chip>
            <span className="text-[--text-muted]"> returned to </span>
            <Name>{getUsername(payload.playerId)}</Name>
          </Row>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[420px] bg-[--bg-surface]/96 border border-[--bg-elevated] rounded-2xl overflow-hidden backdrop-blur-xl font-body">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[--bg-elevated] bg-white/[0.03] flex-shrink-0 flex items-center justify-between">
        <span className="text-[--text-secondary] text-[10px] font-bold uppercase tracking-widest">
          Hand Log
        </span>
        <span className="text-[--text-muted] text-[10px]">
          {logs.length} events
        </span>
      </div>

      {/* Scrollable log */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-[3px]"
      >
        {logs.length === 0 ? (
          <div className="text-[--text-muted] text-center py-5 text-xs italic">
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
    <div className="flex items-center flex-wrap gap-[3px] text-[11px] hover:bg-white/[0.03] transition-colors rounded px-1">
      {children}
    </div>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-medium text-[--text-primary] font-body text-[11px]">{children}</span>
  );
}

function Chip({ children, color = "var(--accent)" }: { children: React.ReactNode; color?: string }) {
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
