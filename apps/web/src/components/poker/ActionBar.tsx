import React, { useState } from 'react';

interface ActionBarProps {
    isActive: boolean;
    stack: number;
    currentBet: number;
    playerBet: number;
    minRaise: number;
    onAction: (actionType: string, amount?: number) => void;
    /** When provided, Raise opens this modal instead of inline input */
    onOpenRaiseModal?: () => void;
}

export function ActionBar({ isActive, stack, currentBet, playerBet, minRaise, onAction, onOpenRaiseModal }: ActionBarProps) {
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
    const btnBase = "inline-flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-4 sm:px-5 rounded-full font-semibold text-sm sm:text-base transition-all active:scale-95 min-w-0 flex-1";

    return (
        <div className="flex w-full gap-2 sm:gap-3">
            <button
                onClick={() => onAction("FOLD")}
                className={`${btnBase} border-0 bg-transparent hover:bg-[rgba(248,113,113,0.1)]`}
                style={{ color: "#f87171" }}
            >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 9l6 6M15 9l-6 6" />
                </svg>
                Fold
                <span className="hidden sm:inline text-[9px] opacity-40 font-mono">F</span>
            </button>

            <button
                onClick={() => onAction(toCall > 0 ? "CALL" : "CHECK")}
                className={`${btnBase} border-0 bg-transparent hover:bg-[rgba(147,197,253,0.1)]`}
                style={{ color: "#93c5fd" }}
            >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                </svg>
                {toCall > 0 ? `Call $${toCall}` : "Check"}
                <span className="hidden sm:inline text-[9px] opacity-40 font-mono">C</span>
            </button>

            {onOpenRaiseModal ? (
                <button
                    onClick={onOpenRaiseModal}
                    className={`${btnBase} border-0 bg-transparent hover:bg-[rgba(134,239,172,0.1)]`}
                    style={{ color: "#86efac" }}
                >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12l7-7 7 7" />
                    </svg>
                    Raise
                    <span className="hidden sm:inline text-[9px] opacity-40 font-mono">R</span>
                </button>
            ) : (
                <div className="flex items-center flex-1 pr-2 transition-all rounded-full hover:bg-[rgba(134,239,172,0.1)] focus-within:ring-2 focus-within:ring-[#86efac]/30" style={{ color: "#86efac" }}>
                    <button
                        onClick={() => onAction("RAISE", raiseAmount)}
                        className="flex-1 py-3 sm:py-4 pl-4 font-semibold text-left active:scale-[0.98] flex items-center gap-2"
                    >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12l7-7 7 7" />
                        </svg>
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
            )}

            <button
                onClick={() => onAction("ALL_IN")}
                className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-white transition-all rounded-full hover:brightness-110 active:scale-95 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)", borderColor: "rgba(234,179,8,0.4)", boxShadow: "0 4px 16px rgba(234,179,8,0.3)" }}
            >
                All-In
            </button>
        </div>
    );
}
