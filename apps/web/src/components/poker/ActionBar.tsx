import React, { useState } from 'react';

interface ActionBarProps {
    isActive: boolean;
    stack: number;
    currentBet: number;
    playerBet: number;
    minRaise: number;
    onAction: (actionType: string, amount?: number) => void;
}

export function ActionBar({ isActive, stack, currentBet, playerBet, minRaise, onAction }: ActionBarProps) {
    const minRaiseTo = currentBet + minRaise;
    const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);

    // Update raiseAmount when minRaiseTo changes (e.g. someone else raises)
    React.useEffect(() => {
        setRaiseAmount(prev => Math.max(prev, minRaiseTo));
    }, [minRaiseTo]);

    if (!isActive) {
        return (
            <div className="flex w-full gap-4 opacity-50 pointer-events-none grayscale">
                <button className="flex-1 py-4 font-bold transition-all border bg-white/5 border-white/10 rounded-2xl text-white/70">Wait for Turn</button>
            </div>
        );
    }

    const toCall = currentBet - playerBet;

    return (
        <div className="flex w-full gap-4">
            <button
                onClick={() => onAction("FOLD")}
                className="flex-1 py-4 font-bold transition-all border bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 active:scale-95 text-white/70"
            >
                Fold
            </button>

            <button
                onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
                className="flex-1 py-4 font-bold text-white transition-all border bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 active:scale-95"
            >
                {toCall > 0 ? `Call $${toCall}` : "Check"}
            </button>

            <div className="flex items-center flex-1 pr-2 transition-all border shadow-lg bg-accent-1 border-white/10 rounded-2xl hover:brightness-110 shadow-accent-1/20 focus-within:ring-2 focus-within:ring-white/20">
                <button
                    onClick={() => onAction("RAISE", raiseAmount)}
                    className="flex-1 py-4 pl-4 font-bold text-left text-white active:scale-[0.98]"
                >
                    Raise To
                </button>
                <input
                    type="number"
                    value={raiseAmount}
                    min={minRaiseTo}
                    max={stack + playerBet}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="w-20 px-2 py-1 font-mono font-bold text-black border-none rounded-md outline-none bg-white/90"
                />
            </div>

            <button
                onClick={() => onAction("ALL_IN")}
                className="px-6 py-4 font-bold text-white transition-all border bg-accent-2 border-white/10 rounded-2xl hover:brightness-110 active:scale-95 shadow-accent-2/20"
            >
                All-In
            </button>
        </div>
    );
}
