'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayingCard from './PlayingCard';
import { ChipAmount } from './ChipAmount';

export interface PlayerData {
  id: string;
  username: string;
  chips: number;
  /** Uppercase status: ACTIVE, FOLDED, etc. */
  status: string;
  seatIndex: number;
  cards?: string[];
  bet?: number;
}

export interface TurnTimer {
  playerId: string;
  expiresAt: number;
  total: number;
  phase: 'base' | 'timebank';
  timeBankMs: number;
}

interface SeatProps {
  player: PlayerData | undefined;
  seatIndex: number;
  isDealer: boolean;
  isActive: boolean;
  isSelf: boolean;
  isSB: boolean;
  isBB: boolean;
  onSeatClick: (index: number) => void;
  timer?: TurnTimer | null;
  centerOffset?: { x: number; y: number };
}

const CIRCUMFERENCE = 2 * Math.PI * 34; // r=34

// ═══════════════════════════════════════════════════════════════════════════
// SeatTimer — Extracted to isolate 50ms re-renders (Vercel rule: use-ref-transient-values)
// ═══════════════════════════════════════════════════════════════════════════

interface SeatTimerProps {
  timer: TurnTimer;
  playerId: string;
}

const SeatTimer = React.memo(function SeatTimer({ timer, playerId }: SeatTimerProps) {
  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [displayTotal, setDisplayTotal] = React.useState<number>(1);
  const [timerPhase, setTimerPhase] = React.useState<'base' | 'timebank'>('base');

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
  const strokeOffset = CIRCUMFERENCE * (1 - progress);
  const timeLeftSecs = Math.ceil(timeLeft / 1000);

  const timerColor =
    timerPhase === 'timebank'
      ? progress < 0.2
        ? '#ef4444'
        : '#f97316'
      : progress < 0.2
        ? '#ef4444'
        : '#22c55e';

  return (
    <>
      {/* SVG wrapper div for GPU acceleration (Vercel rule: animate-svg-wrapper) */}
      <div className="absolute -top-[6px] -left-[6px] w-[76px] h-[76px] pointer-events-none">
        <svg
          className="-rotate-90"
          style={{ width: 76, height: 76 }}
          viewBox="0 0 76 76"
        >
          <circle
            cx="38"
            cy="38"
            r="34"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <circle
            cx="38"
            cy="38"
            r="34"
            fill="none"
            stroke={timerColor}
            strokeWidth="3"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-[50ms] linear transition-[stroke] duration-300 ease"
          />
        </svg>
      </div>

      {/* Countdown badge */}
      <div
        className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[9px] font-black text-white z-10 shadow-md"
        style={{
          border: `1px solid ${timerColor}`,
          background: timerPhase === 'timebank' ? 'rgba(249,115,22,0.9)' : 'rgba(34,197,94,0.9)',
        }}
      >
        {timeLeftSecs}
      </div>

      {/* TIME BANK label */}
      {timerPhase === 'timebank' && (
        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-orange-400 whitespace-nowrap bg-black/75 px-1 py-px rounded border border-orange-500/30">
          TIME BANK
        </div>
      )}

      {/* Time bank bar */}
      {timer.timeBankMs > 0 && (
        <div className="w-16 mt-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[7px] text-white/30 uppercase tracking-wider">Bank</span>
            <span className="text-[7px] font-mono text-orange-400">
              {timerPhase === 'timebank'
                ? `${timeLeftSecs}s`
                : `${Math.round(timer.timeBankMs / 1000)}s`}
            </span>
          </div>
          <div className="h-[3px] w-full bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-[width] duration-100 linear"
              style={{
                width: timerPhase === 'timebank' ? `${(timeLeft / timer.timeBankMs) * 100}%` : '100%',
                opacity: timerPhase === 'timebank' ? 1 : 0.35,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Seat Component
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PositionBadge — SB/BB indicator, hoisted to avoid re-definition on each render
// ═══════════════════════════════════════════════════════════════════════════

const PositionBadge = React.memo(function PositionBadge({ type }: { type: 'SB' | 'BB' }) {
  // SB: blue accent bg; BB: gold bg black text
  return (
    <div className={[
      "absolute -right-1 -bottom-1 w-[22px] h-[22px] rounded-full text-[9px] font-black flex items-center justify-center border-2 border-black shadow-md z-10",
      type === 'SB' ? 'bg-[--accent] text-white' : 'bg-[--gold] text-black',
    ].join(' ')}>
      {type}
    </div>
  );
});

export const Seat = React.memo(function Seat({
  player,
  seatIndex,
  isDealer,
  isActive,
  isSelf,
  isSB,
  isBB,
  onSeatClick,
  timer,
  centerOffset = { x: 0, y: 0 },
}: SeatProps) {
  const emptySeatSize = 'clamp(44px, 5.5vw, 56px)';

  // ── Empty seat ──────────────────────────────────────────────────────────
  if (!player) {
    return (
      <button
        data-testid={`seat-empty-${seatIndex}`}
        onClick={() => onSeatClick(seatIndex)}
        className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] rounded-full border-2 border-dashed border-white/[0.18] bg-black/25 cursor-pointer transition-all duration-200 text-white/20 font-bold hover:border-[--accent] hover:bg-[--accent]/10 hover:text-[--accent]"
        style={{
          width: emptySeatSize,
          height: emptySeatSize,
          fontSize: 'clamp(18px, 2.2vw, 22px)',
        }}
      >
        +
      </button>
    );
  }

  const isPending = player.status === 'PENDING';
  const isFolded = player.status === 'FOLDED';
  const isTimerActive = isActive && timer && timer.playerId === player.id;

  // Determine if we show face-up cards (self) or face-down (opponent)
  const hasFaceUpCards = isSelf && player.cards && player.cards.length === 2;
  const hasFaceDownCards = !isSelf && player.cards && player.cards.length === 2;

  return (
    <div
      data-testid={`seat-player-${seatIndex}`}
      className={[
        'flex flex-col items-center gap-1.5',
        isPending ? 'opacity-70 animate-pulse' : isFolded ? 'opacity-50' : 'opacity-100',
      ].join(' ')}
    >
      {/* Bet chip — floats above avatar */}
      <AnimatePresence>
        {player.bet && player.bet > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -4 }}
            exit={{ opacity: 0, scale: 0, x: centerOffset.x, y: centerOffset.y }}
            className="absolute -top-7 bg-black/70 border border-[--danger]/35 rounded-full px-2.5 py-0.5 text-[--danger] font-bold text-[11px] backdrop-blur-md whitespace-nowrap z-20 shadow-lg font-body"
          >
            <span className="inline-flex items-center gap-1">
              <span>Bet</span>
              <ChipAmount amount={player.bet} iconSize={11} iconColor="#f87171" amountStyle={{ color: 'inherit' }} />
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Avatar circle with timer components */}
      <div className="relative w-16 h-16">
        {/* Active glow ring */}
        {isActive && (
          <div className="absolute -inset-1 rounded-full border-2 border-[--accent]/60 shadow-[0_0_16px_rgba(59,130,246,0.35)] animate-pulse" />
        )}

        {/* Timer ring and countdown (extracted to SeatTimer) */}
        {isTimerActive && timer && <SeatTimer timer={timer} playerId={player.id} />}

        {/* Avatar body */}
        <div
          className="w-16 h-16 rounded-full border-3 flex items-center justify-center text-[22px] font-extrabold font-display shadow-lg transition-all duration-[250ms] relative"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
              : 'linear-gradient(135deg, #1f2937, #111827)',
            borderColor: isActive
              ? 'rgba(59,130,246,0.7)'
              : isPending
                ? 'rgba(99,102,241,0.4)'
                : isFolded
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(255,255,255,0.1)',
            color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.7)',
            boxShadow: isActive ? '0 4px 20px rgba(59,130,246,0.4)' : '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {player.username?.[0]?.toUpperCase()}

          {/* Dealer button */}
          {isDealer && !isPending && (
            <div className="absolute -right-1 -bottom-1 w-[22px] h-[22px] rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center border-2 border-black shadow-md z-10">
              D
            </div>
          )}

          {/* SB/BB position badges — only when not dealer and not pending */}
          {!isDealer && !isPending && isSB && <PositionBadge type="SB" />}
          {!isDealer && !isPending && !isSB && isBB && <PositionBadge type="BB" />}

          {/* Pending indicator */}
          {isPending && (
            <div className="absolute -right-1 -bottom-1 w-[22px] h-[22px] rounded-full bg-indigo-500/90 text-white text-[8px] font-bold flex items-center justify-center border-2 border-white/20 shadow-md z-10">
              ···
            </div>
          )}
        </div>

        {/* Hole cards — anchored to avatar */}
        <AnimatePresence>
          {(hasFaceUpCards || hasFaceDownCards) && !isPending && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0,
                x: centerOffset.x * 0.3,
                y: centerOffset.y * 0.3,
              }}
              animate={{ opacity: 1, scale: 1, x: -36, y: -10 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="absolute top-0 left-0 flex"
              style={{ gap: -8 }}
            >
              {hasFaceUpCards ? (
                // Self — show face-up cards
                <>
                  <PlayingCard card={player.cards![0]} size="xs" rotate={-8} style={{ zIndex: 2 }} />
                  <PlayingCard card={player.cards![1]} size="xs" rotate={-3} style={{ marginLeft: -10, zIndex: 1 }} />
                </>
              ) : (
                // Opponent — face-down
                <>
                  <PlayingCard faceDown size="xs" rotate={-8} style={{ zIndex: 2 }} />
                  <PlayingCard faceDown size="xs" rotate={-3} style={{ marginLeft: -10, zIndex: 1 }} />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name + chip label */}
      <div className="flex flex-col items-center gap-0.5 z-10">
        <div
          className="px-2.5 py-[3px] rounded-full backdrop-blur-md text-[10px] font-bold uppercase tracking-wider font-body whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis"
          style={{
            border: isActive
              ? '1px solid rgba(59,130,246,0.6)'
              : isPending
                ? '1px solid rgba(99,102,241,0.35)'
                : isFolded
                  ? '1px solid rgba(239,68,68,0.25)'
                  : '1px solid rgba(255,255,255,0.1)',
            background: isActive
              ? 'rgba(59,130,246,0.25)'
              : isPending
                ? 'rgba(99,102,241,0.12)'
                : 'rgba(0,0,0,0.6)',
            color: isActive ? '#c4b5fd' : isPending ? '#a5b4fc' : 'rgba(255,255,255,0.8)',
            boxShadow: isActive ? '0 2px 12px rgba(59,130,246,0.3)' : undefined,
          }}
        >
          {player.username}
          {isSelf && ' (You)'}
          {isPending && ' (WAITING)'}
          {isFolded && ' (FOLDED)'}
        </div>

        {/* Chip count */}
        <div className="px-2 py-0.5 rounded-md border border-indigo-500/20 bg-indigo-500/[0.08] text-[10px] font-bold font-mono text-indigo-300">
          <ChipAmount
            amount={player.chips}
            iconSize={10}
            iconColor="#a5b4fc"
            amountStyle={{ color: 'inherit', fontFamily: 'monospace' }}
          />
        </div>
      </div>
    </div>
  );
});

