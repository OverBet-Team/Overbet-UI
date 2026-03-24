"use client";

import React from "react";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import Lock from "lucide-react/dist/esm/icons/lock";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import Users from "lucide-react/dist/esm/icons/users";
import PlayingCard from "./PlayingCard";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import type { PlayerViewState, OpponentForView } from "@/lib/overbet-to-player-view";

const hiddenHookStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
  overflow: "hidden",
  pointerEvents: "none",
  zIndex: -1,
};

const layoutByOpponentCount: Record<
  number,
  Array<{ x: string; y: string; align: "left" | "center" | "right"; size: "lg" | "md" | "sm" }>
> = {
  1: [{ x: "50%", y: "16%", align: "center", size: "lg" }],
  2: [
    { x: "22%", y: "17%", align: "left", size: "lg" },
    { x: "78%", y: "17%", align: "right", size: "lg" },
  ],
  3: [
    { x: "50%", y: "10%", align: "center", size: "md" },
    { x: "21%", y: "19%", align: "left", size: "lg" },
    { x: "79%", y: "19%", align: "right", size: "lg" },
  ],
  4: [
    { x: "35%", y: "9%", align: "center", size: "md" },
    { x: "65%", y: "9%", align: "center", size: "md" },
    { x: "18%", y: "20%", align: "left", size: "lg" },
    { x: "82%", y: "20%", align: "right", size: "lg" },
  ],
  5: [
    { x: "50%", y: "7%", align: "center", size: "sm" },
    { x: "29%", y: "11%", align: "center", size: "md" },
    { x: "71%", y: "11%", align: "center", size: "md" },
    { x: "17%", y: "22%", align: "left", size: "lg" },
    { x: "83%", y: "22%", align: "right", size: "lg" },
  ],
  6: [
    { x: "39%", y: "6%", align: "center", size: "sm" },
    { x: "61%", y: "6%", align: "center", size: "sm" },
    { x: "25%", y: "11%", align: "center", size: "md" },
    { x: "75%", y: "11%", align: "center", size: "md" },
    { x: "15%", y: "23%", align: "left", size: "lg" },
    { x: "85%", y: "23%", align: "right", size: "lg" },
  ],
};

function getOpponentLayout(count: number) {
  return layoutByOpponentCount[count] ?? layoutByOpponentCount[6];
}

function getPhaseLabel(phase?: string) {
  return (phase ?? "Waiting").replace(/_/g, " ");
}

function getUserInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OB";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusLabel(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "FOLDED") return "Folded";
  if (normalized === "CALLED") return "Called";
  if (normalized === "CHECKED") return "Checked";
  if (normalized === "RAISED") return "Raised";
  if (normalized === "ALL_IN") return "All in";
  return normalized === "ACTIVE" ? "In hand" : normalized.toLowerCase();
}

function getStatusTone(status: string, isActive: boolean) {
  if (isActive) return "active";

  const normalized = status.toUpperCase();
  if (normalized === "FOLDED") return "folded";
  if (normalized === "RAISED" || normalized === "ALL_IN") return "aggressive";
  return "neutral";
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        height: 24,
        padding: "0 8px",
        borderRadius: 999,
        background: "linear-gradient(180deg, rgba(29,29,34,0.92) 0%, rgba(18,18,22,0.82) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.82)",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 10px 20px rgba(0,0,0,0.24)",
        backdropFilter: "blur(18px)",
      }}
    >
      {children}
    </span>
  );
}

function Avatar({
  name,
  size,
  active,
  folded,
}: {
  name: string;
  size: number;
  active?: boolean;
  folded?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 32% 28%, rgba(234,226,255,0.28) 0%, rgba(44,44,52,0.96) 34%, rgba(15,15,18,0.98) 100%)",
        border: active ? "1.5px solid rgba(0, 227, 253, 0.58)" : "1px solid rgba(255,255,255,0.1)",
        color: "rgba(246,243,245,0.94)",
        fontSize: Math.round(size * 0.32),
        fontWeight: 700,
        letterSpacing: "-0.05em",
        boxShadow: active
          ? "0 0 0 1px rgba(0,227,253,0.16), 0 0 26px rgba(0,227,253,0.18), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "0 20px 42px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)",
        filter: folded ? "grayscale(1) opacity(0.64)" : undefined,
      }}
    >
      {getUserInitials(name)}
    </div>
  );
}

function OpponentHoleCards({ revealedCards, size, dimmed }: { revealedCards?: string[]; size: "lg" | "md" | "sm"; dimmed?: boolean }) {
  const hiddenSize = size === "lg" ? "sm" : "xs";
  const revealedSize = size === "lg" ? "md" : size === "md" ? "sm" : "xs";

  if (revealedCards && revealedCards.length > 0) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
        {revealedCards.slice(0, 2).map((card, index) => (
          <div
            key={`${card}-${index}`}
            style={{
              marginLeft: index > 0 ? -8 : 0,
              transform: `translateY(${index === 0 ? 5 : 0}px)`,
              zIndex: index + 1,
            }}
          >
            <PlayingCard
              card={card}
              size={revealedSize}
              rotate={index === 0 ? -5 : 6}
              style={{ filter: dimmed ? "grayscale(1) opacity(0.78)" : undefined }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: size === "lg" ? 66 : 54, height: size === "lg" ? 54 : 42 }}>
      <PlayingCard
        faceDown
        size={hiddenSize}
        rotate={-10}
        style={{ position: "absolute", left: 0, top: 11, filter: dimmed ? "grayscale(1) opacity(0.7)" : undefined }}
      />
      <PlayingCard
        faceDown
        size={hiddenSize}
        rotate={8}
        style={{ position: "absolute", right: 0, top: 0, filter: dimmed ? "grayscale(1) opacity(0.7)" : undefined }}
      />
    </div>
  );
}

function OpponentSlot({
  player,
  position,
  revealCards,
  isWinner,
  compactMode,
}: {
  player: OpponentForView;
  position: { x: string; y: string; align: "left" | "center" | "right"; size: "lg" | "md" | "sm" };
  revealCards: boolean;
  isWinner: boolean;
  compactMode?: boolean;
}) {
  const folded = player.status.toUpperCase() === "FOLDED";
  const avatarSize = position.size === "lg" ? (compactMode ? 66 : 76) : position.size === "md" ? 58 : 50;
  const tone = getStatusTone(player.status, player.isActive);
  const translateX = position.align === "left" ? "0" : position.align === "right" ? "-100%" : "-50%";

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translate(${translateX}, 0)`,
        display: "flex",
        flexDirection: "column",
        alignItems: position.align === "left" ? "flex-start" : position.align === "right" ? "flex-end" : "center",
        gap: compactMode ? 7 : 9,
        minWidth: position.size === "lg" ? 164 : 136,
        opacity: folded ? 0.56 : 1,
        filter: folded ? "saturate(0.55)" : undefined,
        zIndex: player.isActive ? 8 : 5,
      }}
    >
      <span className="status-pill" data-tone={tone}>
        {getStatusLabel(player.status)}
      </span>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: compactMode ? 8 : 11,
          flexDirection: position.align === "right" ? "row-reverse" : "row",
        }}
      >
        <div style={{ position: "relative" }}>
          <Avatar name={player.username} size={avatarSize} active={player.isActive || isWinner} folded={folded} />
          <div
            style={{
              position: "absolute",
              left: position.align === "right" ? undefined : -4,
              right: position.align === "right" ? -4 : undefined,
              bottom: -4,
              display: "flex",
              gap: 4,
            }}
          >
            {player.isDealer ? <Badge>D</Badge> : null}
            {!player.isDealer && player.isSB ? <Badge>SB</Badge> : null}
            {!player.isDealer && !player.isSB && player.isBB ? <Badge>BB</Badge> : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: position.align === "right" ? "flex-end" : "flex-start",
            gap: 5,
          }}
        >
          <div
            style={{
              color: "#f6f3f5",
              fontSize: position.size === "lg" ? 17 : 14,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {player.username}
          </div>
          <ChipAmount
            amount={player.chips}
            iconSize={11}
            iconColor="rgba(255,255,255,0.42)"
            amountStyle={{
              color: "rgba(255,255,255,0.66)",
              fontSize: position.size === "lg" ? 13 : 12,
              fontWeight: 600,
            }}
          />
          {player.bet > 0 ? (
            <div className="bet-chip">
              <ChipAmount
                amount={player.bet}
                iconSize={10}
                iconColor="#81ecff"
                amountStyle={{ color: "#81ecff", fontSize: 12, fontWeight: 700 }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <OpponentHoleCards revealedCards={revealCards ? player.cards : undefined} size={position.size} dimmed={folded} />
    </div>
  );
}

function TopChrome({
  roomName,
  phase,
  blindLabel,
  variantLabel,
  playerCount,
  userLabel,
  isHost,
  isPaused,
  onOpenFairness,
  onOpenHostControls,
}: {
  roomName: string;
  phase?: string;
  blindLabel: string;
  variantLabel: string;
  playerCount: number;
  userLabel: string;
  isHost?: boolean;
  isPaused?: boolean;
  onOpenFairness?: () => void;
  onOpenHostControls?: () => void;
}) {
  return (
    <div
      className="top-chrome-shell"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 24px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <div
            style={{
              color: "rgba(255,255,255,0.46)",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            OverBet
          </div>
          <div
            style={{
              color: "#f6f3f5",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {roomName}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              color: "rgba(255,255,255,0.54)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span data-testid="phase-label-visual">{getPhaseLabel(phase)}</span>
            <span>{playerCount} Players</span>
            {isPaused ? <span style={{ color: "#ffb16e" }}>Paused</span> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div className="top-meta-pill">
          <span>{variantLabel}</span>
          <span style={{ color: "rgba(255,255,255,0.26)" }}>•</span>
          <span>{blindLabel}</span>
        </div>

        {isHost ? (
          <button type="button" className="icon-btn" aria-label="Open host controls" onClick={onOpenHostControls}>
            <Users size={16} />
          </button>
        ) : null}

        <button type="button" className="icon-btn" aria-label="Open fairness panel" onClick={onOpenFairness}>
          <Shield size={16} />
        </button>

        <div
          aria-label="Current user"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, rgba(31,31,36,0.84) 0%, rgba(17,17,20,0.76) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#f6f3f5",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 26px rgba(0,0,0,0.22)",
            backdropFilter: "blur(18px)",
          }}
        >
          {userLabel}
        </div>
      </div>
    </div>
  );
}

export const PlayerPerspectiveView = React.memo(function PlayerPerspectiveView({
  viewState,
  roomName = "OverBet Table",
  variantLabel = "NLH",
  blindLabel = "5 / 10",
  playerCount,
  userLabel,
  heroStack,
  heroBet = 0,
  actionBar,
  turnTimerBadge,
  helpActive = false,
  logActive = false,
  onToggleHelp,
  onToggleLog,
  onOpenFairness,
  onOpenHostControls,
  winnerId,
  winnerCards,
  compactMode,
  isHost,
  isPaused,
  lastSocketError,
  showRevealAllButton,
  onRevealAll,
}: {
  viewState: PlayerViewState;
  roomName?: string;
  variantLabel?: string;
  blindLabel?: string;
  playerCount?: number;
  userLabel?: string;
  heroStack?: number | null;
  heroBet?: number;
  actionBar?: React.ReactNode;
  turnTimerBadge?: React.ReactNode;
  helpActive?: boolean;
  logActive?: boolean;
  onToggleHelp?: () => void;
  onToggleLog?: () => void;
  onOpenFairness?: () => void;
  onOpenHostControls?: () => void;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
  isHost?: boolean;
  isPaused?: boolean;
  lastSocketError?: string | null;
  showRevealAllButton?: boolean;
  onRevealAll?: () => void;
}) {
  const { hero, opponents, board, totalPot, currentRoundAmount, phase } = viewState;
  const revealOpponentCards = phase === "CLEANUP" || phase === "SHOWDOWN";
  const activeOpponentCount = opponents.length;
  const opponentLayout = getOpponentLayout(activeOpponentCount);
  const heroHighlight = winnerId === hero.id && hero.cards.some((card) => winnerCards?.includes(card));
  const displayHeroStack = heroStack ?? hero.chips;
  const dockIsStacked = !!compactMode;
  const handleToggleHelp = onToggleHelp ?? (() => {});
  const handleToggleLog = onToggleLog ?? (() => {});
  const handleOpenFairness = onOpenFairness ?? (() => {});

  return (
    <div
      data-testid="player-perspective"
      data-phase={phase}
      data-active-player={viewState.activePlayerId}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 60%, rgba(37,37,45,0.38) 0%, rgba(18,18,22,0.98) 46%, #0d0d10 100%)",
      }}
    >
      <div aria-hidden="true" className="scene-noise-overlay" />

      <TopChrome
        roomName={roomName}
        phase={phase}
        blindLabel={blindLabel}
        variantLabel={variantLabel}
        playerCount={playerCount ?? activeOpponentCount + 1}
        userLabel={userLabel ?? getUserInitials(hero.username)}
        isHost={isHost}
        isPaused={isPaused}
        onOpenFairness={handleOpenFairness}
        onOpenHostControls={onOpenHostControls}
      />

      <div data-testid="current-round-indicator" style={hiddenHookStyle} hidden>
        <span>Round</span>
        <span data-testid="current-round-amount">{currentRoundAmount}</span>
      </div>

      {lastSocketError ? (
        <div
          data-testid="ui-error-banner"
          style={{
            position: "absolute",
            top: compactMode ? 78 : 88,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 22,
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(244,63,94,0.12)",
            border: "1px solid rgba(244,63,94,0.32)",
            color: "#ff9aac",
            fontSize: 12,
            fontWeight: 700,
            backdropFilter: "blur(18px)",
          }}
        >
          {lastSocketError}
        </div>
      ) : null}

      <div style={{ position: "absolute", inset: 0, paddingTop: compactMode ? 110 : 118 }}>
        {opponents.map((opponent, index) => (
          <OpponentSlot
            key={opponent.id}
            player={opponent}
            position={opponentLayout[index] ?? opponentLayout[opponentLayout.length - 1]}
            revealCards={revealOpponentCards}
            isWinner={winnerId === opponent.id}
            compactMode={compactMode}
          />
        ))}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: compactMode ? "28.5%" : "29.5%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: compactMode ? 16 : 18,
            zIndex: 6,
          }}
        >
          <div
            data-testid="total-pot-indicator"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "rgba(255,255,255,0.58)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              <ChipIcon size={11} color="rgba(255,255,255,0.5)" />
              <span>Total Pot</span>
            </div>
            <div data-testid="total-pot-amount">
              <ChipAmount
                amount={totalPot}
                iconSize={0}
                amountStyle={{
                  color: "#f6f3f5",
                  fontSize: compactMode ? 56 : 72,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.06em",
                }}
                style={{ gap: 0 }}
              />
            </div>
          </div>

          <div
            data-testid="board-cards"
            className="stage-panel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: compactMode ? 8 : 12,
              padding: compactMode ? 10 : 14,
            }}
          >
            {board.map((card, index) => (
              <div key={`${card ?? "empty"}-${index}`} data-testid={`board-card-${index}`} data-revealed={card ? "true" : "false"}>
                {card ? (
                  <PlayingCard card={card} size={compactMode ? "sm" : "md"} />
                ) : (
                  <PlayingCard dashed size={compactMode ? "sm" : "md"} />
                )}
              </div>
            ))}
          </div>
        </div>

        {showRevealAllButton ? (
          <button
            type="button"
            onClick={onRevealAll}
            style={{
              position: "absolute",
              left: 24,
              bottom: dockIsStacked ? 176 : 152,
              zIndex: 18,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 16px",
              borderRadius: 999,
              border: "1px solid rgba(228,215,253,0.26)",
              background: "linear-gradient(180deg, rgba(37,37,45,0.84) 0%, rgba(19,19,23,0.72) 100%)",
              color: "#e4d7fd",
              fontSize: 13,
              fontWeight: 700,
              backdropFilter: "blur(18px)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
              cursor: "pointer",
            }}
          >
            Show all cards
          </button>
        ) : null}

        <div
          data-testid="hero-zone"
          style={{
            position: "absolute",
            left: "50%",
            bottom: dockIsStacked ? 154 : 126,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            zIndex: 9,
          }}
        >
          <div data-testid="hero-cards" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {(hero.cards?.length === 2 ? hero.cards : [null, null]).map((card, index) => {
              const cardOffset = index > 0 ? (compactMode ? -40 : -54) : 0;
              const translateY = index === 0 ? 8 : 0;

              return (
                <div
                  key={card ? `${card}-${index}` : `empty-${index}`}
                  style={{
                    marginLeft: cardOffset,
                    transform: `translateY(${translateY}px)`,
                    zIndex: index + 1,
                  }}
                >
                  <PlayingCard
                    card={card ?? undefined}
                    dashed={!card}
                    size={compactMode ? "lg" : "xl"}
                    rotate={index === 0 ? -9 : 8}
                    winning={card ? heroHighlight : false}
                    style={{ transformOrigin: index === 0 ? "bottom right" : "bottom left" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="dock-shell"
        style={{
          position: "absolute",
          left: "50%",
          bottom: compactMode ? 10 : 16,
          transform: "translateX(-50%)",
          width: compactMode ? "calc(100% - 20px)" : "min(1120px, calc(100% - 40px))",
          zIndex: 14,
          padding: compactMode ? 12 : 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: dockIsStacked ? "1fr" : "minmax(170px, 220px) minmax(360px, 1fr) minmax(170px, 240px)",
            alignItems: "center",
            gap: compactMode ? 10 : 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: dockIsStacked ? "space-between" : "flex-start",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="ghost-pill" data-active={helpActive} onClick={handleToggleHelp}>
                <HelpCircle size={14} />
                <span>Help</span>
              </button>
              <button type="button" className="ghost-pill" data-active={logActive} onClick={handleToggleLog}>
                <ScrollText size={14} />
                <span>Log</span>
              </button>
            </div>
            {dockIsStacked ? turnTimerBadge : null}
          </div>

          <div style={{ minWidth: 0, display: "flex", justifyContent: "center" }}>{actionBar}</div>

          <div
            style={{
              display: "flex",
              alignItems: dockIsStacked ? "stretch" : "center",
              justifyContent: dockIsStacked ? "space-between" : "flex-end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {!dockIsStacked ? turnTimerBadge : null}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: dockIsStacked ? "flex-start" : "flex-end",
                gap: 5,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "rgba(255,255,255,0.46)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                <Lock size={10} />
                <span>Your Bank</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <ChipAmount
                  amount={displayHeroStack ?? 0}
                  iconSize={14}
                  iconColor="rgba(255,255,255,0.58)"
                  amountStyle={{
                    color: "#f6f3f5",
                    fontSize: compactMode ? 18 : 22,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                  }}
                />
                {heroBet > 0 ? (
                  <div className="bet-chip">
                    <ChipAmount
                      amount={heroBet}
                      iconSize={10}
                      iconColor="#81ecff"
                      amountStyle={{ color: "#81ecff", fontSize: 12, fontWeight: 700 }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
