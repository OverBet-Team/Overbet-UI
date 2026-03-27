'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import AvatarRing from "./AvatarRing";
import StatusBadge from "./StatusBadge";
import PlayingCard from "./PlayingCard";
import { ChipAmount } from "./ChipAmount";

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

const CIRCUMFERENCE = 2 * Math.PI * 42;

// ═══════════════════════════════════════════════════════════════════════════
// SeatTimer — Extracted to isolate 50ms re-renders
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

  const timerColor = timerPhase === 'timebank' ? 'var(--ring-orange)' : 'var(--tertiary)';

  return (
    <div className="absolute -inset-2 pointer-events-none z-10">
      <svg className="-rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="3"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={timerColor}
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: strokeOffset }}
          transition={{ duration: 0.05, ease: "linear" }}
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(129,236,255,0.4)]"
        />
      </svg>
      
      {/* Countdown Badge */}
      <div className={cn(
        "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-black shadow-xl",
        timerPhase === 'timebank' ? "bg-[--ring-orange] text-black" : "bg-[--tertiary] text-black"
      )}>
        {timeLeftSecs}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// PositionBadge — SB/BB indicator
// ═══════════════════════════════════════════════════════════════════════════

const PositionBadge = React.memo(function PositionBadge({ type }: { type: 'SB' | 'BB' }) {
  return (
    <div className={cn(
      "absolute -left-1 -bottom-1 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-black shadow-xl z-20",
      type === 'SB' ? 'bg-[--accent] text-white' : 'bg-[--gold] text-black',
    )}>
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
  if (!player) {
    return (
      <button
        onClick={() => onSeatClick(seatIndex)}
        className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center text-white/20 font-black text-2xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
      >
        <span className="group-hover:scale-125 transition-transform duration-300">+</span>
      </button>
    );
  }

  const isFolded = player.status === 'FOLDED';
  const isThinking = isActive && timer?.playerId === player.id;
  const status = isFolded ? 'folded' : isThinking ? 'thinking' : isActive ? 'active' : 'inactive';

  return (
    <div className={cn(
      "flex flex-col items-center gap-3 transition-opacity duration-500",
      isFolded ? "opacity-40" : "opacity-100"
    )}>
      {/* Bet Amount */}
      <AnimatePresence>
        {player.bet && player.bet > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: centerOffset.y * 0.5, x: centerOffset.x * 0.5, scale: 0 }}
            className="absolute -top-10 z-20"
          >
            <div className="glass-panel px-3 py-1 flex items-center gap-1.5 border-[--danger]/30">
              <ChipAmount amount={player.bet} iconSize={12} iconColor="var(--danger)" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {/* Avatar and Ring */}
        <AvatarRing 
          name={player.username} 
          status={status} 
          isDealer={isDealer} 
          seatIndex={seatIndex}
          size={80}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center relative overflow-hidden">
            <span className="text-2xl font-black font-headline text-white/80">
              {player.username[0].toUpperCase()}
            </span>
            {isSelf && (
              <div className="absolute inset-0 bg-[--accent]/5 pointer-events-none" />
            )}
          </div>
        </AvatarRing>

        {/* Timer Ring */}
        {isThinking && timer && (
          <SeatTimer timer={timer} playerId={player.id} />
        )}

        {/* SB/BB Badges */}
        {!isDealer && isSB && <PositionBadge type="SB" />}
        {!isDealer && isBB && <PositionBadge type="BB" />}

        {/* Hole Cards (Opponents) */}
        {!isSelf && player.cards && player.cards.length === 2 && !isFolded && (
          <div className="absolute -right-10 top-0 flex -space-x-6 rotate-12 z-10 pointer-events-none">
            <PlayingCard faceDown size="xs" className="shadow-xl" />
            <PlayingCard faceDown size="xs" className="shadow-xl" />
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-black font-headline tracking-widest uppercase",
            isActive ? "text-[--accent]" : "text-white/60"
          )}>
            {player.username}
          </span>
          {isSelf && <span className="text-[8px] font-black bg-[--accent]/20 text-[--accent] px-1 rounded">YOU</span>}
        </div>

        <div className="glass-panel px-2 py-0.5 min-w-[60px] flex justify-center border-white/5">
          <ChipAmount 
            amount={player.chips} 
            iconSize={10} 
            iconColor="var(--tertiary)" 
            amountStyle={{ fontSize: '10px', fontWeight: '900', color: 'var(--tertiary)' }}
          />
        </div>

        {/* Status Badge */}
        <div className="mt-1">
          <StatusBadge status={player.status} />
        </div>
      </div>
    </div>
  );
});

