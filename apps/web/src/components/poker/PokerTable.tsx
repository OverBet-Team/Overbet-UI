/**
 * PokerTable - 10-seat oval layout with Moon Poker visual language
 *
 * Seat positions are distributed around an ellipse using CSS absolute
 * positioning. Seats 0-9 are placed clockwise starting from the bottom-center
 * (the "hero" seat convention used by PokerNow / Moon Poker).
 *
 * Board cards use the PlayingCard component with proper suit symbols.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seat, PlayerData, TurnTimer } from "./Seat";
import PlayingCard from "./PlayingCard";
import { ChipAmount } from "./ChipAmount";

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
const PLAYER_SEAT_POSITIONS: TablePosition[] = LOBBY_SEAT_ANGLES.map((angle) =>
  ellipsePosition(angle, 43, 41.5),
);

// Empty-seat request markers sit slightly inward while following the exact same
// balanced oval geometry as occupied seats.
const EMPTY_SEAT_POSITIONS: TablePosition[] = LOBBY_SEAT_ANGLES.map((angle) =>
  ellipsePosition(angle, 38.5, 36.5),
);

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
  const tableSeats = Array.from({ length: MAX_SEATS }).map((_, i) =>
    players.find((p) => p?.seatIndex === i),
  );

  const communitySlots = Array.from({ length: 5 }).map((_, i) => board[i] ?? null);
  const boardHasCards = communitySlots.some(Boolean);
  const boardCardSize = boardHasCards ? "md" : "sm";
  const boardGap = boardHasCards ? 8 : 6;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="relative w-full max-w-5xl"
        style={{ aspectRatio: "2.1 / 1", margin: "28px auto 20px" }}
      >
        <div
          className="absolute inset-0 rounded-[200px]"
          style={{
            background: "transparent",
            boxShadow: "0 30px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        />
        <div
          className="absolute inset-0 rounded-[200px]"
          style={{
            background: "linear-gradient(180deg, #2a2040 0%, #1a1530 100%)",
            border: "10px solid #1a1530",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        />
        <div
          className="absolute rounded-[180px]"
          style={{
            inset: "10px",
            background:
              "radial-gradient(ellipse 90% 70% at 50% 55%, #1f1848 0%, #181338 30%, #130f2e 60%, #0e0b22 100%)",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
          }}
        />
        <div
          className="absolute rounded-[175px] pointer-events-none"
          style={{
            inset: "14px",
            border: "1px solid rgba(120,80,240,0.15)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "25%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "50%",
            height: "35%",
            background: "radial-gradient(ellipse, rgba(100,50,220,0.25) 0%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />

        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div
            style={{
              position: "absolute",
              top: "34%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.04)",
              textTransform: "uppercase",
              fontFamily: "Outfit, Inter, sans-serif",
              userSelect: "none",
            }}
          >
            OverBet
          </div>

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
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
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 24 }}
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

          <div
            style={{
              position: "absolute",
              top: boardHasCards ? "68%" : "70%",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 8,
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
                    style={{
                      padding: "5px 14px",
                      borderRadius: 999,
                      border:
                        pot.type === "MAIN"
                          ? "1px solid rgba(239,68,68,0.35)"
                          : "1px solid rgba(99,102,241,0.35)",
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                      color: pot.type === "MAIN" ? "#f87171" : "#a5b4fc",
                      fontWeight: 700,
                      fontSize: 13,
                      fontFamily: "Outfit, Inter, sans-serif",
                      letterSpacing: "0.01em",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{pot.type === "MAIN" ? "POT" : "SIDE"}:</span>
                      <ChipAmount
                        amount={pot.amount}
                        iconSize={12}
                        iconColor={pot.type === "MAIN" ? "#f87171" : "#a5b4fc"}
                        amountStyle={{ color: "inherit" }}
                      />
                    </span>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>

        {PLAYER_SEAT_POSITIONS.map((playerPos, i) => {
          const seatPosition = tableSeats[i] ? playerPos : EMPTY_SEAT_POSITIONS[i];

          return (
            <div
              key={i}
              className="absolute z-10"
              style={{
                top: seatPosition.top,
                left: seatPosition.left,
                transform: "translate(-50%, -50%)",
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
