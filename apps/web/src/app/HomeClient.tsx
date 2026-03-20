"use client";

import { createRoom } from "./actions/room";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../hooks/useUser";
import { Plus, Minus, Play } from "lucide-react";
import { ChipIcon } from "@/components/poker/ChipAmount";

// ── Moon Poker logo mark ──────────────────────────────────────────────────────
function MoonLogo({ size = 32 }: { size?: number }) {
  const chip = Math.round(size * 0.69);
  const gap = Math.round(size * 0.27);
  return (
    <div style={{ position: "relative", width: size, height: chip, flexShrink: 0 }}>
      <div style={{
        position: "absolute", width: chip, height: chip,
        borderRadius: "50%", background: "#eab308", left: 0,
      }} />
      <div style={{
        position: "absolute", width: chip, height: chip,
        borderRadius: "50%", border: "2px solid rgba(255,255,255,0.65)",
        left: gap, background: "transparent",
      }} />
    </div>
  );
}


// ── Number stepper input ──────────────────────────────────────────────────────
function NumberInput({
  label, value, onChange, step, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step: number; min: number; max: number;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "12px 8px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{
        color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center",
        fontFamily: "Outfit, sans-serif",
      }}>{label}</span>
      <span style={{
        color: "#fff", fontWeight: 700, fontSize: 18,
        fontFamily: "Outfit, sans-serif", fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
          className="icon-btn"
          style={{ width: 24, height: 24, minWidth: 24, minHeight: 24 }}
        >
          <Minus size={11} />
        </button>
        <button
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
          className="icon-btn"
          style={{ width: 24, height: 24, minWidth: 24, minHeight: 24 }}
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Main HomeClient ───────────────────────────────────────────────────────────
export default function HomeClient() {
  const router = useRouter();
  const { userId } = useUser();

  // Game config state
  const [tableName, setTableName] = useState("Home Game");
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleStartGame = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createRoom(userId, tableName || "Home Game", {
        smallBlind,
        bigBlind,
      });
      if (res.success) {
        router.push(`/room/${res.roomSlug}`);
      } else {
        setError("Failed to create room. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to create room:", err);
      setError(
        err?.message?.includes("DATABASE_URL") || err?.message?.includes("prisma")
          ? "Database not connected. Check your .env.local configuration."
          : "Failed to create room. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) { setJoinError("Please enter a room code."); return; }
    if (code.length !== 6) { setJoinError("Room codes are 6 characters (e.g. A3F9B2)."); return; }
    router.push(`/room/${code}`);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #1a1428 0%, #141420 40%, #0f0e1a 100%)",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
      padding: "20px 16px",
      fontFamily: "Outfit, sans-serif",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", pointerEvents: "none",
        top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "60%", height: "40%",
        background: "radial-gradient(ellipse, rgba(110,55,220,0.18) 0%, transparent 70%)",
        filter: "blur(40px)",
      }} />

      {/* Setup card */}
      <div style={{
        position: "relative", width: "100%", maxWidth: 460,
        borderRadius: 24, overflow: "hidden",
        background: "rgba(18,15,32,0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: "28px 32px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <MoonLogo size={30} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>
              OverBet
            </span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
            Set up your home game
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 32px 28px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Table name */}
          <div>
            <label className="label">Table Name</label>
            <input
              type="text"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder="Home Game"
              className="input-field"
            />
          </div>

          {/* Chip settings */}
          <div>
            <label className="label">Blind Structure</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <NumberInput label="Small Blind" value={smallBlind} onChange={setSmallBlind} step={5} min={1} max={500} />
              <NumberInput label="Big Blind" value={bigBlind} onChange={setBigBlind} step={5} min={2} max={1000} />
            </div>
          </div>

          {/* Blind preview */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <ChipIcon size={14} color="rgba(167,139,250,0.7)" />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              Blinds
            </span>
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600 }}>
              {smallBlind}/{bigBlind}
            </span>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: "auto" }}>
              Buy-in set at table
            </span>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)",
              color: "#fca5a5", fontSize: 13,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {/* Start Game button */}
          <button
            onClick={handleStartGame}
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", padding: "14px 0", borderRadius: 16, fontSize: 15 }}
          >
            {loading ? (
              <>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Creating room…
              </>
            ) : (
              <>
                <Play size={17} fill="white" />
                Start New Game
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Join Room button */}
          <button
            onClick={() => { setShowJoinModal(true); setJoinError(null); setRoomCode(""); }}
            className="btn-ghost"
            style={{ width: "100%" }}
          >
            Join Existing Room
          </button>
        </div>
      </div>

      {/* Join Room modal */}
      {showJoinModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            style={{
              width: "100%", maxWidth: 360,
              background: "rgba(22,18,40,0.97)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Thin purple accent line */}
            <div style={{
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8) 40%, rgba(167,139,250,0.9) 60%, transparent)",
            }} />

            <div style={{ padding: "22px 24px 24px" }}>
              <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: "0 0 4px", fontFamily: "Outfit, sans-serif" }}>
                Join a Room
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 20px" }}>
                Enter the 6-character room code from the host.
              </p>

              <input
                type="text"
                value={roomCode}
                onChange={e => { setRoomCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(null); }}
                onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
                placeholder="A3F9B2"
                maxLength={6}
                autoFocus
                style={{
                  width: "100%", padding: "14px 0", textAlign: "center",
                  fontSize: 28, fontWeight: 700, letterSpacing: "0.35em",
                  fontFamily: "Outfit, monospace", color: "#fff",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.6)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />

              {joinError && (
                <p style={{ color: "#f87171", fontSize: 12, margin: "8px 0 0", textAlign: "center" }}>
                  {joinError}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spin keyframe for loading button */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
