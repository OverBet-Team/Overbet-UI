"use client";

/**
 * PlayerPerspectiveView — Moon-style seated player view.
 * Hero at bottom center, opponents in semicircular arc. No empty seats.
 * Replaces the bird's-eye PokerTable for seated users.
 */

import React from "react";
import PlayingCard from "./PlayingCard";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import type { PlayerViewState, OpponentForView } from "@/lib/overbet-to-player-view";

// Default avatar placeholder (initials). Dynamic width/height/fontSize kept as inline style.
function AvatarPlaceholder({ name, size }: { name: string; size: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-[--bg-elevated] border-2 border-white/[0.14] flex items-center justify-center text-white/90 font-bold font-body"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function DealerChip({ size = 18 }: { size?: number }) {
  return (
    <div className="w-[18px] h-[18px] rounded-full bg-[--gold] text-black font-extrabold text-[8px] flex items-center justify-center flex-shrink-0 z-10">
      D
    </div>
  );
}

function OpponentSeat({
  player,
  size,
  isWinner,
  showCards,
}: {
  player: OpponentForView;
  size: "lg" | "md" | "sm";
  isWinner?: boolean;
  showCards?: boolean;
}) {
  const isFolded = player.status === "FOLDED" || player.status === "folded";
  const avSize = size === "lg" ? 88 : size === "md" ? 72 : 56;
  const cards = Array.isArray(player.cards) ? player.cards : [];
  const hasRevealedCards = showCards && cards.length > 0;
  const cardSize = size === "lg" ? "md" : "sm";
  // Map OpponentSeat size to PlayingCard faceDown size: sm→xs, md/lg→sm
  const faceDownSize = size === "sm" ? "xs" : "sm";

  return (
    <div className={`flex flex-col items-center gap-0${isFolded ? " opacity-50 grayscale" : ""}`}>
      <div className="relative flex-shrink-0">
        {hasRevealedCards ? (
          <div className="flex items-end gap-1.5">
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                border: isWinner ? "2.5px solid rgba(234,179,8,0.7)" : undefined,
                borderRadius: "50%",
                boxShadow: isWinner ? "0 0 12px rgba(234,179,8,0.4)" : undefined,
                padding: 2,
              }}
            >
              <AvatarPlaceholder name={player.username} size={Math.round(avSize * 0.7)} />
            </div>
            {cards.map((card, i) => (
              <PlayingCard key={i} card={card} size={cardSize} winning={isWinner} />
            ))}
          </div>
        ) : (
          <>
            <AvatarPlaceholder name={player.username} size={avSize} />
            {player.isDealer && (
              <div className="absolute -bottom-1 -left-1 z-10">
                <DealerChip size={size === "lg" ? 20 : size === "md" ? 16 : 14} />
              </div>
            )}
            {player.isActive && (
              <div
                className="absolute rounded-full ring-2 ring-[--accent]/75 shadow-[0_0_12px_rgba(59,130,246,0.5)] pointer-events-none"
                style={{
                  left: -avSize * 0.08,
                  top: -avSize * 0.08,
                  width: avSize * 1.16,
                  height: avSize * 1.16,
                  zIndex: 5,
                }}
              />
            )}
            {/* Face-down card positioned over the avatar */}
            <div
              className="absolute z-[4]"
              style={{ left: avSize * 0.65, top: avSize * 0.15 }}
            >
              <PlayingCard faceDown size={faceDownSize} rotate={8} />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-[3px] mt-1.5">
        <span
          className="font-bold font-body whitespace-nowrap text-white/90"
          style={{ fontSize: size === "lg" ? 14 : size === "md" ? 12 : 11 }}
        >
          {player.username}
        </span>
        <ChipAmount
          amount={player.chips}
          iconSize={10}
          amountStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 500 }}
        />
        {player.bet > 0 && (
          <div className="inline-flex items-center gap-[3px] px-[7px] py-[2px] rounded-full bg-[--accent]/20 border border-[--accent]/30 text-[--accent]">
            <ChipAmount
              amount={player.bet}
              iconSize={9}
              iconColor="var(--accent)"
              amountStyle={{ color: "inherit", fontSize: 10, fontWeight: 600 }}
            />
          </div>
        )}
        {/* Status badges */}
        {isFolded && (
          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-white/10 border border-white/[0.08] text-white/50">
            Folded
          </span>
        )}
        {!isFolded && (player.status === "CALLED" || player.status === "called") && (
          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-[--accent]/15 border border-[--accent]/25 text-[--accent]">
            Called
          </span>
        )}
        {!isFolded && (player.status === "RAISED" || player.status === "raised") && (
          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-[--success]/15 border border-[--success]/25 text-[--success]">
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

export function PlayerPerspectiveView({
  viewState,
  winnerId,
  winnerCards,
  compactMode,
}: {
  viewState: PlayerViewState;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
}) {
  const { hero, opponents, board, totalPot, currentRoundAmount, phase, activePlayerId } = viewState;
  const isCleanup = phase === "CLEANUP" || phase === "SHOWDOWN";
  const total = opponents.length + 1;
  const seatSize: "lg" | "md" | "sm" = compactMode
    ? total <= 4
      ? "md"
      : "sm"
    : total <= 4
      ? "lg"
      : total <= 6
        ? "md"
        : "sm";
  const seatAngles = ARC_ANGLES_BY_COUNT[Math.min(opponents.length, 9)] ?? [];
  const arcRX = compactMode ? 0.34 : arcRX_pct;
  const arcRY = compactMode ? 0.32 : arcRY_pct;
  const arcCY = compactMode ? 0.39 : arcCY_pct;
  const boardCardSize = compactMode ? "sm" : "md";
  const heroCardSize = compactMode ? "lg" : "xl";
  const heroBottom = compactMode ? 6 : -50;
  const heroGap = compactMode ? 4 : 6;
  const potTop = compactMode ? "40%" : "44%";
  const highlightHero = winnerId === hero.id && hero.cards.some((c) => winnerCards?.includes(c));

  const seatFootprintW = seatSize === "lg" ? 96 : seatSize === "md" ? 80 : 64;
  const seatFootprintH = seatSize === "lg" ? 140 : seatSize === "md" ? 115 : 90;

  return (
    <div
      data-testid="player-perspective"
      data-phase={phase}
      data-active-player={activePlayerId}
      className="bg-[--bg-base] w-full flex-1 relative overflow-hidden flex flex-col"
      style={{ minHeight: 0 }}
    >
      {/* Arc background */}
      <div className="table-felt" style={{ zIndex: 0 }} />

      {/* Opponents on semicircular arc */}
      {opponents.map((opp, i) => {
        const angleDeg = seatAngles[i] ?? 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const px_pct = 0.5 + arcRX * Math.cos(angleRad);
        const py_pct = arcCY - arcRY * Math.sin(angleRad);
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
            <OpponentSeat
              player={opp}
              size={seatSize}
              isWinner={winnerId === opp.id}
              showCards={isCleanup}
            />
          </div>
        );
      })}

      {/* Pot + Community cards */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: potTop,
          transform: "translateX(-50%)",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          pointerEvents: "none",
        }}
      >
        <div data-testid="total-pot-indicator" className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-[5px] text-[--text-secondary]">
            <ChipIcon size={11} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Total Pot
            </span>
          </div>
          <div data-testid="total-pot-amount">
            <ChipAmount
              amount={totalPot}
              iconSize={compactMode ? 20 : 24}
              amountStyle={{
                color: "var(--text-primary)",
                fontSize: "clamp(2.8rem, 5vw, 4.5rem)",
                fontWeight: 800,
                fontFamily: "var(--font-display)",
                lineHeight: 1,
              }}
              style={{ gap: compactMode ? 8 : 10 }}
            />
          </div>
          <div
            data-testid="current-round-indicator"
            className="inline-flex items-center gap-2 rounded-full bg-black/45 border border-[--accent]/24 text-white/[0.78] shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            style={{ padding: compactMode ? "5px 10px" : "6px 12px" }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
              Round
            </span>
            <span data-testid="current-round-amount">
              <ChipAmount
                amount={currentRoundAmount}
                iconSize={compactMode ? 10 : 11}
                iconColor="var(--accent)"
                amountStyle={{ color: "var(--accent)", fontSize: compactMode ? 11 : 12, fontWeight: 700 }}
              />
            </span>
          </div>
        </div>
        <div data-testid="board-cards" style={{ display: "flex", gap: compactMode ? 4 : 6, alignItems: "center" }}>
          {board.map((card, i) =>
            <div key={i} data-testid={`board-card-${i}`} data-revealed={card ? "true" : "false"}>
              {card ? (
                <PlayingCard card={card} size={boardCardSize} />
              ) : (
                <PlayingCard dashed size={boardCardSize} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hero hand — bottom center, Moon-style bottom: -50 overlaps arc */}
      <div
        data-testid="hero-zone"
        style={{
          position: "absolute",
          bottom: heroBottom,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 7,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: heroGap,
        }}
      >
        <div data-testid="hero-cards" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 0 }}>
          {(hero.cards?.length === 2 ? hero.cards : [null, null]).map((card, i) =>
            card ? (
              <PlayingCard
                key={i}
                card={card}
                size={heroCardSize}
                rotate={i === 0 ? -10 : 6}
                style={{ marginLeft: i > 0 ? (compactMode ? -34 : -44) : 0, zIndex: i + 1 }}
                winning={highlightHero}
              />
            ) : (
              <PlayingCard
                key={i}
                dashed
                size="lg"
                rotate={i === 0 ? -10 : 6}
                style={{ marginLeft: i > 0 ? (compactMode ? -28 : -36) : 0, zIndex: i + 1 }}
              />
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[--text-primary] font-semibold font-body"
            style={{ fontSize: compactMode ? 12 : 14 }}
          >
            {hero.username}
          </span>
          <ChipAmount
            amount={hero.chips}
            iconSize={compactMode ? 9 : 11}
            amountStyle={{ color: "var(--accent)", fontSize: compactMode ? 11 : 13, fontWeight: 700 }}
          />
        </div>
      </div>
    </div>
  );
}
