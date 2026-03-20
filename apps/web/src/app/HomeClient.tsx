"use client";

import { createRoom } from "./actions/room";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../hooks/useUser";
import Plus from 'lucide-react/dist/esm/icons/plus'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Play from 'lucide-react/dist/esm/icons/play'
import { ChipIcon } from "@/components/poker/ChipAmount";

// ── Moon Poker logo mark ──────────────────────────────────────────────────────
function MoonLogo({ size = 32 }: { size?: number }) {
  const chip = Math.round(size * 0.69);
  const gap = Math.round(size * 0.27);
  return (
    <div style={{ position: "relative", width: size, height: chip, flexShrink: 0 }}>
      <div style={{
        position: "absolute", width: chip, height: chip,
        borderRadius: "50%", background: "var(--gold)", left: 0,
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
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest text-center font-body">
        {label}
      </span>
      <span className="text-white font-bold text-lg font-body num-font">
        {value}
      </span>
      <div className="flex items-center gap-2">
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
    <div
      className="font-body bg-[--bg-base] min-h-dvh flex items-center justify-center overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch", padding: "20px 16px" }}
    >
      {/* Background glow */}
      <div className="fixed pointer-events-none top-1/5 left-1/2 -translate-x-1/2 w-3/5 h-2/5 bg-[--accent]/[0.12] blur-[40px]" />

      {/* Setup card */}
      <div className="relative w-full max-w-[460px] rounded-2xl overflow-hidden bg-[--bg-surface] border border-white/[0.08] shadow-2xl flex-shrink-0">
        {/* Header */}
        <div className="px-8 py-7 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 mb-1.5">
            <MoonLogo size={30} />
            <span className="text-white font-bold text-xl font-display tracking-tight">
              OverBet
            </span>
          </div>
          <p className="text-white/35 text-[13px] m-0">
            Set up your home game
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6 pb-7 flex flex-col gap-5">

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
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <ChipIcon size={14} color="rgba(167,139,250,0.7)" />
            <span className="text-white/35 text-xs">
              Blinds
            </span>
            <span className="text-white/75 text-xs font-semibold">
              {smallBlind}/{bigBlind}
            </span>
            <span className="text-white/25 text-[11px] ml-auto">
              Buy-in set at table
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[--danger]/10 border border-[--danger]/25 text-red-300 text-[13px]">
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
            className="btn-primary w-full py-3.5 rounded-2xl text-[15px]"
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
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-white/20 text-[11px] font-medium">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
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
            className="w-full max-w-[360px] bg-[--bg-surface] border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Thin accent line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[--accent]/80 to-transparent" />

            <div className="px-6 py-5 pb-6">
              <h2 className="text-white font-bold text-lg m-0 mb-1 font-display">
                Join a Room
              </h2>
              <p className="text-white/40 text-[13px] m-0 mb-5">
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
                className="w-full py-3.5 text-center text-[28px] font-bold tracking-[0.35em] font-mono text-white bg-white/[0.06] border border-white/12 rounded-xl outline-none num-font focus:border-[--accent]/60 transition-colors box-border"
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
