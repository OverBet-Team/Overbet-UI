"use client";

import { createRoom } from "./actions/room";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../hooks/useUser";

export default function HomeClient() {
  const router = useRouter();
  const { userId } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join Room modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleStartGame = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createRoom(userId, "My Poker Room");
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
    if (!code) {
      setJoinError("Please enter a room code.");
      return;
    }
    if (code.length !== 6) {
      setJoinError("Room codes are 6 characters (e.g. A3F9B2).");
      return;
    }
    router.push(`/room/${code}`);
  };

  return (
    <div className="flex flex-col w-full gap-4">
      <button
        onClick={handleStartGame}
        disabled={loading}
        className="flex items-center justify-center w-full font-bold text-white transition-all border shadow-lg h-14 rounded-xl bg-accent-1 hover:brightness-110 active:scale-[0.98] shadow-accent-1/20 border-white/10 text-lg disabled:opacity-50"
      >
        {loading ? "Creating..." : "Start New Game"}
      </button>

      {/* Error feedback — BUG-01 / UX-01 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 border rounded-xl bg-red-500/10 border-red-500/30 text-sm text-red-400">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Join Room button — BUG-03 */}
      <button
        onClick={() => { setShowJoinModal(true); setJoinError(null); setRoomCode(""); }}
        className="flex items-center justify-center w-full font-semibold text-white transition-all border h-14 rounded-xl bg-surface hover:bg-white/5 active:scale-[0.98] border-white/10 text-lg"
      >
        Join Room
      </button>

      {/* Join Room modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 border bg-surface rounded-2xl border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-1">Join a Room</h2>
            <p className="text-sm text-white/50 mb-5">Enter the 6-character room code shared by the host.</p>

            <input
              type="text"
              value={roomCode}
              onChange={e => { setRoomCode(e.target.value.toUpperCase().slice(0, 6)); setJoinError(null); }}
              onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
              placeholder="A3F9B2"
              maxLength={6}
              autoFocus
              className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.3em] bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/20 outline-none focus:border-accent-2/60 focus:ring-1 focus:ring-accent-2/30 transition-all mb-3"
            />

            {joinError && (
              <p className="text-sm text-red-400 mb-3">{joinError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinRoom}
                className="flex-1 py-3 rounded-xl bg-accent-1 text-white font-bold hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-accent-1/20"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
