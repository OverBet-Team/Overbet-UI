"use client";

import { parseOverBetCard, SUIT_SYMBOLS, SUIT_COLORS, type ParsedCard } from "@/lib/cardUtils";

interface PlayingCardProps {
  /** OverBet format: e.g. "As", "Tc", "2h" */
  card?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
  dealDelay?: number;
  faceDown?: boolean;
  dashed?: boolean;
  /** Optional: highlight as winning card */
  highlight?: boolean;
}

const SIZES = {
  xs: { w: 34, h: 46, r: 5, rankSize: 10, suitCorner: 8, suitCenter: 16 },
  sm: { w: 48, h: 66, r: 7, rankSize: 13, suitCorner: 10, suitCenter: 22 },
  md: { w: 72, h: 100, r: 10, rankSize: 18, suitCorner: 13, suitCenter: 34 },
  lg: { w: 96, h: 132, r: 12, rankSize: 22, suitCorner: 16, suitCenter: 46 },
  xl: { w: 130, h: 178, r: 16, rankSize: 30, suitCorner: 22, suitCenter: 64 },
  "2xl": { w: 160, h: 220, r: 18, rankSize: 38, suitCorner: 28, suitCenter: 80 },
  "3xl": { w: 200, h: 275, r: 22, rankSize: 48, suitCorner: 34, suitCenter: 100 },
};

export default function PlayingCard({
  card,
  size = "md",
  rotate = 0,
  className = "",
  style,
  dealDelay = 0,
  faceDown = false,
  dashed = false,
  highlight = false,
}: PlayingCardProps) {
  const s = SIZES[size];
  const parsed = card ? parseOverBetCard(card) : null;
  const isFaceDown = faceDown || !parsed;

  const baseStyle: React.CSSProperties = {
    width: s.w,
    height: s.h,
    transform: `rotate(${rotate}deg)`,
    animationDelay: `${dealDelay}ms`,
    flexShrink: 0,
    ...style,
  };

  if (dashed) {
    return (
      <div
        className={`card-back card-deal ${className}`}
        style={{
          ...baseStyle,
          background: "transparent",
          border: "2px dashed rgba(255,255,255,0.18)",
          borderRadius: s.r,
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

  if (isFaceDown) {
    return (
      <div
        className={`card-back-solid card-deal ${className}`}
        style={{ ...baseStyle, borderRadius: s.r, position: "relative" }}
      >
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
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={s.w * 0.38} height={s.w * 0.38} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.08)" />
          </svg>
        </div>
      </div>
    );
  }

  const suit = parsed!.suit;
  const rank = parsed!.rank;
  const color = SUIT_COLORS[suit];
  const symbol = SUIT_SYMBOLS[suit];

  return (
    <div
      className={`card-face card-deal ${highlight ? "winning-card-glow" : ""} ${className}`}
      style={{ ...baseStyle, borderRadius: s.r, position: "relative" }}
    >
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
        <span style={{ fontSize: s.rankSize, fontWeight: 800, color, fontFamily: "Outfit, sans-serif", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {rank}
        </span>
        <span style={{ fontSize: s.suitCorner, color, lineHeight: 1 }}>{symbol}</span>
      </div>
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
        <span style={{ fontSize: s.rankSize, fontWeight: 800, color, fontFamily: "Outfit, sans-serif", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {rank}
        </span>
        <span style={{ fontSize: s.suitCorner, color, lineHeight: 1 }}>{symbol}</span>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: s.suitCenter, color, lineHeight: 1, userSelect: "none" }}>{symbol}</span>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: s.r,
          background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
