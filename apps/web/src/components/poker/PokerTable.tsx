/**
 * PokerTable - 10-seat oval layout with visual refactor
 *
 * Seat positions are distributed around an ellipse using CSS absolute
 * positioning. Seats 0-9 are placed clockwise starting from the bottom-center
 * (the "hero" seat convention).
 *
 * Board cards use the PlayingCard component with proper suit symbols.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Seat, PlayerData, TurnTimer } from './Seat';
import PlayingCard from './PlayingCard';
import { ChipAmount } from './ChipAmount';

interface PokerTableProps {
  players: (PlayerData | undefined)[];
  dealerId: string;
  activePlayerId: string;
  userId: string;
  board: string[];
  pots: { amount: number; type: string }[];
  handleSeatClick: (seatIndex: number) => void;
  turnTimer?: TurnTimer | null;
}

type TablePosition = { top: string; left: string };

const LOBBY_SEAT_ANGLES = [90, 54, 18, -18, -54, -90, -126, -162, 162, 126];

function ellipsePosition(angleDeg: number, radiusX: number, radiusY: number): TablePosition {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    top: `${50 + Math.sin(radians) * radiusY}%`,
    left: `${50 + Math.cos(radians) * radiusX}%`,
  };
}

// Occupied seats sit closer to the rail because their footprint is larger.
const PLAYER_SEAT_POSITIONS: TablePosition[] = LOBBY_SEAT_ANGLES.map((angle) => ellipsePosition(angle, 43, 41.5));

// Empty-seat request markers sit slightly inward while following the exact same
// balanced oval geometry as occupied seats.
const EMPTY_SEAT_POSITIONS: TablePosition[] = LOBBY_SEAT_ANGLES.map((angle) => ellipsePosition(angle, 38.5, 36.5));

// Approximate offset from seat toward table center for card deal animation
const CENTER_OFFSETS: { x: number; y: number }[] = [
  { x: 0, y: -160 },
  { x: -120, y: -120 },
  { x: -160, y: 0 },
  { x: -120, y: 120 },
  { x: -60, y: 160 },
  { x: 60, y: 160 },
  { x: 120, y: 120 },
  { x: 160, y: 0 },
  { x: 120, y: -120 },
  { x: 80, y: -160 },
];

const MAX_SEATS = 10;

// ═══════════════════════════════════════════════════════════════════════════
// Hoist static watermark (Vercel rule: rendering-hoist-jsx)
// ═══════════════════════════════════════════════════════════════════════════

const OVERBET_WATERMARK = (
  <div className="absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] font-extrabold tracking-[0.25em] text-white/[0.04] uppercase font-display select-none">
    OverBet
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// PokerTable Component
// ═══════════════════════════════════════════════════════════════════════════

export function PokerTable({
  players,
  dealerId,
  activePlayerId,
  userId,
  board,
  pots,
  handleSeatClick,
  turnTimer,
}: PokerTableProps) {
  const tableSeats = Array.from({ length: MAX_SEATS }).map((_, i) => players.find((p) => p?.seatIndex === i));

  const communitySlots = Array.from({ length: 5 }).map((_, i) => board[i] ?? null);
  const boardHasCards = communitySlots.some(Boolean);
  const boardCardSize = boardHasCards ? 'md' : 'sm';
  const boardGap = boardHasCards ? 8 : 6;

  return (
    <div className="w-full flex justify-center">
      <div className="relative w-full max-w-5xl" style={{ aspectRatio: '2.1 / 1', margin: '28px auto 20px' }}>
        {/* Outer shadow/border */}
        <div
          className="absolute inset-0 rounded-[200px]"
          style={{
            background: 'transparent',
            boxShadow: '0 30px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        />

        {/* Table rail (border) with new table-rail color */}
        <div
          className="absolute inset-0 rounded-[200px] table-rail"
          style={{
            background: 'linear-gradient(180deg, var(--table-rail) 0%, #14202e 100%)',
            border: '10px solid var(--table-rail)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        />

        {/* Table felt surface with new table-felt gradient */}
        <div
          className="absolute rounded-[180px] table-felt"
          style={{
            inset: '10px',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
          }}
        />

        {/* Inner felt border accent */}
        <div
          className="absolute rounded-[175px] pointer-events-none"
          style={{
            inset: '14px',
            border: '1px solid rgba(59,130,246,0.15)',
          }}
        />

        {/* Felt glow effect */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '50%',
            height: '35%',
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.2) 0%, transparent 70%)',
            filter: 'blur(24px)',
          }}
        />

        {/* Content layer (cards, pots, watermark) */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {/* Static watermark (hoisted) */}
          {OVERBET_WATERMARK}

          {/* Community cards */}
          <div
            className="absolute flex items-center"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              gap: boardGap,
            }}
          >
            <AnimatePresence>
              {communitySlots.map((card, i) =>
                card ? (
                  <motion.div
                    key={`${card}-${i}`}
                    data-testid={`community-slot-${i}`}
                    initial={{ opacity: 0, y: -16, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
                  >
                    <PlayingCard card={card} size={boardCardSize} />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`empty-${i}`}
                    data-testid={`community-slot-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <PlayingCard dashed size={boardCardSize} />
                  </motion.div>
                ),
              )}
            </AnimatePresence>
          </div>

          {/* Pot display */}
          <div
            className="absolute flex items-center gap-2"
            style={{
              top: boardHasCards ? '68%' : '70%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <AnimatePresence>
              {pots &&
                pots.map((pot, i) => (
                  <motion.div
                    key={`${pot.type}-${i}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="px-3.5 py-1 rounded-full backdrop-blur-md font-bold text-[13px] font-body tracking-tight shadow-lg"
                    style={{
                      border:
                        pot.type === 'MAIN' ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(99,102,241,0.35)',
                      background: 'rgba(0,0,0,0.55)',
                      color: pot.type === 'MAIN' ? '#f87171' : '#a5b4fc',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span>{pot.type === 'MAIN' ? 'POT' : 'SIDE'}:</span>
                      <ChipAmount
                        amount={pot.amount}
                        iconSize={12}
                        iconColor={pot.type === 'MAIN' ? '#f87171' : '#a5b4fc'}
                        amountStyle={{ color: 'inherit' }}
                      />
                    </span>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Seats around the table */}
        {PLAYER_SEAT_POSITIONS.map((playerPos, i) => {
          const seatPosition = tableSeats[i] ? playerPos : EMPTY_SEAT_POSITIONS[i];

          return (
            <div
              key={i}
              className="absolute z-10"
              style={{
                top: seatPosition.top,
                left: seatPosition.left,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Seat
                player={tableSeats[i]}
                seatIndex={i}
                isDealer={tableSeats[i]?.id === dealerId}
                isActive={tableSeats[i]?.id === activePlayerId}
                isSelf={tableSeats[i]?.id === userId}
                onSeatClick={handleSeatClick}
                timer={turnTimer}
                centerOffset={CENTER_OFFSETS[i]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
