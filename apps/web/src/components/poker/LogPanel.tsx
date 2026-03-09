"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface LogEntry {
  type: string;
  payload?: any;
  [k: string]: any;
}

interface PlayerInfo {
  id: string;
  username: string;
}

interface LogPanelProps {
  logs: LogEntry[];
  players: PlayerInfo[];
  onClose: () => void;
}

function formatLogToDisplay(log: LogEntry, getUsername: (id: string) => string): string {
  const { type, payload = {} } = log;
  switch (type) {
    case "POST_BLINDS_ANTES":
      const parts: string[] = [];
      if (payload.smallBlind)
        parts.push(`${getUsername(payload.smallBlind.playerId)} posts SB $${payload.smallBlind.amount}`);
      if (payload.bigBlind)
        parts.push(`${getUsername(payload.bigBlind.playerId)} posts BB $${payload.bigBlind.amount}`);
      return parts.join("; ");
    case "PLAYER_ACTION":
      const name = getUsername(payload.playerId);
      switch (payload.action) {
        case "FOLD": return `${name} folds`;
        case "CHECK": return `${name} checks`;
        case "CALL": return `${name} calls $${payload.amount}`;
        case "RAISE": return `${name} raises $${payload.amount}`;
        case "ALL_IN": return `${name} is ALL-IN for $${payload.amount}`;
        default: return `${name} ${payload.action}`;
      }
    case "DEAL_FLOP":
      return `Flop: [${(payload.cards || []).join(" ")}]`;
    case "DEAL_TURN":
      return `Turn: [${(payload.cards || []).join(" ")}]`;
    case "DEAL_RIVER":
      return `River: [${(payload.cards || []).join(" ")}]`;
    case "WIN":
      return `${getUsername(payload.playerId)} wins $${payload.amount} with ${payload.handName || "hand"}`;
    case "EARLY_WIN":
      return `${getUsername(payload.winnerId)} wins $${payload.amount} (everyone folded)`;
    case "HAND_INIT":
      return "New hand started";
    default:
      return "";
  }
}

export default function LogPanel({ logs, players, onClose }: LogPanelProps) {
  const getUsername = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? p.username : `Player_${id.substring(0, 4)}`;
  };
  const log = logs.map((l) => formatLogToDisplay(l, getUsername)).filter(Boolean);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  return (
    <div
      className="absolute bottom-16 left-4 w-72 rounded-2xl z-40 overflow-hidden"
      style={{
        background: "rgba(18, 15, 32, 0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <span className="text-white/80 font-semibold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
          Game Log
        </span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-1.5 scrollbar-thin">
        {log.map((entry, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-white/20 text-[10px] font-mono mt-0.5 flex-shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-white/60 text-xs leading-relaxed">{entry}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
