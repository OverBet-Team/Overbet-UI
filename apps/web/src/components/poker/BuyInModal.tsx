import React, { useEffect, useState } from "react";
import { ChipAmount, ChipIcon } from "./ChipAmount";

interface BuyInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, displayName: string) => void;
    minAmount: number;
    maxAmount?: number;
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
    const [amountStr, setAmountStr] = useState<string>(Math.max(minAmount, 1000).toString());
    const [displayName, setDisplayName] = useState<string>(initialDisplayName);

    useEffect(() => {
        if (isOpen) {
            setAmountStr(Math.max(minAmount, 1000).toString());
            setDisplayName(initialDisplayName);
        }
    }, [initialDisplayName, isOpen, minAmount]);

    if (!isOpen) return null;

    const isRebuy = mode === "rebuy";
    const isUnlimited = maxAmount == null;

    const handleAmountChange = (val: string) => {
        const clean = val.replace(/[^0-9]/g, "");
        const final = clean.replace(/^0+(?!$)/, "");
        setAmountStr(final);
    };

    const currentAmount = amountStr === "" ? Number.NaN : parseInt(amountStr, 10);
    const isAmountValid = !Number.isNaN(currentAmount) && currentAmount >= minAmount && (isUnlimited || currentAmount <= maxAmount);
    const hasRequiredName = isRebuy || !isGuest || displayName.trim().length > 0;
    const isValid = isAmountValid && hasRequiredName;

    const handleConfirm = () => {
        if (!isValid || Number.isNaN(currentAmount)) return;
        onSubmit(currentAmount, isRebuy ? initialDisplayName : displayName.trim());
    };

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

                    <div>
                        <label style={{ display: "block", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                            {isRebuy ? "Re-buy Amount" : "Buy-In Amount"}
                        </label>
                        <div style={{ position: "relative" }}>
                            <span style={{
                                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <ChipIcon size={16} color="rgba(255,255,255,0.4)" />
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amountStr}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                style={{
                                    width: "100%", height: 48, paddingLeft: 38, paddingRight: 14,
                                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 12, color: "#fff", fontSize: 18, fontWeight: 700,
                                    fontFamily: "monospace", outline: "none", boxSizing: "border-box",
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                            />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, display: "inline-flex", alignItems: "center" }}>
                                Min <ChipAmount amount={minAmount} iconSize={10} amountStyle={{ color: "inherit", fontSize: 10 }} style={{ gap: 3, marginLeft: 4 }} />
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, display: "inline-flex", alignItems: "center" }}>
                                Max {isUnlimited ? "Unlimited" : <ChipAmount amount={maxAmount} iconSize={10} amountStyle={{ color: "inherit", fontSize: 10 }} style={{ gap: 3, marginLeft: 4 }} />}
                            </span>
                        </div>
                    </div>
                </div>

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
