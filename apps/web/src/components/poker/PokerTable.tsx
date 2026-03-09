"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, List, Settings } from "lucide-react";
import { Seat, PlayerData, TurnTimer } from "./Seat";
import PlayingCard from "./PlayingCard";
import { ActionBar } from "./ActionBar";

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

interface RoomSettings {
  variant?: string;
  smallBlind?: number;
  bigBlind?: number;
}

interface PokerTableProps {
  players: (PlayerData | undefined)[];
  dealerId: string;
  activePlayerId: string;
  userId: string;
  board: string[];
  pots: { amount: number; type: string }[];
  handleSeatClick: (seatIndex: number) => void;
  turnTimer?: TurnTimer | null;
  myPlayerInfo?: { holeCards?: string[]; cards?: string[]; stack?: number; bet?: number } | null;
  handleAction?: (action: string, amount?: number) => void;
  onOpenRaiseModal?: () => void;
  roomSettings?: RoomSettings | null;
  showLogPanel?: boolean;
  onToggleLogPanel?: () => void;
  currentBet?: number;
  minRaise?: number;
  onOpenRoomOverlay?: () => void;
  roomName?: string;
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
  myPlayerInfo,
  handleAction,
  onOpenRaiseModal,
  roomSettings,
  showLogPanel,
  onToggleLogPanel,
  currentBet = 0,
  minRaise = 0,
  onOpenRoomOverlay,
  roomName = "",
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

  const hasOwnerArea = myPlayerInfo && handleAction && onOpenRaiseModal;
  const isActivePlayer = activePlayerId === userId;
  const showHeader = hasOwnerArea || onOpenRoomOverlay;

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
      myPlayerInfo={myPlayerInfo}
      handleAction={handleAction}
      onOpenRaiseModal={onOpenRaiseModal}
      roomSettings={roomSettings}
    />
  );
  }

  // Always use full 10-seat layout so pre-game shows all empty seats around the table
  const angles = ARC_ANGLES_BY_COUNT[9] ?? [];
  const blinds = roomSettings ? `${roomSettings.smallBlind ?? 10} / ${roomSettings.bigBlind ?? 20}` : "— / —";

  return (
    <div className={`flex flex-col w-full ${showHeader ? "flex-1 min-h-0" : "my-10"}`}>
      {/* Moon Poker header - game and lobby */}
      {showHeader && (
      <div
        className="flex-shrink-0 h-14 flex items-center justify-between px-5 relative"
        style={{
          background: "rgba(13, 11, 24, 0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Left: Moon Poker logo + blinds + settings */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Moon Poker logo: gold crescent + white circles */}
            <div className="relative w-[26px] h-[18px]">
              <div className="absolute w-[18px] h-[18px] rounded-full bg-[#eab308] left-0" />
              <div className="absolute w-[18px] h-[18px] rounded-full border-2 border-white/60 left-[7px] bg-transparent" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">Moon Poker</span>
          </div>
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">NLH</span>
          <span className="text-sm font-semibold text-white/80">{blinds}</span>
          {onOpenRoomOverlay && (
            <button
              onClick={onOpenRoomOverlay}
              className="p-2 rounded-full border border-white/10 hover:bg-white/10 transition-colors text-white/60 hover:text-white ml-1"
              title="Room / Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
        {/* Center: Table name */}
        <span
          className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-white/40 whitespace-nowrap"
        >
          Table: {roomName || "Poker Room"}
        </span>
        {/* Right: chips + avatar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-white/40">Get GAS</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span className="text-[10px] text-[#a78bfa]">●</span>
            <span className="text-sm font-semibold text-white">{myPlayerInfo?.stack ?? 0}</span>
          </div>
          <div
            className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center font-bold text-xs"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {userId ? String(userId).slice(0, 2).toUpperCase() : "—"}
          </div>
        </div>
      </div>
      )}

      {/* Table area with table-surface */}
      <div className={`relative flex flex-col items-center justify-center ${showHeader ? "flex-1 min-h-0" : ""}`}>
        <div className={`relative w-full max-w-5xl flex items-center justify-center ${showHeader ? "flex-1 min-h-[320px]" : "aspect-[2.1/1] min-h-[280px]"}`}>
          <div className="table-surface" />
          <div className="table-glow" />

          {/* Center: board + pots */}
          <div className="z-0 absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-none">
            <div className="flex justify-center gap-3 h-20">
              <AnimatePresence>
                {board?.map((card, i) => (
                  <motion.div key={`${card}-${i}`} initial={{ opacity: 0, y: -20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.1 }}>
                    <PlayingCard card={card} size="md" dealDelay={i * 80} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex justify-center gap-2 h-10 flex-wrap">
              <AnimatePresence>
                {pots?.map((pot, i) => (
                  <motion.div
                    key={`${pot.type}-${i}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className={`px-4 py-2 rounded-full border font-bold text-sm shadow-lg backdrop-blur-sm ${
                      pot.type === "MAIN" ? "bg-black/40 border-[#a78bfa]/30 text-[#a78bfa]" : "bg-black/40 border-[#eab308]/30 text-[#eab308]"
                    }`}
                  >
                    {pot.type === "MAIN" ? "POT" : "SIDE"}: ${pot.amount}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Seat 0: bottom center - only show if NOT owner (owner gets large cards in owner area) */}
          {tableSeats[0]?.id !== userId && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
              <Seat
                player={tableSeats[0]}
                seatIndex={0}
                isDealer={tableSeats[0]?.id === dealerId}
                isActive={tableSeats[0]?.id === activePlayerId}
                isSelf={false}
                onSeatClick={handleSeatClick}
                timer={turnTimer}
                centerOffset={centerOffsets[0]}
              />
            </div>
          )}

          {/* Seats 1-9: arc */}
          {angles.map((angleDeg, i) => {
            const seatIndex = i + 1;
            const player = tableSeats[seatIndex];
            const angleRad = (angleDeg * Math.PI) / 180;
            const px_pct = 0.5 + ARC_RX_PCT * Math.cos(angleRad);
            const py_pct = ARC_CY_PCT - ARC_RY_PCT * Math.sin(angleRad);
            return (
              <div
                key={seatIndex}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${px_pct * 100}%`, top: `${py_pct * 100}%` }}
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

          {/* Owner hand: large cards at bottom center (main focus) */}
          {hasOwnerArea && (myPlayerInfo?.holeCards ?? (myPlayerInfo as any)?.cards) && (
            <div
              className="absolute bottom-[-50px] left-1/2 -translate-x-1/2 z-[7] flex flex-col items-center gap-1"
              style={{ animation: "fadeInSeat 0.4s ease forwards" }}
            >
              <div className="flex items-end justify-center">
                {(myPlayerInfo.holeCards ?? (myPlayerInfo as any).cards ?? []).map((card: string, i: number) => (
                  <PlayingCard
                    key={i}
                    card={card}
                    size="xl"
                    rotate={i === 0 ? -10 : 6}
                    style={{ marginLeft: i > 0 ? -44 : 0, zIndex: i + 1 }}
                    dealDelay={i * 120}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pre-game bottom bar: YOUR BANK, Help, Log — full Moon Poker shell even before game starts */}
        {!hasOwnerArea && showHeader && (
          <div
            className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 gap-4 z-10 w-full max-w-5xl"
            style={{
              background: "rgba(10, 8, 20, 0.88)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-4 text-white/50 text-sm">
              {onToggleLogPanel && (
                <button onClick={onToggleLogPanel} className="hover:text-white/80 transition-colors flex items-center gap-1.5">
                  <List size={14} />
                  Log
                </button>
              )}
              <a href="#" className="hover:text-white/80 transition-colors flex items-center gap-1.5" onClick={(e) => { e.preventDefault(); }}>
                <HelpCircle size={14} />
                Help
              </a>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">YOUR BANK</span>
              <span className="text-xl font-bold text-white">{myPlayerInfo?.stack ?? 0}</span>
            </div>
            <div className="w-20" />
          </div>
        )}

        {/* In-game bottom bar: Help, Log, ActionBar, Stack, Timer */}
        {hasOwnerArea && (
          <div
            className="flex-shrink-0 h-[72px] flex items-center justify-between px-6 gap-4 z-10 w-full max-w-5xl"
            style={{
              background: "rgba(10, 8, 20, 0.88)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-medium transition-colors cursor-pointer">
                <HelpCircle size={14} /> Help
              </button>
              {onToggleLogPanel && (
                <button
                  onClick={onToggleLogPanel}
                  className={`flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${showLogPanel ? "text-[#a78bfa]" : "text-white/30 hover:text-white/60"}`}
                >
                  <List size={14} /> Log
                </button>
              )}
            </div>
            <div className="flex-1 flex justify-center">
              <ActionBar
                isActive={isActivePlayer}
                stack={myPlayerInfo?.stack ?? 0}
                currentBet={currentBet}
                playerBet={myPlayerInfo?.bet ?? 0}
                minRaise={minRaise}
                onAction={handleAction!}
                onOpenRaiseModal={onOpenRaiseModal}
              />
            </div>
            <div className="flex items-center gap-4 min-w-[140px] justify-end">
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-white/35 uppercase">Stack</span>
                <span className="font-bold text-white text-lg">${myPlayerInfo?.stack ?? 0}</span>
              </div>
              {turnTimer && turnTimer.playerId === userId && (
                <div className="timer-pill flex items-center gap-2">
                  <span className="text-white/90 font-semibold text-sm">Your Turn!</span>
                  <span className="font-bold text-[#eab308] text-sm tabular-nums">
                    {Math.floor((turnTimer.expiresAt - Date.now()) / 1000)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
  myPlayerInfo,
  handleAction,
  onOpenRaiseModal,
  roomSettings,
}: {
  tableSeats: (PlayerData | undefined)[];
  dealerId: string;
  activePlayerId: string;
  userId: string;
  board: string[];
  pots: { amount: number; type: string }[];
  handleSeatClick: (seatIndex: number) => void;
  turnTimer?: TurnTimer | null;
  myPlayerInfo?: { holeCards?: string[]; cards?: string[]; stack?: number; bet?: number } | null;
  handleAction?: (action: string, amount?: number) => void;
  onOpenRaiseModal?: () => void;
  roomSettings?: { smallBlind?: number; bigBlind?: number } | null;
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
    <div
      className="relative w-full max-w-2xl aspect-[1.2/1] rounded-[120px] shadow-2xl flex flex-col items-center justify-center my-6 overflow-visible"
      style={{
        background: "radial-gradient(ellipse 90% 70% at 50% 100%, #1f1848 0%, #181338 30%, #130f2e 60%, #0e0b22 100%)",
        border: "1.5px solid rgba(120, 80, 240, 0.22)",
        boxShadow: "0 -20px 80px rgba(80, 40, 200, 0.28), 0 -4px 24px rgba(60, 30, 160, 0.2), inset 0 2px 0 rgba(160, 120, 255, 0.08)",
      }}
    >
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
