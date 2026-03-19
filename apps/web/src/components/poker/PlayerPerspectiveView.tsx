"use client";

import React from "react";
import PlayingCard from "./PlayingCard";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import type { OpponentForView, PlayerViewState } from "@/lib/overbet-to-player-view";

type SeatSize = "lg" | "md" | "sm";

const TABLE_SEAT_COUNT = 10;
const ARC_ANGLES_BY_COUNT: Record<number, number[]> = {
  1: [90],
  2: [132, 48],
  3: [90, 136, 44],
  4: [112, 68, 146, 34],
  5: [90, 124, 56, 146, 34],
  6: [90, 118, 62, 140, 40, 24],
  7: [90, 116, 64, 136, 44, 150, 30],
  8: [90, 112, 68, 132, 48, 146, 34, 18],
  9: [90, 110, 70, 128, 52, 142, 38, 154, 22],
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "OB";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "OB";
}

function AvatarPlaceholder({
  name,
  size,
  active,
}: {
  name: string;
  size: number;
  active?: boolean;
}) {
  const initials = getInitials(name);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        padding: Math.max(2, Math.round(size * 0.045)),
        background: active
          ? "linear-gradient(135deg, rgba(144, 116, 255, 0.92), rgba(99, 83, 255, 0.32))"
          : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02))",
        boxShadow: active
          ? "0 16px 30px rgba(97, 68, 224, 0.34)"
          : "0 12px 28px rgba(0,0,0,0.34)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.28), transparent 24%), linear-gradient(160deg, #4f34b3 0%, #241a46 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#ffffff",
          fontSize: Math.round(size * 0.34),
          fontWeight: 800,
          fontFamily: "Outfit, sans-serif",
          letterSpacing: "-0.03em",
        }}
      >
        {initials}
      </div>
    </div>
  );
}

function DealerChip({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{
        minWidth: size,
        height: size,
        padding: "0 7px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        color: "#111319",
        border: "1px solid rgba(17,19,25,0.12)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, Math.round(size * 0.48)),
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      D
    </div>
  );
}

function StatusBadge({ status, compactMode }: { status: string; compactMode?: boolean }) {
  const normalized = status.toUpperCase();
  const badgeMap: Record<string, { label: string; color: string; background: string; border: string }> = {
    CALLED: {
      label: "Called",
      color: "#8c84ff",
      background: "rgba(8, 6, 20, 0.92)",
      border: "1px solid rgba(140,132,255,0.4)",
    },
    CHECKED: {
      label: "Checked",
      color: "#7fe0b2",
      background: "rgba(8, 6, 20, 0.92)",
      border: "1px solid rgba(127,224,178,0.36)",
    },
    RAISED: {
      label: "Raised",
      color: "#7fe0b2",
      background: "rgba(8, 6, 20, 0.92)",
      border: "1px solid rgba(127,224,178,0.36)",
    },
    ALL_IN: {
      label: "All-In",
      color: "#f7c86a",
      background: "rgba(8, 6, 20, 0.92)",
      border: "1px solid rgba(247,200,106,0.38)",
    },
    FOLDED: {
      label: "Folded",
      color: "#ff7386",
      background: "rgba(8, 6, 20, 0.92)",
      border: "1px solid rgba(255,115,134,0.3)",
    },
  };

  const badge = badgeMap[normalized];
  if (!badge) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: compactMode ? "4px 10px" : "5px 11px",
        borderRadius: 999,
        color: badge.color,
        background: badge.background,
        border: badge.border,
        fontSize: compactMode ? 10 : 12,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
      }}
    >
      {badge.label}
    </span>
  );
}

function getSeatMetrics(totalPlayers: number, compactMode?: boolean) {
  const seatSize: SeatSize = compactMode
    ? totalPlayers <= 4
      ? "md"
      : "sm"
    : totalPlayers === 2
      ? "md"
      : totalPlayers <= 4
        ? "lg"
        : totalPlayers <= 6
          ? "md"
          : "sm";

  const avatarSize = seatSize === "lg" ? 84 : seatSize === "md" ? 70 : 56;
  const footprintWidth = seatSize === "lg" ? 154 : seatSize === "md" ? 136 : 112;
  const footprintHeight = seatSize === "lg" ? 156 : seatSize === "md" ? 136 : 114;
  const boardCardSize: "sm" | "md" = compactMode ? "sm" : totalPlayers <= 4 ? "md" : "sm";
  const heroCardSize: "md" | "lg" = compactMode ? "lg" : totalPlayers === 2 ? "md" : totalPlayers <= 4 ? "lg" : "md";

  const arc = compactMode
    ? { cy: 0.39, rx: 0.34, ry: 0.28 }
    : totalPlayers === 2
      ? { cy: 0.34, rx: 0.34, ry: 0.14 }
      : totalPlayers <= 4
        ? { cy: 0.4, rx: 0.38, ry: 0.24 }
        : totalPlayers <= 6
          ? { cy: 0.4, rx: 0.4, ry: 0.23 }
          : { cy: 0.39, rx: 0.41, ry: 0.22 };

  return {
    seatSize,
    avatarSize,
    footprintWidth,
    footprintHeight,
    boardCardSize,
    heroCardSize,
    arc,
  };
}

function HiddenHand({ seatSize, compactMode }: { seatSize: SeatSize; compactMode?: boolean }) {
  const hiddenSize: "xs" | "sm" = seatSize === "lg" ? "sm" : "xs";
  const offsetX = seatSize === "lg" ? 20 : seatSize === "md" ? 16 : 12;
  const offsetY = seatSize === "lg" ? 15 : seatSize === "md" ? 12 : 10;

  return (
    <div
      style={{
        position: "absolute",
        right: -offsetX,
        bottom: offsetY,
        display: "flex",
        alignItems: "flex-end",
        gap: 0,
        pointerEvents: "none",
      }}
    >
      <PlayingCard
        faceDown
        size={hiddenSize}
        rotate={compactMode ? -16 : -18}
        style={{ marginRight: -12, opacity: 0.92 }}
      />
      <PlayingCard faceDown size={hiddenSize} rotate={compactMode ? 6 : 8} />
    </div>
  );
}

function OpponentSeat({
  player,
  seatSize,
  avatarSize,
  revealCards,
  isWinner,
  compactMode,
}: {
  player: OpponentForView;
  seatSize: SeatSize;
  avatarSize: number;
  revealCards: boolean;
  isWinner?: boolean;
  compactMode?: boolean;
}) {
  const cards = Array.isArray(player.cards) ? player.cards : [];
  const hasVisibleCards = revealCards && cards.length > 0;
  const cardSize: "xs" | "sm" = seatSize === "lg" ? "sm" : "xs";
  const isFolded = player.status === "FOLDED" || player.status === "folded";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compactMode ? 5 : 7 }}>
      <StatusBadge status={player.status} compactMode={compactMode} />
      <div style={{ position: "relative", minHeight: avatarSize + (compactMode ? 18 : 22), display: "flex", alignItems: "center", justifyContent: "center" }}>
        {player.isActive && (
          <div
            style={{
              position: "absolute",
              inset: -7,
              borderRadius: "50%",
              border: "1px solid rgba(155, 127, 255, 0.44)",
              boxShadow: "0 0 0 10px rgba(93, 63, 199, 0.10), 0 0 28px rgba(114,83,255,0.30)",
              pointerEvents: "none",
            }}
          />
        )}
        {hasVisibleCards ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <AvatarPlaceholder name={player.username} size={Math.round(avatarSize * 0.76)} active={player.isActive} />
              {player.isDealer && (
                <div style={{ position: "absolute", left: -6, bottom: -4 }}>
                  <DealerChip size={compactMode ? 18 : 20} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              {cards.map((card, index) => (
                <PlayingCard
                  key={`${player.id}-${card}-${index}`}
                  card={card}
                  size={cardSize}
                  winning={isWinner}
                  rotate={index === 0 ? -8 : 5}
                  style={{ marginLeft: index === 0 ? 0 : -14, zIndex: index + 1 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <AvatarPlaceholder name={player.username} size={avatarSize} active={player.isActive} />
            <HiddenHand seatSize={seatSize} compactMode={compactMode} />
            {player.isDealer && (
              <div style={{ position: "absolute", left: -6, bottom: -4 }}>
                <DealerChip size={compactMode ? 18 : 20} />
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <span
          style={{
            color: isFolded ? "rgba(255,255,255,0.48)" : "#ffffff",
            fontSize: compactMode ? 12 : seatSize === "lg" ? 15 : 13,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          {player.username}
        </span>
        <ChipAmount
          amount={player.chips}
          iconSize={compactMode ? 10 : 11}
          amountStyle={{
            color: isFolded ? "rgba(255,255,255,0.44)" : "rgba(255,255,255,0.74)",
            fontSize: compactMode ? 11 : 12,
            fontWeight: 600,
          }}
        />
        {player.bet > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: compactMode ? "3px 8px" : "4px 9px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <ChipAmount
              amount={player.bet}
              iconSize={compactMode ? 9 : 10}
              amountStyle={{ color: "rgba(255,255,255,0.9)", fontSize: compactMode ? 10 : 11, fontWeight: 700 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function boardRotation(index: number, compactMode?: boolean) {
  const desktopRotations = [-14, -7, 0, 7, 14];
  const compactRotations = [-10, -4, 0, 4, 10];
  return (compactMode ? compactRotations : desktopRotations)[index] ?? 0;
}

function getSingleOpponentAngle(heroSeatIndex: number, opponentSeatIndex: number) {
  const relative = (opponentSeatIndex - heroSeatIndex + TABLE_SEAT_COUNT) % TABLE_SEAT_COUNT;
  if (relative === TABLE_SEAT_COUNT / 2) return 132;
  return relative > TABLE_SEAT_COUNT / 2 ? 132 : 48;
}

export function PlayerPerspectiveView({
  viewState,
  cleanupShowAllRevealed,
  winnerId,
  winnerCards,
  compactMode,
}: {
  viewState: PlayerViewState;
  cleanupShowAllRevealed?: boolean;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
}) {
  void cleanupShowAllRevealed;

  const { hero, opponents, board, totalPot, currentRoundAmount, dealerId, activePlayerId, phase } = viewState;
  const totalPlayers = opponents.length + 1;
  const metrics = getSeatMetrics(totalPlayers, compactMode);
  const seatAngles =
    opponents.length === 1
      ? [getSingleOpponentAngle(hero.seatIndex ?? 0, opponents[0].seatIndex)]
      : ARC_ANGLES_BY_COUNT[Math.min(opponents.length, 9)] ?? [];
  const isCleanup = phase === "CLEANUP" || phase === "SHOWDOWN";
  const heroIsDealer = dealerId === hero.id;
  const heroIsActive = activePlayerId === hero.id;
  const heroCards = hero.cards?.length === 2 ? hero.cards : [null, null];
  const highlightHero = winnerId === hero.id && hero.cards.some((card) => winnerCards?.includes(card));
  const heroNameSize = compactMode ? 13 : 16;
  const heroBottom = compactMode ? 8 : totalPlayers === 2 ? 12 : 6;
  const boardTop = compactMode ? "36%" : totalPlayers === 2 ? "22%" : totalPlayers <= 4 ? "22%" : "24%";
  const potFontSize = compactMode
    ? "clamp(2.4rem, 6vw, 3rem)"
    : totalPlayers === 2
      ? "clamp(3rem, 4vw, 4rem)"
      : "clamp(3.1rem, 4.4vw, 4.7rem)";

  return (
    <div
      data-testid="player-perspective"
      data-phase={phase}
      data-active-player={activePlayerId}
      style={{
        width: "100%",
        minHeight: 0,
        flex: 1,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: compactMode
          ? "linear-gradient(180deg, rgba(21,18,34,0.96) 0%, rgba(14,12,26,0.98) 100%)"
          : "transparent",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: compactMode
            ? "radial-gradient(circle at 50% 28%, rgba(113,76,255,0.18), transparent 34%)"
            : "radial-gradient(circle at 50% 18%, rgba(114, 83, 255, 0.18), transparent 36%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: compactMode ? "34%" : "28%",
          width: compactMode ? "96%" : totalPlayers === 2 ? "84%" : "88%",
          height: compactMode ? "48%" : totalPlayers === 2 ? "48%" : "54%",
          transform: "translateX(-50%)",
          borderRadius: "50% 50% 46% 46% / 68% 68% 30% 30%",
          background: "linear-gradient(180deg, rgba(52, 43, 100, 0.9) 0%, rgba(24, 20, 46, 0.98) 100%)",
          border: "1px solid rgba(140, 112, 255, 0.18)",
          boxShadow: "0 36px 90px rgba(16, 10, 38, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: compactMode ? "-10%" : totalPlayers === 2 ? "8%" : "4%",
          width: compactMode ? "102%" : "92%",
          height: compactMode ? "60%" : totalPlayers === 2 ? "56%" : "64%",
          transform: "translateX(-50%)",
          borderRadius: "50% 50% 0 0 / 34% 34% 0 0",
          background:
            "radial-gradient(circle at 50% 18%, rgba(86,58,198,0.34) 0%, rgba(38,28,88,0.94) 44%, rgba(18,14,38,0.99) 100%)",
          borderTop: "1px solid rgba(150, 122, 255, 0.22)",
          boxShadow: "0 -22px 70px rgba(100, 61, 233, 0.22)",
          pointerEvents: "none",
        }}
      />

      {opponents.map((opponent, index) => {
        const angleDeg = seatAngles[index] ?? 90;
        const angleRad = (angleDeg * Math.PI) / 180;
        const px = 0.5 + metrics.arc.rx * Math.cos(angleRad);
        const py = metrics.arc.cy - metrics.arc.ry * Math.sin(angleRad);

        return (
          <div
            key={opponent.id}
            style={{
              position: "absolute",
              left: `calc(${(px * 100).toFixed(2)}% - ${metrics.footprintWidth / 2}px)`,
              top: `calc(${(py * 100).toFixed(2)}% - ${metrics.footprintHeight / 2}px)`,
              width: metrics.footprintWidth,
              minHeight: metrics.footprintHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            <OpponentSeat
              player={opponent}
              seatSize={metrics.seatSize}
              avatarSize={metrics.avatarSize}
              revealCards={isCleanup}
              isWinner={winnerId === opponent.id}
              compactMode={compactMode}
            />
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          top: boardTop,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: compactMode ? 14 : 18,
          pointerEvents: "none",
        }}
      >
        <div data-testid="total-pot-indicator" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compactMode ? 8 : 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.48)" }}>
            <ChipIcon size={compactMode ? 11 : 12} />
            <span style={{ fontSize: compactMode ? 10 : 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Total Pot
            </span>
          </div>
          <div data-testid="total-pot-amount">
            <ChipAmount
              amount={totalPot}
              iconSize={compactMode ? 18 : 22}
              amountStyle={{
                color: "#ffffff",
                fontSize: potFontSize,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.05em",
              }}
              style={{ gap: compactMode ? 8 : 10 }}
            />
          </div>
          <div
            data-testid="current-round-indicator"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: compactMode ? "6px 12px" : "8px 14px",
              borderRadius: 999,
              background: "rgba(9, 8, 18, 0.86)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 10px 28px rgba(0,0,0,0.24)",
            }}
          >
            <span style={{ fontSize: compactMode ? 9 : 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>
              Round
            </span>
            <span data-testid="current-round-amount">
              <ChipAmount
                amount={currentRoundAmount}
                iconSize={compactMode ? 9 : 10}
                iconColor="#a78bfa"
                amountStyle={{ color: "#c7b8ff", fontSize: compactMode ? 11 : 12, fontWeight: 700 }}
              />
            </span>
          </div>
        </div>

        <div data-testid="board-cards" style={{ display: "flex", gap: compactMode ? 2 : 4, alignItems: "center" }}>
          {board.map((card, index) => (
            <div
              key={index}
              data-testid={`board-card-${index}`}
              data-revealed={card ? "true" : "false"}
              style={{ marginLeft: index === 0 ? 0 : compactMode ? -4 : -6 }}
            >
              {card ? (
                <PlayingCard
                  card={card}
                  size={metrics.boardCardSize}
                  rotate={boardRotation(index, compactMode)}
                  style={{ zIndex: index + 1 }}
                />
              ) : (
                <PlayingCard dashed size={metrics.boardCardSize} rotate={boardRotation(index, compactMode)} style={{ zIndex: index + 1 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        data-testid="hero-zone"
        style={{
          position: "absolute",
          left: "50%",
          bottom: heroBottom,
          transform: "translateX(-50%)",
          zIndex: 7,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: compactMode ? 8 : 12,
          width: compactMode ? "auto" : "min(360px, 46%)",
        }}
      >
        <div data-testid="hero-cards" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {heroCards.map((card, index) =>
            card ? (
              <PlayingCard
                key={`${hero.id}-${card}-${index}`}
                card={card}
                size={metrics.heroCardSize}
                rotate={index === 0 ? -14 : 9}
                winning={highlightHero}
                style={{ marginLeft: index === 0 ? 0 : compactMode ? -30 : -34, zIndex: index + 1 }}
              />
            ) : (
              <PlayingCard
                key={`${hero.id}-placeholder-${index}`}
                dashed
                size={metrics.heroCardSize}
                rotate={index === 0 ? -14 : 9}
                style={{ marginLeft: index === 0 ? 0 : compactMode ? -30 : -34, zIndex: index + 1 }}
              />
            ),
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: compactMode ? 28 : 32 }}>
          {heroIsDealer && <DealerChip size={compactMode ? 22 : 24} />}
          <span style={{ color: "#ffffff", fontSize: heroNameSize, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {hero.username}
          </span>
          {hero.bet > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: compactMode ? "3px 8px" : "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <span style={{ fontSize: compactMode ? 9 : 10, fontWeight: 700, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Bet
              </span>
              <ChipAmount
                amount={hero.bet}
                iconSize={compactMode ? 9 : 10}
                amountStyle={{ color: "#ffffff", fontSize: compactMode ? 10 : 11, fontWeight: 700 }}
              />
            </div>
          )}
          {heroIsActive && !compactMode && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 999,
                color: "#79f0b7",
                background: "rgba(10, 23, 18, 0.72)",
                border: "1px solid rgba(121, 240, 183, 0.2)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Your turn
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
