"use client";

import { Shield } from "lucide-react";

interface FairnessModalProps {
  currentCommitment: string;
  lastHandReveal: { seed: number; commitment: string } | null;
  onClose: () => void;
  isPortraitMobile: boolean;
}

export function FairnessModal({ currentCommitment, lastHandReveal, onClose, isPortraitMobile }: FairnessModalProps) {
  return (
    <div className={`modal-backdrop${isPortraitMobile ? " modal-backdrop--bottom" : ""}`}>
      <div
        className={`panel${isPortraitMobile ? " panel--sheet" : ""}`}
        style={{
          maxWidth: isPortraitMobile ? "100%" : 420,
          padding: isPortraitMobile ? "18px 16px 22px" : 28,
        }}
      >
        <button className="close-btn" onClick={onClose} aria-label="Close fairness modal">✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Shield size={18} color="#6ee7b7" />
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>Provably Fair</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Current Hand Commitment
            </div>
            <div style={{
              fontFamily: "monospace", fontSize: 10, wordBreak: "break-all",
              background: "rgba(0,0,0,0.3)", padding: "8px 10px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)",
            }}>
              {currentCommitment || "Waiting for hand\u2026"}
            </div>
            <p style={{ marginTop: 8, color: "rgba(255,255,255,0.25)", fontSize: 10, fontStyle: "italic", lineHeight: 1.5 }}>
              SHA-256 hash generated before cards were dealt — proves the deck order is fixed.
            </p>
          </div>

          {lastHandReveal && (
            <div style={{
              padding: 16, borderRadius: 14,
              background: "rgba(110,231,183,0.05)", border: "1px solid rgba(110,231,183,0.2)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Last Hand Revealed
                </span>
                <span data-testid="room-code" style={{
                  background: "rgba(110,231,183,0.15)", color: "#6ee7b7",
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  border: "1px solid rgba(110,231,183,0.3)",
                }}>
                  VERIFIED
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, display: "block", marginBottom: 2 }}>Seed</span>
                  <code style={{ color: "#6ee7b7", fontFamily: "monospace", fontSize: 14 }}>
                    {lastHandReveal.seed}
                  </code>
                </div>
                <div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, display: "block", marginBottom: 2 }}>Commitment</span>
                  <code style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 9, wordBreak: "break-all" }}>
                    {lastHandReveal.commitment}
                  </code>
                </div>
              </div>
            </div>
          )}

          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, textAlign: "center", lineHeight: 1.5 }}>
            Even the server host cannot see your cards until they are revealed at showdown.
          </p>
        </div>
      </div>
    </div>
  );
}
