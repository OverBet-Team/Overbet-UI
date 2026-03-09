"use client";

import { createRoom } from "./actions/room";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "../hooks/useUser";

export default function HomeClient() {
  const router = useRouter();
  const { userId } = useUser();
  const [loading, setLoading] = useState(false);

  const handleStartGame = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await createRoom(userId, "My Poker Room");
      if (res.success) {
        router.push(`/room/${res.roomSlug}`);
      }
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-4 max-w-sm mx-auto">
      <button
        onClick={handleStartGame}
        disabled={loading}
        className="flex items-center justify-center w-full font-bold text-white transition-all border h-14 rounded-2xl px-6 action-btn disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
          borderColor: "rgba(167,139,250,0.4)",
          boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
        }}
      >
        {loading ? "Creating..." : "Start New Game"}
      </button>

      <button
        className="flex items-center justify-center w-full font-semibold text-white transition-all border h-14 rounded-2xl px-6 border-white/10 hover:bg-white/5 active:scale-[0.98]"
        style={{ background: "rgba(18, 15, 32, 0.95)" }}
      >
        Join Room
      </button>
    </div>
  );
}
