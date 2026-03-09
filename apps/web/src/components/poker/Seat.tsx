"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";

function ChipIcon({ size = 12, color = "rgba(255,255,255,0.5)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1" />
      <circle cx="10" cy="10" r="2.5" fill={color} />
    </svg>
  );
}

function mapStatusToBadge(status: string): string | null {
  const s = (status || "").toLowerCase();
  if (s === "folded") return "badge-folded";
  if (s === "called" || s === "call") return "badge-called";
  if (s === "raised" || s === "raise") return "badge-raised";
  if (s === "checked" || s === "check") return "badge-checked";
  return null;
}

export interface PlayerData {
    id: string;
    username: string;
    chips: number;
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
    onSeatClick: (index: number) => void;
    timer?: TurnTimer | null;
    centerOffset?: { x: number, y: number };
}

const CIRCUMFERENCE = 2 * Math.PI * 34; // r=34

export function Seat({ player, seatIndex, isDealer, isActive, isSelf, onSeatClick, timer, centerOffset = { x: 0, y: 0 } }: SeatProps) {
    const [timeLeft, setTimeLeft] = React.useState<number>(0);
    const [displayTotal, setDisplayTotal] = React.useState<number>(1);
    const [timerPhase, setTimerPhase] = React.useState<'base' | 'timebank'>('base');
    const [timeBankLeft, setTimeBankLeft] = React.useState<number>(0);

    React.useEffect(() => {
        const isMyTimer = isActive && timer && timer.playerId === player?.id;

        if (!isMyTimer) {
            setTimeLeft(0);
            return;
        }

        setDisplayTotal(timer.total);
        setTimerPhase(timer.phase);
        setTimeBankLeft(timer.timeBankMs);

        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, timer.expiresAt - now);
            setTimeLeft(remaining);
            if (remaining === 0) clearInterval(interval);
        }, 50);

        return () => clearInterval(interval);
    }, [isActive, timer, player?.id]);

    const progress = displayTotal > 0 ? timeLeft / displayTotal : 0;
    const strokeOffset = CIRCUMFERENCE * (1 - progress);

    // Color: green for base time, orange for time bank, red when < 20%
    const timerColor =
        timerPhase === 'timebank'
            ? progress < 0.2 ? '#ef4444' : '#f97316'  // orange → red
            : progress < 0.2 ? '#ef4444' : '#22c55e';  // green → red

    const isTimerActive = isActive && timer?.playerId === player?.id && timeLeft > 0;
    const timeLeftSecs = Math.ceil(timeLeft / 1000);

    if (!player) {
        return (
            <button
                onClick={() => onSeatClick(seatIndex)}
                className="flex flex-col items-center justify-center w-16 h-16 transition-all duration-300 border-2 border-dashed rounded-full group bg-black/20 border-white/20 hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/10"
            >
                <div className="text-2xl text-white/20 group-hover:text-[#a78bfa]/70">+</div>
            </button>
        );
    }

    const isPending = player.status === 'PENDING';
    const statusBadge = mapStatusToBadge(player.status);
    const showStatusBadge = statusBadge && !isPending;
    const isFolded = (player.status || "").toLowerCase() === "folded";

    return (
        <div className={`flex flex-col items-center gap-2 group ${isPending ? 'opacity-70 animate-pulse' : ''}`} style={{ animation: 'fadeInSeat 0.4s ease forwards' }}>
            {showStatusBadge && (
                <div className={`${statusBadge} text-[10px] font-bold px-2.5 py-1 rounded-full mb-0.5 uppercase tracking-wider`}>
                    {player.status}
                </div>
            )}
            <AnimatePresence>
                {player.bet && player.bet > 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, y: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -24 }}
                        exit={{ opacity: 0, scale: 0, x: centerOffset.x, y: centerOffset.y }}
                        className="chip-badge text-[10px] px-2 py-0.5"
                    >
                        <ChipIcon size={10} color="#a78bfa" />
                        <span>${player.bet}</span>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* Avatar circle with optional overlapping face-down card (opponents) */}
            <div className="relative inline-block" style={{ minWidth: 72 }}>
            <div className={`w-16 h-16 rounded-full bg-surface border-4 flex items-center justify-center text-xl font-black shadow-2xl transition-all duration-300 relative
                ${isActive ? 'border-accent-1 scale-110 ring-4 ring-accent-1/20 active-seat-pulse' : isPending ? 'border-accent-2/50 scale-95' : isFolded ? 'border-red-500/40 opacity-75' : 'border-white/10 group-hover:border-white/20'}`}
            >
                {/* SVG progress ring */}
                {isTimerActive && (
                    <svg
                        className="absolute -inset-1.5 w-[72px] h-[72px] -rotate-90 pointer-events-none"
                        viewBox="0 0 72 72"
                    >
                        {/* Background track */}
                        <circle
                            cx="36" cy="36" r="34"
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="3"
                        />
                        {/* Animated progress arc */}
                        <circle
                            cx="36" cy="36" r="34"
                            fill="none"
                            stroke={timerColor}
                            strokeWidth="3"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={strokeOffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.3s ease' }}
                        />
                    </svg>
                )}

                {/* Avatar letter */}
                {player.username?.[0]?.toUpperCase()}

                {/* Countdown seconds badge */}
                {isTimerActive && (
                    <div
                        className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[9px] font-black border shadow-lg z-10"
                        style={{
                            background: timerPhase === 'timebank' ? 'rgba(249,115,22,0.9)' : 'rgba(34,197,94,0.9)',
                            borderColor: timerColor,
                            color: '#fff'
                        }}
                    >
                        {timeLeftSecs}
                    </div>
                )}

                {/* Time bank indicator dot (shown when in time bank phase) */}
                {isTimerActive && timerPhase === 'timebank' && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-orange-400 whitespace-nowrap bg-black/70 px-1 rounded border border-orange-400/30">
                        TIME BANK
                    </div>
                )}

                {/* Dealer button */}
                {isDealer && !isPending && (
                    <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white text-black text-[10px] flex items-center justify-center font-bold border-2 border-surface shadow-md">
                        D
                    </div>
                )}

                {/* Pending indicator */}
                {isPending && (
                    <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-accent-2 text-white text-[8px] flex items-center justify-center font-bold border-2 border-surface shadow-md">
                        ...
                    </div>
                )}

                {/* Hole cards — revealed (showdown) or overlapping face-down (opponents in hand) */}
                <AnimatePresence>
                    {player.cards && player.cards.length === 2 && !isPending && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0, x: centerOffset.x, y: centerOffset.y, rotate: 0 }}
                            animate={{ opacity: 1, scale: 1, x: -32, y: -8, rotate: -15 }}
                            exit={{ opacity: 0, scale: 0, x: centerOffset.x, y: centerOffset.y }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="absolute flex -space-x-4"
                        >
                            <PlayingCard card={player.cards[0]} size="xs" />
                            <PlayingCard card={player.cards[1]} size="xs" />
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Overlapping face-down card for opponents when in hand (cards not yet revealed) */}
                {!isSelf && !isPending && player.cards?.length !== 2 && (
                    <div
                        className="absolute left-[38px] top-[4px] z-[4] card-back-solid"
                        style={{ width: 34, height: 47, borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.55)' }}
                    >
                        <div className="absolute inset-1 rounded border border-white/6" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)' }} />
                    </div>
                )}
            </div>
            </div>

            {/* Name & chip label */}
            <div className="flex flex-col items-center gap-0.5 z-10">
                <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all
                    ${isActive ? 'bg-accent-1 border-accent-1 text-white shadow-lg shadow-accent-1/30'
                    : isPending ? 'bg-accent-2/20 border-accent-2/30 text-accent-2'
                    : 'bg-black/80 border-white/10 text-white/80'}`}
                >
                    {player.username} {isSelf && "(You)"} {isPending && "(WAITING)"}
                </div>

                {/* Chip stack — Moon Poker style with ChipIcon */}
                <div className="flex items-center gap-1.5">
                    <ChipIcon size={11} color="rgba(255,255,255,0.5)" />
                    <span className="text-[11px] font-semibold text-white/70">{player.chips}</span>
                </div>

                {/* Time bank remaining bar (shown for active player when timer is visible) */}
                {isTimerActive && timer && timer.timeBankMs > 0 && (
                    <div className="w-16 mt-0.5">
                        <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[7px] text-white/30 uppercase tracking-wider">Bank</span>
                            <span className="text-[7px] font-mono text-orange-400">
                                {timerPhase === 'timebank' ? `${timeLeftSecs}s` : `${Math.round(timer.timeBankMs / 1000)}s`}
                            </span>
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-100"
                                style={{
                                    width: timerPhase === 'timebank'
                                        ? `${(timeLeft / timer.timeBankMs) * 100}%`
                                        : '100%',
                                    background: timerPhase === 'timebank' ? '#f97316' : '#f97316',
                                    opacity: timerPhase === 'timebank' ? 1 : 0.4
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
