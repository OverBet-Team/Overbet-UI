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
  sbPlayerId?: string;
  bbPlayerId?: string;
  userId: string;
  board: (string | null)[];
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
  <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[32px] font-headline font-bold tracking-[0.5em] text-white/[0.03] uppercase select-none pointer-events-none">
    OVERBET
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// PokerTable Component
// ═══════════════════════════════════════════════════════════════════════════

export function PokerTable({
  players,
  dealerId,
  activePlayerId,
  sbPlayerId,
  bbPlayerId,
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
  const boardGap = boardHasCards ? 12 : 8;

  return (
    <div className="w-full flex justify-center py-12">
      <div className="relative w-full max-w-6xl" style={{ aspectRatio: '2.2 / 1' }}>
        {/* Table Outer Shadow */}
        <div className="absolute inset-[-20px] rounded-[240px] bg-black/40 blur-3xl pointer-events-none" />

        {/* Table Rail (The "Bumper") */}
        <div className="absolute inset-0 rounded-[220px] border-[12px] border-[#1A1A1A] bg-[#0D0D0D] shadow-[inset_0_0_20px_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.8)]" />

        {/* Table Felt Surface */}
        <div className="absolute inset-[12px] rounded-[208px] table-gradient overflow-hidden">
          {/* Felt Texture Overlay */}
          <div className="absolute inset-0 felt-texture opacity-20 mix-blend-overlay pointer-events-none" />
          
          {/* Inner Glow */}
          <div className="absolute inset-0 bg-radial-gradient(circle_at_center,rgba(129,236,255,0.05)_0%,transparent_70%) pointer-events-none" />
          
          {/* Technical Grid or Accent Lines */}
          <div className="absolute inset-[20px] rounded-[188px] border border-white/[0.03] pointer-events-none" />
        </div>

        {/* Content layer (cards, pots, watermark) */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Static watermark */}
          {OVERBET_WATERMARK}

          {/* Community cards */}
          <div
            className="absolute flex items-center"
            style={{
              top: '48%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              gap: boardGap,
            }}
          >
            <AnimatePresence mode="popLayout">
              {communitySlots.map((card, i) =>
                card ? (
                  <motion.div
                    key={`${card}-${i}`}
                    initial={{ opacity: 0, scale: 0.5, y: -20, rotateY: 90 }}
                    animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 260, 
                      damping: 20,
                      delay: i * 0.1 
                    }}
                  >
                    <PlayingCard card={card} size={boardCardSize} />
                  </motion.div>
                ) : (
                  <div key={`empty-${i}`} className="opacity-20">
                    <PlayingCard dashed size={boardCardSize} />
                  </div>
                ),
              )}
            </AnimatePresence>
          </div>

          {/* Pot display */}
          <div
            className="absolute flex flex-col items-center gap-2"
            style={{
              top: '68%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <AnimatePresence>
              {pots && pots.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3"
                >
                  {pots.map((pot, i) => (
                    <div 
                      key={`${pot.type}-${i}`}
                      className="glass-panel px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2"
                    >
                      <span className="text-[10px] font-headline font-bold tracking-widest text-white/40 uppercase">
                        {pot.type === 'MAIN' ? 'MAIN POT' : 'SIDE POT'}
                      </span>
                      <span className="text-sm font-bold text-[--color-tertiary] font-mono">
                        {pot.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
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
                isSB={tableSeats[i]?.id === (sbPlayerId ?? "")}
                isBB={tableSeats[i]?.id === (bbPlayerId ?? "")}
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
