/**
 * WinnerToast — Moon Poker winner announcement overlay
 * Fades in immediately, fades out after 6 seconds.
 * Positioned bottom-right above the action bar.
 */

import { useEffect, useState } from "react";

interface WinnerToastProps {
  winner: string;        // display name of the winner
  pot: number;           // chips won
  onNewHand?: () => void; // optional callback — host-only "New Hand" button
  isHost?: boolean;
}

function ChipStackIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="#fbbf24" style={{ flexShrink: 0 }}>
      <ellipse cx="8" cy="12" rx="6" ry="2.5" opacity="0.55" />
      <ellipse cx="8" cy="9.5" rx="6" ry="2.5" opacity="0.75" />
      <ellipse cx="8" cy="7" rx="6" ry="2.5" />
    </svg>
  );
}

export default function WinnerToast({ winner, pot, onNewHand, isHost }: WinnerToastProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 20);
    const t2 = setTimeout(() => setFading(true), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        right: 20,
        zIndex: 60,
        maxWidth: 280,
        width: "calc(100vw - 40px)",
        opacity: fading ? 0 : visible ? 1 : 0,
        transform: fading ? "translateY(8px)" : visible ? "translateY(0)" : "translateY(12px)",
        transition: fading
          ? "opacity 0.8s ease, transform 0.8s ease"
          : "opacity 0.35s ease, transform 0.35s ease",
        pointerEvents: fading ? "none" : "auto",
        background: "rgba(18, 15, 32, 0.96)",
        border: "1px solid rgba(124, 58, 237, 0.35)",
        borderRadius: 16,
        boxShadow:
          "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 24px rgba(124,58,237,0.18)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      {/* Purple accent line */}
      <div
        style={{
          height: 2,
          background:
            "linear-gradient(90deg, transparent, rgba(139,92,246,0.8) 40%, rgba(167,139,250,0.9) 60%, transparent)",
        }}
      />

      <div style={{ padding: "14px 16px 14px" }}>
        {/* Trophy + winner name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(234,179,8,0.12)",
              border: "1px solid rgba(234,179,8,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.42)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "Outfit, Inter, sans-serif",
                marginBottom: 2,
              }}
            >
              Hand Winner
            </div>
            <div
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: 700,
                fontFamily: "Outfit, Inter, sans-serif",
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {winner}
            </div>
          </div>
        </div>

        {/* Pot won */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            padding: "7px 10px",
            marginBottom: onNewHand && isHost ? 12 : 0,
          }}
        >
          <ChipStackIcon />
          <span
            style={{
              color: "#fbbf24",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "Outfit, Inter, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            +{pot}
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "Outfit, Inter, sans-serif",
            }}
          >
            chips won
          </span>
        </div>

        {/* New Hand button — host only */}
        {onNewHand && isHost && (
          <button
            onClick={onNewHand}
            style={{
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              background: "rgba(124, 58, 237, 0.80)",
              border: "1px solid rgba(167,139,250,0.28)",
              color: "#fff",
              fontFamily: "Outfit, Inter, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease",
              boxShadow: "0 2px 12px rgba(124,58,237,0.35)",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(139,92,246,0.90)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(124,58,237,0.80)";
            }}
          >
            New Hand
          </button>
        )}
      </div>
    </div>
  );
}
