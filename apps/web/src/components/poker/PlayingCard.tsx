/**
 * PlayingCard — Moon Poker visual language ported to Overbet
 *
 * Accepts either:
 *   - A raw engine card string like "Ah", "Tc", "2d", "Ks"
 *   - faceDown=true for opponent hidden cards
 *   - dashed=true for unrevealed community card slots
 */

// Simple className helper (no external dependency)
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Types ──────────────────────────────────────────────────────────────────
type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface ParsedCard {
  rank: string;
  suit: Suit;
}

interface PlayingCardProps {
  /** Raw engine card string, e.g. "Ah", "Tc", "2d" */
  card?: string;
  size?: Size;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
  dealDelay?: number;
  faceDown?: boolean;
  /** Unrevealed community card slot — dashed border placeholder */
  dashed?: boolean;
  /** Highlight with gold glow (winning hand card) */
  winning?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────
const SIZES: Record<Size, { w: number; h: number; r: number; rankSize: number; suitCorner: number; suitCenter: number }> = {
  xs: { w: 34,  h: 46,  r: 5,  rankSize: 10, suitCorner: 8,  suitCenter: 16 },
  sm: { w: 48,  h: 66,  r: 7,  rankSize: 13, suitCorner: 10, suitCenter: 22 },
  md: { w: 72,  h: 100, r: 10, rankSize: 18, suitCorner: 13, suitCenter: 34 },
  lg: { w: 96,  h: 132, r: 12, rankSize: 22, suitCorner: 16, suitCenter: 46 },
  xl: { w: 130, h: 178, r: 16, rankSize: 30, suitCorner: 22, suitCenter: 64 },
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: "#111827",
  hearts: "#dc2626",
  diamonds: "#dc2626",
  clubs: "#111827",
};

// Engine uses single-char suit codes: s h d c
const SUIT_MAP: Record<string, Suit> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

// Engine rank codes: 2-9, T, J, Q, K, A
const RANK_DISPLAY: Record<string, string> = {
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
};

// ── Parser ─────────────────────────────────────────────────────────────────
function parseCard(raw: string): ParsedCard | null {
  if (!raw || raw.length < 2) return null;
  const suitChar = raw[raw.length - 1].toLowerCase();
  const rankChar = raw.slice(0, raw.length - 1).toUpperCase();
  const suit = SUIT_MAP[suitChar];
  if (!suit) return null;
  const rank = RANK_DISPLAY[rankChar] ?? rankChar;
  return { rank, suit };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PlayingCard({
  card,
  size = "md",
  rotate = 0,
  className,
  style,
  dealDelay = 0,
  faceDown = false,
  dashed = false,
  winning = false,
}: PlayingCardProps) {
  const s = SIZES[size];

  const baseStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    width: s.w,
    height: s.h,
    borderRadius: s.r,
    transform: `rotate(${rotate}deg)`,
    animationDelay: `${dealDelay}ms`,
    flexShrink: 0,
    overflow: "hidden",
    ...style,
  };

  // ── Dashed placeholder (unrevealed community card) ─────────────────────
  if (dashed) {
    return (
      <div
        className={cn(className)}
        style={{
          ...baseStyle,
          background: "transparent",
          border: "2px dashed rgba(255,255,255,0.18)",
          boxShadow: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={s.w * 0.35} height={s.w * 0.35} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  // ── Face-down card (opponent hidden) ───────────────────────────────────
  const parsed = card ? parseCard(card) : null;
  const isFaceDown = faceDown || !parsed;

  if (isFaceDown) {
    return (
      <div
        className={cn("card-back-solid card-deal", className)}
        style={{ ...baseStyle, borderRadius: s.r }}
      >
        {/* Subtle diagonal pattern */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: s.r - 2,
            border: "1px solid rgba(255,255,255,0.07)",
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 6px)",
          }}
        />
        {/* Center moon icon */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={s.w * 0.38} height={s.w * 0.38} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.08)" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Face-up card ───────────────────────────────────────────────────────
  const { rank, suit } = parsed!;
  const color = SUIT_COLORS[suit];
  const symbol = SUIT_SYMBOLS[suit];

  return (
    <div
      className={cn("card-face card-deal", className)}
      style={{
        ...baseStyle,
        borderRadius: s.r,
        ...(winning ? {
          animation: "card-deal 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards, winning-card-glow 1.5s ease-in-out infinite 0.4s",
          border: "1.5px solid rgba(234,179,8,0.7)",
        } : {}),
      }}
    >
      {/* Top-left corner */}
      <div
        style={{
          position: "absolute",
          top: s.r * 0.5,
          left: s.r * 0.55,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1,
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: s.rankSize,
            fontWeight: 800,
            color,
            fontFamily: "Outfit, Inter, sans-serif",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {rank}
        </span>
        <span style={{ fontSize: s.suitCorner, color, lineHeight: 1 }}>{symbol}</span>
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div
        style={{
          position: "absolute",
          bottom: s.r * 0.5,
          right: s.r * 0.55,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1,
          gap: 1,
          transform: "rotate(180deg)",
        }}
      >
        <span
          style={{
            fontSize: s.rankSize,
            fontWeight: 800,
            color,
            fontFamily: "Outfit, Inter, sans-serif",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {rank}
        </span>
        <span style={{ fontSize: s.suitCorner, color, lineHeight: 1 }}>{symbol}</span>
      </div>

      {/* Center suit symbol */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: s.suitCenter,
            color,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {symbol}
        </span>
      </div>

      {/* Gloss overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: s.r,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
