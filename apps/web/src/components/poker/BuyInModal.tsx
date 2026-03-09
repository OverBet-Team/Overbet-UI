import React, { useState, useEffect } from 'react';

interface BuyInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, displayName: string) => void;
    minAmount: number;
    maxAmount: number;
    seatIndex: number;
    isGuest: boolean;
    initialDisplayName?: string;
}

export function BuyInModal({
    isOpen,
    onClose,
    onSubmit,
    minAmount,
    maxAmount,
    seatIndex,
    isGuest,
    initialDisplayName = ""
}: BuyInModalProps) {
    const [amountStr, setAmountStr] = useState<string>(minAmount.toString());
    const [displayName, setDisplayName] = useState<string>(initialDisplayName);

    useEffect(() => {
        if (isOpen) {
            setAmountStr(minAmount.toString());
            setDisplayName(initialDisplayName);
        }
    }, [isOpen, minAmount, initialDisplayName]);

    if (!isOpen) return null;

    const handleAmountChange = (val: string) => {
        // Only allow numbers
        const clean = val.replace(/[^0-9]/g, '');
        // Remove leading zeros unless it's just "0"
        const final = clean.replace(/^0+(?!$)/, '');
        setAmountStr(final);
    };

    const handleConfirm = () => {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount)) return;
        if (isGuest && !displayName.trim()) return;
        onSubmit(amount, displayName.trim());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-sm p-6 space-y-6 rounded-2xl shadow-2xl" style={{ background: "rgba(22, 18, 40, 0.95)", border: "1px solid rgba(124,58,237,0.3)" }}>
                <div>
                    <h3 className="text-xl font-bold tracking-tight text-white">Join Table</h3>
                    <p className="text-sm text-white/50">Request seat {seatIndex + 1}</p>
                </div>

                <div className="space-y-4">
                    {isGuest && (
                        <div>
                            <label className="block mb-2 text-sm font-medium text-white/70">Display Name</label>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full h-12 px-4 font-medium text-white transition-colors border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                                style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.1)" }}
                                maxLength={20}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block mb-2 text-sm font-medium text-white/70">Buy-In Amount</label>
                        <div className="relative">
                            <span className="absolute font-bold text-white/40 left-4 top-1/2 -translate-y-1/2">$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amountStr}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="w-full h-12 pl-8 pr-4 font-mono text-lg font-bold text-white transition-colors border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                                style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.1)" }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-semibold text-white/40">
                            <span>Min: ${minAmount}</span>
                            <span>Max: ${maxAmount}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 font-bold text-white transition-all rounded-xl bg-white/5 hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isGuest && !displayName.trim()}
                        className="flex-1 px-4 py-3 font-bold text-white transition-all shadow-lg rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
                    >
                        Request Seat
                    </button>
                </div>
            </div>
        </div>
    );
}
