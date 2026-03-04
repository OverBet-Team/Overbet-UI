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
    <div className="flex flex-col w-full gap-4">
      <button
        onClick={handleStartGame}
        disabled={loading}
        className="flex items-center justify-center w-full font-bold text-white transition-all border shadow-lg h-14 rounded-xl bg-accent-1 hover:brightness-110 active:scale-[0.98] shadow-accent-1/20 border-white/10 text-lg disabled:opacity-50"
      >
        {loading ? "Creating..." : "Start New Game"}
      </button>

      <button className="flex items-center justify-center w-full font-semibold text-white transition-all border h-14 rounded-xl bg-surface hover:bg-white/5 active:scale-[0.98] border-white/10 text-lg">
        Join Room
      </button>
    </div>
  );
}
