// Formatting constants and helpers for GameLog.tsx.
// Pure data — no React, no sockets, no DB access.

// ── Card suit display ──────────────────────────────────────────────────────────

export const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  h: { symbol: "♥", color: "#ef4444" },
  d: { symbol: "♦", color: "#ef4444" },
  s: { symbol: "♠", color: "rgba(255,255,255,0.9)" },
  c: { symbol: "♣", color: "rgba(255,255,255,0.9)" },
};

// ── Phase display names ────────────────────────────────────────────────────────

export const PHASE_NAMES: Record<string, string> = {
  PRE_FLOP_BETTING: "Pre-Flop",
  FLOP_BETTING: "Flop",
  TURN_BETTING: "Turn",
  RIVER_BETTING: "River",
  SHOWDOWN: "Showdown",
  CLEANUP: "Hand Over",
};

// ── Action colors (for ChipAmount iconColor / amountStyle) ────────────────────

export const ACTION_COLORS: Record<string, string> = {
  FOLD: "#f87171",
  CALL: "#93c5fd",
  CHECK: "rgba(255,255,255,0.6)",
  RAISE: "#6ee7b7",
  ALL_IN: "#a78bfa",
};

// ── Action Tailwind classes for label spans ────────────────────────────────────

export const ACTION_CLASS: Record<string, string> = {
  FOLD: "text-[--danger]",
  CALL: "text-[--accent]",
  CHECK: "text-[--text-secondary]",
  RAISE: "text-[--success]",
  ALL_IN: "text-purple-400",
};

// ── Action label text ──────────────────────────────────────────────────────────

export function getActionLabel(action: string): string {
  switch (action) {
    case "FOLD":   return "folds";
    case "CHECK":  return "checks";
    case "CALL":   return "calls";
    case "RAISE":  return "raises to";
    case "ALL_IN": return "goes ALL-IN";
    default:       return action.toLowerCase();
  }
}
