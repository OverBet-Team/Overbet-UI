"use client";

/**
 * PlayerPerspectiveView — Moon Poker seated player view.
 * Hero at bottom center, opponents in flexbox layout (row on mobile, flanking on desktop).
 * No empty seats. Uses new AvatarRing, StatusBadge, PotDisplay, HeroHand components.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { ChipAmount, ChipIcon } from "./ChipAmount";
import StatusBadge from "./StatusBadge";
import AvatarRing from "./AvatarRing";
import PotDisplay from "./PotDisplay";
import HeroHand from "./HeroHand";
import HandStrengthRing from "./HandStrengthRing";
import HandAnalysisWidget from "./HandAnalysisWidget";
import type { PlayerViewState, OpponentForView } from "@/lib/overbet-to-player-view";
import type { TurnTimer } from "@/components/poker/Seat";

// Default avatar placeholder (initials). Dynamic width/height/fontSize kept as inline style.
const AvatarPlaceholder = React.memo(function AvatarPlaceholder({
  name,
  size,
}: {
  name: string;
  size: number;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-[--surface-container-high] flex items-center justify-center text-white/90 font-bold font-headline"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
});

const SBChip = React.memo(function SBChip() {
  return (
    <div className="w-[22px] h-[22px] rounded-full bg-[--tertiary] text-white text-[9px] font-black flex items-center justify-center flex-shrink-0 z-10 shadow-md">
      SB
    </div>
  );
});

const BBChip = React.memo(function BBChip() {
  return (
    <div className="w-[22px] h-[22px] rounded-full bg-[--gold] text-black text-[9px] font-black flex items-center justify-center flex-shrink-0 z-10 shadow-md">
      BB
    </div>
  );
});

const OpponentSeat = React.memo(function OpponentSeat({
  player,
  isWinner,
  showCards,
  isSB,
  isBB,
  isActive,
  delay,
  turnTimer,
}: {
  player: OpponentForView;
  isWinner?: boolean;
  showCards?: boolean;
  isSB?: boolean;
  isBB?: boolean;
  isActive?: boolean;
  delay?: number;
  turnTimer?: TurnTimer | null;
}) {
  const isFolded = player.status === "FOLDED" || player.status === "folded";
  const cards = Array.isArray(player.cards) ? player.cards : [];
  const hasRevealedCards = showCards && cards.length > 0;
  
  // Determine avatar status
  const avatarStatus = isFolded ? "folded" : isActive ? "active" : "inactive";
  
  // Determine status badge text
  const statusText = isFolded 
    ? "FOLDED" 
    : player.status === "CALLED" || player.status === "called"
    ? "CALLED"
    : player.status === "RAISED" || player.status === "raised"
    ? "RAISED"
    : isActive
    ? "THINKING"
    : "";

  // Timer: show ring when this opponent is the active player with a running timer
  const isTimerActive = isActive && turnTimer && turnTimer.playerId === player.id;

  // Desktop avatar size: 64px base
  const avatarSize = 64;

  return (
    <motion.div
      className="flex flex-col items-center gap-1"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay || 0 }}
    >
      {/* Status badge above avatar */}
      <div className="h-4">
        {statusText ? (
          <StatusBadge status={statusText} isActive={isActive} />
        ) : null}
      </div>

      {/* Avatar with ring */}
      <div className="relative">
        {/* Hand Strength Ring (optional) */}
        {player.handStrength !== undefined && !isFolded && (
          <HandStrengthRing strength={player.handStrength} size={avatarSize + 16} />
        )}
        
        {/* Timer SVG ring for active opponent */}
        {isTimerActive && turnTimer && (
          <OpponentTimerRing timer={turnTimer} playerId={player.id} size={avatarSize + 12} />
        )}

        <AvatarRing
          name={player.username}
          size={avatarSize}
          status={avatarStatus}
          isDealer={player.isDealer}
          handStrength={player.handStrength}
          seatIndex={player.seatIndex}
        >
          <AvatarPlaceholder name={player.username} size={avatarSize - 8} />
        </AvatarRing>

        {/* SB/BB chips */}
        {isSB ? (
          <div className="absolute -bottom-1 -left-1">
            <SBChip />
          </div>
        ) : null}
        {isBB ? (
          <div className="absolute -bottom-1 -right-1">
            <BBChip />
          </div>
        ) : null}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="font-headline text-[10px] md:text-sm text-[--on-surface] font-medium tracking-tight">
          {player.username}
        </p>
      </div>

      {/* Chip count */}
      <div className="flex items-center gap-1 text-[9px] md:text-xs text-[--tertiary] font-bold">
        <ChipIcon size={9} />
        <span>{player.chips}</span>
      </div>

      {/* Bet amount */}
      {player.bet > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-lg px-2 md:px-4 py-0.5 md:py-1.5 inline-flex items-center">
          <span className="text-[10px] md:text-xs font-headline font-bold text-[--tertiary]">
            {player.bet}
          </span>
        </div>
      ) : null}

      {/* Revealed cards (showdown) */}
      {hasRevealedCards ? (
        <div className="flex gap-1 mt-2">
          {cards.map((card, idx) => (
            <PlayingCard
              key={idx}
              card={card}
              size="xs"
              winning={isWinner ? true : undefined}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// OpponentTimerRing — SVG ring timer for opponent seats
// ═══════════════════════════════════════════════════════════════════════════

const OpponentTimerRing = React.memo(function OpponentTimerRing({
  timer,
  playerId,
  size,
}: {
  timer: TurnTimer;
  playerId: string;
  size: number;
}) {
  const circumference = 2 * Math.PI * (size / 2 - 3);
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [displayTotal, setDisplayTotal] = React.useState<number>(1);
  const [timerPhase, setTimerPhase] = React.useState<"base" | "timebank">("base");

  React.useEffect(() => {
    if (timer.playerId !== playerId) {
      setTimeLeft(0);
      return;
    }
    setDisplayTotal(timer.total);
    setTimerPhase(timer.phase);
    const interval = setInterval(() => {
      const remaining = Math.max(0, timer.expiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [timer, playerId]);

  const progress = displayTotal > 0 ? timeLeft / displayTotal : 0;
  const strokeOffset = circumference * (1 - progress);
  const timerColor =
    timerPhase === "timebank"
      ? progress < 0.2 ? "var(--danger)" : "var(--ring-orange)"
      : progress < 0.2 ? "var(--danger)" : "var(--tertiary)";

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: -(size - 64) / 2,
        left: -(size - 64) / 2,
        width: size,
        height: size,
      }}
    >
      <svg
        className="-rotate-90"
        style={{ width: size, height: size }}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke={timerColor}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          strokeLinecap="round"
          style={{ transition: "stroke 0.2s ease" }}
        />
      </svg>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// HeroTimer — SVG ring for hero turn timer
// ═══════════════════════════════════════════════════════════════════════════

const HERO_CIRCUMFERENCE = 2 * Math.PI * 48;

interface HeroTimerProps {
  timer: TurnTimer;
  playerId: string;
}

const HeroTimer = React.memo(function HeroTimer({ timer, playerId }: HeroTimerProps) {
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [displayTotal, setDisplayTotal] = React.useState<number>(1);
  const [timerPhase, setTimerPhase] = React.useState<"base" | "timebank">("base");

  React.useEffect(() => {
    if (timer.playerId !== playerId) {
      setTimeLeft(0);
      return;
    }
    setDisplayTotal(timer.total);
    setTimerPhase(timer.phase);
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, timer.expiresAt - now);
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [timer, playerId]);

  const progress = displayTotal > 0 ? timeLeft / displayTotal : 0;
  const strokeOffset = HERO_CIRCUMFERENCE * (1 - progress);
  const timeLeftSecs = Math.ceil(timeLeft / 1000);
  const timerColor =
    timerPhase === "timebank"
      ? progress < 0.2
        ? "var(--danger)"
        : "var(--ring-orange)"
      : progress < 0.2
      ? "var(--danger)"
      : "var(--tertiary)";

  return (
    <>
      {/* SVG wrapper div for GPU acceleration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg
          className="absolute -rotate-90"
          style={{ width: 120, height: 120 }}
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={timerColor}
            strokeWidth="3"
            strokeDasharray={HERO_CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            style={{ transition: "stroke 0.2s ease" }}
          />
        </svg>
      </div>
      <div
        className="absolute z-20 text-sm font-bold tabular-nums"
        style={{
          color:
            timerPhase === "timebank" ? "var(--ring-orange)" : "var(--tertiary)",
        }}
        aria-live="polite"
        aria-label={`${timeLeftSecs} seconds remaining`}
      >
        {timeLeftSecs}
      </div>
    </>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Elliptical positioning algorithm for desktop opponent placement
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate elliptical position for opponent in arc layout
 * Distributes players from 210° (left-middle) to -30° (right-middle)
 */
function getPlayerPosition(index: number, total: number): { left: string; top: string } {
  const startAngle = 210; // Slightly below left middle
  const endAngle = -30;   // Slightly below right middle
  const angleRange = startAngle - endAngle;
  const angleStep = total > 1 ? angleRange / (total - 1) : 0;
  
  const angle = startAngle - (index * angleStep);
  const radian = (angle * Math.PI) / 180;
  
  // Ellipse radius - adjust based on player count to prevent crowding
  const rx = total > 5 ? 44 : 42;
  const ry = total > 5 ? 34 : 32;
  
  const x = 50 + rx * Math.cos(radian);
  const y = 54 - ry * Math.sin(radian);
  
  return { left: `${x}%`, top: `${y}%` };
}

/**
 * Calculate dynamic scale based on player count
 * More players = smaller avatars to prevent crowding
 */
function getPlayerScale(total: number): number {
  if (total <= 3) return 1;
  if (total <= 5) return 0.85;
  if (total <= 8) return 0.75;
  return 0.65;
}


export const PlayerPerspectiveView = React.memo(function PlayerPerspectiveView({
  viewState,
  winnerId,
  winnerCards,
  compactMode,
  turnTimer,
}: {
  viewState: PlayerViewState;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
  turnTimer?: TurnTimer | null;
}) {
  const { hero, opponents, board, totalPot, currentRoundAmount, phase, activePlayerId } =
    viewState;
  const isCleanup = phase === "CLEANUP" || phase === "SHOWDOWN";
  const highlightHero =
    winnerId === hero.id && hero.cards.some((c) => winnerCards?.includes(c));
  
  // Calculate dynamic scaling based on opponent count
  const playerScale = getPlayerScale(opponents.length);

  return (
    <div
      data-testid="player-perspective"
      data-phase={phase}
      data-active-player={activePlayerId}
      className="flex flex-col h-full w-full relative overflow-hidden bg-[--bg-base]"
    >
      {/* Table gradient background */}
      <div className="absolute inset-0 table-gradient pointer-events-none z-0" />

      {/* Opponents: elliptical arc on desktop, flexbox row on mobile */}
      {compactMode ? (
        // Mobile: horizontal row
        <section className="flex justify-around items-start px-4 pt-4 z-20">
          {opponents.map((opp, i) => (
            <div key={opp.id} style={{ transform: `scale(${playerScale})` }}>
              <OpponentSeat
                player={opp}
                isWinner={winnerId === opp.id}
                showCards={isCleanup}
                isSB={opp.isSB}
                isBB={opp.isBB}
                isActive={activePlayerId === opp.id}
                delay={i * 0.06}
                turnTimer={turnTimer}
              />
            </div>
          ))}
        </section>
      ) : (
        // Desktop: elliptical arc positioning
        <section className="absolute inset-0 z-20 pointer-events-none">
          {opponents.map((opp, i) => {
            const pos = getPlayerPosition(i, opponents.length);
            return (
              <div
                key={opp.id}
                className="absolute pointer-events-auto"
                style={{
                  left: pos.left,
                  top: pos.top,
                  transform: `translate(-50%, -50%) scale(${playerScale})`,
                  transition: 'all 0.5s ease-out',
                }}
              >
                <OpponentSeat
                  player={opp}
                  isWinner={winnerId === opp.id}
                  showCards={isCleanup}
                  isSB={opp.isSB}
                  isBB={opp.isBB}
                  isActive={activePlayerId === opp.id}
                  delay={i * 0.06}
                  turnTimer={turnTimer}
                />
              </div>
            );
          })}
        </section>
      )}

      {/* Center: pot + community cards */}
      <section className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 z-[25]">
        {/* Pot display */}
        <div className="flex flex-col items-center gap-2">
          <PotDisplay amount={totalPot} compact={compactMode} />
          
          {/* Current round amount */}
          {currentRoundAmount > 0 ? (
            <div data-testid="current-round-indicator" className="inline-flex items-center gap-2 rounded-full bg-black/45 border border-[--tertiary]/24 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                Round
              </span>
              <ChipAmount
                amount={currentRoundAmount}
                iconSize={11}
                iconColor="var(--tertiary)"
                amountStyle={{
                  color: "var(--tertiary)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Community cards with staggered deal animations */}
        <div data-testid="board-cards" className="flex gap-1.5 md:gap-4">
          {board.map((card, i) => (
            <div key={i} data-testid={`board-card-${i}`} data-revealed={card ? "true" : "false"}>
              {card ? (
                <PlayingCard 
                  card={card} 
                  size={compactMode ? "sm" : "lg"}
                  dealDelay={i * 100} 
                />
              ) : (
                <div className="card-placeholder w-14 h-20 md:w-[96px] md:h-[132px]" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Hero hand: floating above action bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none overflow-visible">
        {turnTimer && turnTimer.playerId === hero.id ? (
          <HeroTimer timer={turnTimer} playerId={hero.id} />
        ) : null}
        
        {hero.cards && hero.cards.length > 0 ? (
          <HeroHand cards={hero.cards} size="sm" />
        ) : null}
      </div>

      {/* Hero info below cards */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1">
        <span className="text-[--text-primary] font-semibold font-body text-xs md:text-sm">
          {hero.username}
        </span>
        <ChipAmount
          amount={hero.chips}
          iconSize={11}
          amountStyle={{
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 700,
          }}
        />
      </div>

      {/* Hand Analysis Widget (top-right, desktop only) */}
      {!compactMode && (hero.handStrength !== undefined || hero.handType !== undefined) && (
        <div className="absolute top-24 right-8 z-[25]">
          <HandAnalysisWidget
            handType={hero.handType}
            handStrength={hero.handStrength}
          />
        </div>
      )}
    </div>
  );
});

export default PlayerPerspectiveView;
