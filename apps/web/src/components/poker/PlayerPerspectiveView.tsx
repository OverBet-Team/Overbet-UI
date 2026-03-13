"use client";

/**
 * PlayerPerspectiveView — Moon-style seated player view.
 * Hero at bottom center, opponents in semicircular arc. No empty seats.
 * Replaces the bird's-eye PokerTable for seated users.
 */

import React from "react";
import PlayingCard from "./PlayingCard";
import type { PlayerViewState, OpponentForView } from "@/lib/overbet-to-player-view";

// Default avatar placeholder (initials)
function AvatarPlaceholder({ name, size }: { name: string; size: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #3b2d5c 0%, #2a2040 100%)",
        border: "2px solid rgba(255,255,255,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "rgba(255,255,255,0.9)",
        fontFamily: "Outfit, sans-serif",
      }}
    >
      {initials}
    </div>
  );
}

function ChipIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

// Moon-style face-down card with concentric circles
function FaceDownCard({ w, h, r, rotate = 0 }: { w: number; h: number; r: number; rotate?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "linear-gradient(145deg, #1e1b38 0%, #252245 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
        transform: `rotate(${rotate}deg)`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 3,
          borderRadius: Math.max(r - 3, 2),
          border: "1px solid rgba(255,255,255,0.06)",
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px)",
        }}
      />
      <svg
        width={w * 0.38}
        height={w * 0.38}
        viewBox="0 0 24 24"
        fill="none"
        style={{ position: "relative", zIndex: 1 }}
      >
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="5" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.08)" />
      </svg>
    </div>
  );
}

function DealerChip({ size = 18 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)",
        border: "1.5px solid rgba(0,0,0,0.15)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <span style={{ color: "#1a1a1a", fontSize: size * 0.45, fontWeight: 800, fontFamily: "Outfit, sans-serif", lineHeight: 1 }}>
        D
      </span>
    </div>
  );
}

function OpponentSeat({ player, size }: { player: OpponentForView; size: "lg" | "md" | "sm" }) {
  const isFolded = player.status === "FOLDED" || player.status === "folded";
  const avSize = size === "lg" ? 88 : size === "md" ? 72 : 56;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <AvatarPlaceholder name={player.username} size={avSize} />
        {player.isDealer && (
          <div style={{ position: "absolute", bottom: -4, left: -4, zIndex: 10 }}>
            <DealerChip size={size === "lg" ? 20 : size === "md" ? 16 : 14} />
          </div>
        )}
        {player.isActive && (
          <div
            style={{
              position: "absolute",
              left: -avSize * 0.08,
              top: -avSize * 0.08,
              width: avSize * 1.16,
              height: avSize * 1.16,
              borderRadius: "50%",
              border: "2.5px solid rgba(167,139,250,0.75)",
              boxShadow: "0 0 12px rgba(139,92,246,0.5)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
        {/* Face-down card — Moon-style with moon SVG circles */}
        <div
          style={{
            position: "absolute",
            left: avSize * 0.65,
            top: avSize * 0.15,
            zIndex: 4,
          }}
        >
          <FaceDownCard
            w={size === "lg" ? 44 : size === "md" ? 36 : 28}
            h={size === "lg" ? 60 : size === "md" ? 50 : 38}
            r={8}
            rotate={8}
          />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginTop: 6 }}>
        <span
          style={{
            color: isFolded ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.92)",
            fontSize: size === "lg" ? 14 : size === "md" ? 12 : 11,
            fontWeight: 700,
            fontFamily: "Outfit, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {player.username}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <ChipIcon size={10} />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 500 }}>
            {player.chips.toLocaleString()}
          </span>
        </div>
        {player.bet > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 7px 2px 5px",
              borderRadius: 999,
              background: "rgba(167,139,250,0.2)",
              border: "1px solid rgba(167,139,250,0.3)",
              fontSize: 10,
              fontWeight: 600,
              color: "#a78bfa",
            }}
          >
            {player.bet}
          </div>
        )}
        {/* Status badges — Moon-style */}
        {isFolded && (
          <span
            style={{
              display: "inline-flex",
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(107,114,128,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            Folded
          </span>
        )}
        {!isFolded && (player.status === "CALLED" || player.status === "called") && (
          <span
            style={{
              display: "inline-flex",
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(147,197,253,0.15)",
              border: "1px solid rgba(147,197,253,0.25)",
              fontSize: 10,
              fontWeight: 600,
              color: "#93c5fd",
              letterSpacing: "0.04em",
            }}
          >
            Called
          </span>
        )}
        {!isFolded && (player.status === "RAISED" || player.status === "raised") && (
          <span
            style={{
              display: "inline-flex",
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(110,231,183,0.15)",
              border: "1px solid rgba(110,231,183,0.25)",
              fontSize: 10,
              fontWeight: 600,
              color: "#6ee7b7",
              letterSpacing: "0.04em",
            }}
          >
            Raised
          </span>
        )}
      </div>
    </div>
  );
}

const ARC_ANGLES_BY_COUNT: Record<number, number[]> = {
  1: [90],
  2: [135, 45],
  3: [90, 140, 40],
  4: [112, 68, 145, 35],
  5: [90, 125, 55, 148, 32],
  6: [90, 118, 62, 142, 38, 155],
  7: [90, 116, 64, 138, 42, 152, 28],
  8: [90, 113, 67, 134, 46, 150, 30, 158],
  9: [90, 110, 70, 130, 50, 148, 32, 158, 22],
};

const arcCY_pct = 0.44;
const arcRX_pct = 0.38;
const arcRY_pct = 0.38;

export function PlayerPerspectiveView({ viewState, cleanupShowAllRevealed }: { viewState: PlayerViewState; cleanupShowAllRevealed?: boolean }) {
  const { hero, opponents, board, pot } = viewState;
  const total = opponents.length + 1;
  const seatSize: "lg" | "md" | "sm" = total <= 4 ? "lg" : total <= 6 ? "md" : "sm";
  const seatAngles = ARC_ANGLES_BY_COUNT[Math.min(opponents.length, 9)] ?? [];

  const seatFootprintW = seatSize === "lg" ? 96 : seatSize === "md" ? 80 : 64;
  const seatFootprintH = seatSize === "lg" ? 140 : seatSize === "md" ? 115 : 90;

  return (
    <div
      style={{
        width: "100%",
        minHeight: 0,
        flex: 1,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(170deg, #1a1428 0%, #141420 35%, #0f0e1a 100%)",
      }}
    >
      {/* Arc background */}
      <div className="table-surface" style={{ zIndex: 0 }} />
      <div className="table-glow" style={{ zIndex: 0 }} />

      {/* Opponents on semicircular arc */}
      {opponents.map((opp, i) => {
        const angleDeg = seatAngles[i] ?? 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const px_pct = 0.5 + arcRX_pct * Math.cos(angleRad);
        const py_pct = arcCY_pct - arcRY_pct * Math.sin(angleRad);
        return (
          <div
            key={opp.id}
            style={{
              position: "absolute",
              left: `calc(${(px_pct * 100).toFixed(2)}% - ${seatFootprintW / 2}px)`,
              top: `calc(${(py_pct * 100).toFixed(2)}% - ${seatFootprintH / 2}px)`,
              zIndex: 6,
              animation: "fadeInSeat 0.4s ease forwards",
              animationDelay: `${i * 60}ms`,
              opacity: 0,
            }}
          >
            <OpponentSeat player={opp} size={seatSize} />
          </div>
        );
      })}

      {/* Pot + Community cards */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          transform: "translateX(-50%)",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.4)" }}>
            <ChipIcon size={11} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Pot
            </span>
          </div>
          <span
            style={{
              color: "#ffffff",
              fontSize: "clamp(2.8rem, 5vw, 4.5rem)",
              fontWeight: 800,
              fontFamily: "Outfit, sans-serif",
              lineHeight: 1,
            }}
          >
            {pot > 0 ? pot.toLocaleString() : "0"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {board.map((card, i) =>
            card ? (
              <PlayingCard key={i} card={card} size="md" />
            ) : (
              <PlayingCard key={i} dashed size="md" />
            )
          )}
        </div>
      </div>

      {/* Hero hand — bottom center, Moon-style bottom: -50 overlaps arc */}
      <div
        style={{
          position: "absolute",
          bottom: -50,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 7,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 0 }}>
          {(hero.cards?.length === 2 ? hero.cards : [null, null]).map((card, i) =>
            card ? (
              <PlayingCard
                key={i}
                card={card}
                size="xl"
                rotate={i === 0 ? -10 : 6}
                style={{ marginLeft: i > 0 ? -44 : 0, zIndex: i + 1 }}
              />
            ) : (
              <PlayingCard
                key={i}
                dashed
                size="lg"
                rotate={i === 0 ? -10 : 6}
                style={{ marginLeft: i > 0 ? -36 : 0, zIndex: i + 1 }}
              />
            )
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 14, fontWeight: 700, fontFamily: "Outfit, sans-serif" }}>
            {hero.username}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <ChipIcon size={11} />
            <span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>
              {hero.chips.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
