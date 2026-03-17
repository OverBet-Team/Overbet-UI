"use client";

// OverBet — WinnerToast
// Moon Poker winner announcement overlay.
// Auto-fades after 6 seconds. NO manual "New Hand" button — OverBet auto-starts.

import { useEffect, useState } from "react";

interface WinnerToastProps {
  winner: string;    // display name of the winner
  pot: number;       // chips won
  handName?: string; // e.g. "Full House", "Straight Flush"
}

function TrophyIcon() {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
      background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>🏆</span>
    </div>
  );
}

function ChipIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="10" cy="10" r="2" fill="#fbbf24" />
    </svg>
  );
}

export default function WinnerToast({ winner, pot, handName }: WinnerToastProps) {
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out">("hidden");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("in"), 20);
    const t2 = setTimeout(() => setPhase("visible"), 380);
    const t3 = setTimeout(() => setPhase("out"), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [winner, pot]);

  const opacity = phase === "hidden" ? 0 : phase === "in" ? 0 : phase === "visible" ? 1 : 0;
  const translateY = phase === "hidden" ? 14 : phase === "in" ? 14 : phase === "visible" ? 0 : 8;
  const transition = phase === "in"
    ? "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.3,0.64,1)"
    : phase === "out"
    ? "opacity 0.7s ease, transform 0.7s ease"
    : "none";

  return (
    <div
      className="winner-toast"
      data-testid="winner-toast"
      style={{
      position: "fixed", bottom: 100, right: 20, zIndex: 60,
      maxWidth: 280, width: "calc(100vw - 40px)",
      opacity, transform: `translateY(${translateY}px)`, transition,
      pointerEvents: phase === "out" ? "none" : "auto",
      background: "rgba(16,13,28,0.97)",
      border: "1px solid rgba(124,58,237,0.3)",
      borderRadius: 18,
      boxShadow: "0 10px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 30px rgba(124,58,237,0.15)",
      backdropFilter: "blur(24px)",
      overflow: "hidden",
      fontFamily: "Outfit, sans-serif",
    }}>
      {/* Purple accent line */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8) 40%, rgba(167,139,250,0.9) 60%, transparent)",
      }} />

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Trophy + winner name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <TrophyIcon />
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2,
            }}>
              Hand Winner
            </div>
            <div style={{
              color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {winner}
            </div>
          </div>
        </div>

        {/* Pot won */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px",
          marginBottom: handName ? 8 : 0,
        }}>
          <ChipIcon size={14} />
          <span style={{ color: "#fbbf24", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
            +{pot.toLocaleString()}
          </span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 500 }}>
            chips
          </span>
        </div>

        {/* Hand name — Moon Poker style: "Won with X" */}
        {handName && (
          <div data-testid="winner-hand-name" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "rgba(18, 15, 32, 0.92)", border: "1px solid rgba(234,179,8,0.35)",
            borderRadius: 8, padding: "6px 10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.5), 0 0 6px rgba(234,179,8,0.1)",
            backdropFilter: "blur(12px)",
          }}>
            <span style={{ color: "#eab308", fontSize: 10, lineHeight: 1 }}>♦</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
              Won with {handName}
            </span>
            <span style={{ color: "#eab308", fontSize: 10, lineHeight: 1 }}>♦</span>
          </div>
        )}

        {/* Auto-start hint */}
        <div style={{
          marginTop: 10, textAlign: "center",
          color: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 500,
        }}>
          Next hand starting automatically…
        </div>
      </div>
    </div>
  );
}
