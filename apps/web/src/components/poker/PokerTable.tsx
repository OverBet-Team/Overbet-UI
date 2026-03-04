import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Seat, PlayerData, TurnTimer } from './Seat';

interface PokerTableProps {
    players: (PlayerData | undefined)[];
    dealerId: string;
    activePlayerId: string;
    userId: string;
    board: string[];
    pots: { amount: number, type: string }[];
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
    turnTimer
}: PokerTableProps) {

    // Positioning logic for a 6-max table (indexes 0-5)
    const positions = [
        "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",        // Seat 0 (Top Center)
        "top-1/4 right-0 translate-x-1/2 -translate-y-1/2",      // Seat 1 (Top Right)
        "bottom-1/4 right-0 translate-x-1/2 translate-y-1/2",    // Seat 2 (Bottom Right)
        "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",      // Seat 3 (Bottom Center)
        "bottom-1/4 left-0 -translate-x-1/2 translate-y-1/2",    // Seat 4 (Bottom Left)
        "top-1/4 left-0 -translate-x-1/2 -translate-y-1/2",      // Seat 5 (Top Left)
    ];

    // Ensure we always iterate exactly 6 times
    const tableSeats = Array.from({ length: 6 }).map((_, i) => players.find(p => p?.seatIndex === i));

    const centerOffsets = [
        { x: 0, y: 150 },    // Seat 0
        { x: -150, y: 100 }, // Seat 1
        { x: -150, y: -100 },// Seat 2
        { x: 0, y: -150 },   // Seat 3
        { x: 150, y: -100 }, // Seat 4
        { x: 150, y: 100 },  // Seat 5
    ];

    return (
        <div className="relative w-full max-w-5xl aspect-[2.1/1] bg-emerald-900/30 border-[12px] border-amber-900/40 rounded-[200px] shadow-2xl flex flex-col items-center justify-center my-10">
            <div className="absolute inset-4 border-2 border-white/5 rounded-[180px]"></div>

            {/* Center Info */}
            <div className="z-0 text-center pointer-events-none">
                <div className="text-4xl font-bold text-white/5 uppercase tracking-[0.2em]">OverBet</div>

                {/* Board Cards */}
                <div className="flex justify-center gap-3 mt-8 h-20">
                    <AnimatePresence>
                        {board && board.map((card, i) => (
                            <motion.div
                                key={`${card}-${i}`}
                                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center justify-center font-bold text-black bg-white border border-white rounded-lg shadow-md w-14 h-20 text-md"
                            >
                                {card}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Pots */}
                <div className="flex justify-center gap-2 mt-6 h-10">
                    <AnimatePresence>
                        {pots && pots.map((pot, i) => (
                            <motion.div
                                key={`${pot.type}-${i}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className={`px-4 py-2 rounded-full border font-bold text-sm shadow-lg backdrop-blur-sm ${pot.type === 'MAIN' ? 'bg-black/40 border-accent-1/20 text-accent-1' : 'bg-black/40 border-accent-2/20 text-accent-2'}`}
                            >
                                {pot.type === 'MAIN' ? 'POT' : 'SIDE'}: ${pot.amount}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Seats */}
            {positions.map((posInfo, i) => (
                <div key={i} className={`absolute ${posInfo} z-10`}>
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
