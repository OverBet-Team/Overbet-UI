"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Seat, PlayerData, TurnTimer } from "./Seat";
import PlayingCard from "./PlayingCard";

const MAX_SEATS = 10;

// Arc angles for opponent seats (1-9 opponents). Angles in degrees: 0=right, 90=top, 180=left.
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

// Desktop arc geometry
const ARC_CY_PCT = 0.44;
const ARC_RX_PCT = 0.38;
const ARC_RY_PCT = 0.38;

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Build 10 seat slots: slot 0 = bottom center, slots 1-9 = arc
  const tableSeats = Array.from({ length: MAX_SEATS }).map((_, i) =>
    players.find((p) => p?.seatIndex === i)
  );

  // Center offsets for chip slide animation (seat index -> {x, y} from pot center)
  const centerOffsets: { x: number; y: number }[] = [];
  const seatAngles = ARC_ANGLES_BY_COUNT[9] ?? [];
  centerOffsets.push({ x: 0, y: 150 }); // seat 0 bottom center
  for (let i = 0; i < 9; i++) {
    const angleRad = ((seatAngles[i] ?? 90) * Math.PI) / 180;
    const px_pct = 0.5 + ARC_RX_PCT * Math.cos(angleRad);
    const py_pct = ARC_CY_PCT - ARC_RY_PCT * Math.sin(angleRad);
    centerOffsets.push({
      x: Math.round((px_pct - 0.5) * 500),
      y: Math.round((py_pct - 0.44) * 400),
    });
  }

  if (isMobile) {
    return (
      <MobileTable
        tableSeats={tableSeats}
        dealerId={dealerId}
        activePlayerId={activePlayerId}
        userId={userId}
        board={board}
        pots={pots}
        handleSeatClick={handleSeatClick}
        turnTimer={turnTimer}
      />
    );
  }

  // Desktop: arc layout
  const arcSeatCount = Math.min(
    9,
    tableSeats.slice(1).filter((s) => s).length
  );
  const angles = ARC_ANGLES_BY_COUNT[arcSeatCount] ?? ARC_ANGLES_BY_COUNT[1];

  return (
    <div className="relative w-full max-w-5xl aspect-[2.1/1] bg-emerald-900/30 border-[12px] border-amber-900/40 rounded-[200px] shadow-2xl flex flex-col items-center justify-center my-10 overflow-visible">
      <div className="absolute inset-4 border-2 border-white/5 rounded-[180px]" />

      {/* Center: board cards + pots */}
      <div className="z-0 text-center pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
        <div className="flex justify-center gap-3 h-20">
          <AnimatePresence>
            {board &&
              board.map((card, i) => (
                <motion.div key={`${card}-${i}`} initial={{ opacity: 0, y: -20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.1 }}>
                  <PlayingCard card={card} size="md" dealDelay={i * 80} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
        <div className="flex justify-center gap-2 h-10 flex-wrap">
          <AnimatePresence>
            {pots &&
              pots.map((pot, i) => (
                <motion.div
                  key={`${pot.type}-${i}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className={`px-4 py-2 rounded-full border font-bold text-sm shadow-lg backdrop-blur-sm ${
                    pot.type === "MAIN"
                      ? "bg-black/40 border-accent-1/20 text-accent-1"
                      : "bg-black/40 border-accent-2/20 text-accent-2"
                  }`}
                >
                  {pot.type === "MAIN" ? "POT" : "SIDE"}: ${pot.amount}
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Seat 0: bottom center */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
        <Seat
          player={tableSeats[0]}
          seatIndex={0}
          isDealer={tableSeats[0]?.id === dealerId}
          isActive={tableSeats[0]?.id === activePlayerId}
          isSelf={tableSeats[0]?.id === userId}
          onSeatClick={handleSeatClick}
          timer={turnTimer}
          centerOffset={centerOffsets[0]}
        />
      </div>

      {/* Seats 1-9: arc */}
      {angles.map((angleDeg, i) => {
        const seatIndex = i + 1;
        const player = tableSeats[seatIndex];
        const angleRad = (angleDeg * Math.PI) / 180;
        const px_pct = 0.5 + ARC_RX_PCT * Math.cos(angleRad);
        const py_pct = ARC_CY_PCT - ARC_RY_PCT * Math.sin(angleRad);
        const leftPct = px_pct * 100;
        const topPct = py_pct * 100;

        return (
          <div
            key={seatIndex}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
            }}
          >
            <Seat
              player={player}
              seatIndex={seatIndex}
              isDealer={player?.id === dealerId}
              isActive={player?.id === activePlayerId}
              isSelf={player?.id === userId}
              onSeatClick={handleSeatClick}
              timer={turnTimer}
              centerOffset={centerOffsets[seatIndex]}
            />
          </div>
        );
      })}
    </div>
  );
}

function MobileTable({
  tableSeats,
  dealerId,
  activePlayerId,
  userId,
  board,
  pots,
  handleSeatClick,
  turnTimer,
}: {
  tableSeats: (PlayerData | undefined)[];
  dealerId: string;
  activePlayerId: string;
  userId: string;
  board: string[];
  pots: { amount: number; type: string }[];
  handleSeatClick: (seatIndex: number) => void;
  turnTimer?: TurnTimer | null;
}) {
  // Mobile: 10 positions around oval. Simpler layout.
  const MOBILE_POSITIONS = [
    "top-[8%] left-1/2 -translate-x-1/2 -translate-y-1/2",
    "top-[18%] left-[12%] -translate-x-1/2 -translate-y-1/2",
    "top-[18%] right-[12%] translate-x-1/2 -translate-y-1/2",
    "top-1/3 left-0 -translate-x-1/2 -translate-y-1/2",
    "top-1/3 right-0 translate-x-1/2 -translate-y-1/2",
    "bottom-1/3 left-0 -translate-x-1/2 translate-y-1/2",
    "bottom-1/3 right-0 translate-x-1/2 translate-y-1/2",
    "bottom-[18%] left-[12%] -translate-x-1/2 translate-y-1/2",
    "bottom-[18%] right-[12%] translate-x-1/2 translate-y-1/2",
    "bottom-[6%] left-1/2 -translate-x-1/2 translate-y-1/2",
  ];

  const centerOffsets = [
    { x: 0, y: -120 },
    { x: 100, y: -80 },
    { x: -100, y: -80 },
    { x: 120, y: 0 },
    { x: -120, y: 0 },
    { x: 120, y: 0 },
    { x: -120, y: 0 },
    { x: 100, y: 80 },
    { x: -100, y: 80 },
    { x: 0, y: 120 },
  ];

  return (
    <div className="relative w-full max-w-2xl aspect-[1.2/1] bg-emerald-900/30 border-[10px] border-amber-900/40 rounded-[120px] shadow-2xl flex flex-col items-center justify-center my-6 overflow-visible">
      <div className="absolute inset-3 border-2 border-white/5 rounded-[100px]" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 flex flex-col items-center gap-2 pointer-events-none">
        <div className="flex justify-center gap-1.5 h-14 flex-wrap max-w-[200px]">
          {board &&
            board.map((card, i) => (
              <PlayingCard key={i} card={card} size="sm" dealDelay={i * 60} />
            ))}
        </div>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {pots &&
            pots.map((pot, i) => (
              <span
                key={i}
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  pot.type === "MAIN"
                    ? "bg-black/40 border border-accent-1/30 text-accent-1"
                    : "bg-black/40 border border-accent-2/30 text-accent-2"
                }`}
              >
                {pot.type === "MAIN" ? "POT" : "SIDE"}: ${pot.amount}
              </span>
            ))}
        </div>
      </div>

      {MOBILE_POSITIONS.map((pos, i) => (
        <div key={i} className={`absolute ${pos} z-10`}>
          <Seat
            player={tableSeats[i]}
            seatIndex={i}
            isDealer={tableSeats[i]?.id === dealerId}
            isActive={tableSeats[i]?.id === activePlayerId}
            isSelf={tableSeats[i]?.id === userId}
            onSeatClick={handleSeatClick}
            timer={turnTimer}
            centerOffset={centerOffsets[i]}
          />
        </div>
      ))}
    </div>
  );
}
