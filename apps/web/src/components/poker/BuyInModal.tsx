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
    /** "buyin" (default) = initial seat request; "rebuy" = re-buy after busting */
    mode?: "buyin" | "rebuy";
}

export function BuyInModal({
    isOpen,
    onClose,
    onSubmit,
    minAmount,
    maxAmount,
    seatIndex,
    isGuest,
    initialDisplayName = "",
    mode = "buyin",
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

    const isRebuy = mode === "rebuy";

    const handleAmountChange = (val: string) => {
        const clean = val.replace(/[^0-9]/g, '');
        const final = clean.replace(/^0+(?!$)/, '');
        setAmountStr(final);
    };

    const handleConfirm = () => {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount) || amount < minAmount || amount > maxAmount) return;
        if (isGuest && !isRebuy && !displayName.trim()) return;
        onSubmit(amount, isRebuy ? initialDisplayName : displayName.trim());
    };

    // Quick amount presets
    const presets = [
        { label: "Min", value: minAmount },
        { label: "Mid", value: Math.round((minAmount + maxAmount) / 2 / 100) * 100 },
        { label: "Max", value: maxAmount },
    ];

    const currentAmount = parseInt(amountStr, 10) || 0;
    const isValid = currentAmount >= minAmount && currentAmount <= maxAmount && (isRebuy || !isGuest || displayName.trim().length > 0);

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 50, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
        }}>
            <div style={{
                width: "100%", maxWidth: 380, padding: 28, position: "relative",
                background: "rgba(16,13,28,0.98)", border: isRebuy
                    ? "1px solid rgba(239,68,68,0.25)"
                    : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 24, boxShadow: isRebuy
                    ? "0 24px 80px rgba(239,68,68,0.15)"
                    : "0 24px 80px rgba(0,0,0,0.7)",
                fontFamily: "Outfit, sans-serif",
            }}>
                {/* Close */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute", top: 16, right: 16, background: "none", border: "none",
                        color: "rgba(255,255,255,0.3)", fontSize: 20, cursor: "pointer", lineHeight: 1,
                        padding: 4,
                    }}
                >
                    ✕
                </button>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    {isRebuy && (
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "3px 10px", borderRadius: 999, marginBottom: 10,
                            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                        }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                BUSTED
                            </span>
                        </div>
                    )}
                    <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                        {isRebuy ? "Re-buy" : "Join Table"}
                    </h3>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 }}>
                        {isRebuy
                            ? `Re-enter at seat ${seatIndex + 1} — awaiting host approval`
                            : `Request seat ${seatIndex + 1}`}
                    </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Display name — only for initial buy-in */}
                    {isGuest && !isRebuy && (
                        <div>
                            <label style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                                Display Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                maxLength={20}
                                style={{
                                    width: "100%", height: 44, padding: "0 14px",
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "Outfit, sans-serif",
                                    outline: "none", boxSizing: "border-box",
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                            />
                        </div>
                    )}

                    {/* Re-buy shows the player name as a read-only pill */}
                    {isRebuy && initialDisplayName && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%",
                                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 14, fontWeight: 700,
                            }}>
                                {initialDisplayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{initialDisplayName}</div>
                                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Returning player</div>
                            </div>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                            {isRebuy ? "Re-buy Amount" : "Buy-In Amount"}
                        </label>
                        <div style={{ position: "relative" }}>
                            <span style={{
                                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                                color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 16,
                            }}>$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amountStr}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                style={{
                                    width: "100%", height: 48, paddingLeft: 28, paddingRight: 14,
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 12, color: "#fff", fontSize: 18, fontWeight: 700,
                                    fontFamily: "monospace", outline: "none", boxSizing: "border-box",
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                            />
                        </div>

                        {/* Quick presets */}
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            {presets.map(({ label, value }) => (
                                <button
                                    key={label}
                                    onClick={() => setAmountStr(value.toString())}
                                    style={{
                                        flex: 1, padding: "5px 0", borderRadius: 8,
                                        border: currentAmount === value
                                            ? "1px solid rgba(167,139,250,0.5)"
                                            : "1px solid rgba(255,255,255,0.08)",
                                        background: currentAmount === value
                                            ? "rgba(167,139,250,0.12)"
                                            : "rgba(255,255,255,0.03)",
                                        color: currentAmount === value ? "#a78bfa" : "rgba(255,255,255,0.4)",
                                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                                        fontFamily: "Outfit, sans-serif",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>Min ${minAmount.toLocaleString()}</span>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>Max ${maxAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                    <button
                        data-testid="buyin-cancel-button"
                        onClick={onClose}
                        style={{
                            flex: 1, padding: "12px 0", borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "transparent", color: "rgba(255,255,255,0.4)",
                            fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        data-testid={isRebuy ? "rebuy-submit-button" : "seat-request-submit-button"}
                        onClick={handleConfirm}
                        disabled={!isValid}
                        style={{
                            flex: 2, padding: "12px 0", borderRadius: 14, border: "none",
                            background: isValid
                                ? isRebuy
                                    ? "linear-gradient(135deg, #ef4444, #dc2626)"
                                    : "linear-gradient(135deg, #7c3aed, #a855f7)"
                                : "rgba(255,255,255,0.06)",
                            color: isValid ? "#fff" : "rgba(255,255,255,0.2)",
                            fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: 700,
                            cursor: isValid ? "pointer" : "not-allowed",
                            boxShadow: isValid
                                ? isRebuy
                                    ? "0 4px 20px rgba(239,68,68,0.25)"
                                    : "0 4px 20px rgba(124,58,237,0.25)"
                                : "none",
                            transition: "all 0.2s",
                        }}
                    >
                        {isRebuy ? "Request Re-buy" : "Request Seat"}
                    </button>
                </div>
            </div>
        </div>
    );
}
