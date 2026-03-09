"use client";

import { useEffect, useState } from "react";
import { Copy, Users, Play, Settings } from "lucide-react";

interface RoomSettings {
  variant?: string;
  smallBlind?: number;
  bigBlind?: number;
  turnTimeout?: number;
  timeBank?: number;
  autoStartDelay?: number;
}

interface Room {
  id: string;
  slug: string;
  name: string;
  status: string;
  hostId: string;
  settings: RoomSettings;
}

interface PlayerData {
  id: string;
  username: string;
  chips: number;
  status: string;
  seatIndex: number;
}

interface RoomOverlayProps {
  room: Room;
  players: PlayerData[];
  isHost: boolean;
  pendingRequests: { playerId: string; seatIndex: number; stack: number; displayName?: string }[];
  onClose: () => void;
  onCopyLink: () => void;
  onStartGame: () => void;
  onApproveSeat: (playerId: string) => void;
  onOpenSettings: () => void;
  userId: string;
  copied: boolean;
}

export function RoomOverlay({
  room,
  players,
  isHost,
  pendingRequests,
  onClose,
  onCopyLink,
  onStartGame,
  onApproveSeat,
  onOpenSettings,
  userId,
  copied,
}: RoomOverlayProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const content = (
    <div
      className="w-full max-w-md overflow-y-auto"
      style={{
        background: "rgba(22, 18, 40, 0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{room.name}</h2>
            <p className="text-sm text-white/50">Room ID: {room.slug}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <button
          onClick={onCopyLink}
          className={`flex items-center gap-2 w-full justify-center px-4 py-2 rounded-xl border transition-all mb-6 ${
            copied
              ? "text-green-400 border-green-400/30 bg-green-400/10"
              : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
          }`}
        >
          <Copy size={18} />
          {copied ? "Copied!" : "Copy Link"}
        </button>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2 mb-3 text-accent-1 font-semibold text-sm">
              <Users size={18} />
              Players ({players.length})
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-white/30 italic text-sm">No players yet...</p>
              ) : (
                players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded bg-white/5 text-sm"
                  >
                    <span className="font-medium text-white/90">{p.username}</span>
                    <span className="text-accent-2 font-mono text-xs">${p.chips}</span>
                    {room.hostId === p.id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-1/20 text-accent-1 border border-accent-1/30">
                        HOST
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="p-4 rounded-xl"
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-accent-2 font-semibold text-sm">
                <Settings size={18} />
                Settings
              </div>
              {isHost && (
                <button
                  onClick={onOpenSettings}
                  className="text-[10px] px-2 py-1 rounded border border-accent-2/30 bg-accent-2/10 text-accent-2 hover:bg-accent-2/20 transition-colors font-bold uppercase tracking-wider"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Variant</span>
                <span className="font-medium">{room.settings?.variant || "NLH"}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Blinds</span>
                <span className="font-medium">
                  {room.settings?.smallBlind ?? 10}/{room.settings?.bigBlind ?? 20}
                </span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Turn Time</span>
                <span className="font-medium">{room.settings?.turnTimeout ?? 30}s</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Time Bank</span>
                <span className="font-medium">{room.settings?.timeBank ?? 30}s</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Auto-Start</span>
                <span className="font-medium">{room.settings?.autoStartDelay ?? 5}s</span>
              </div>
            </div>
          </div>
        </div>

        {isHost && pendingRequests.length > 0 && (
          <div
            className="mb-6 p-4 rounded-xl"
            style={{ border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.08)" }}
          >
            <h3 className="text-xs font-bold text-accent-1 uppercase tracking-wider mb-3">
              Pending Seat Requests
            </h3>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.playerId}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ background: "rgba(0,0,0,0.4)" }}
                >
                  <span className="text-xs font-medium text-white/90">
                    {req.displayName || `Player_${req.playerId.substring(0, 4)}`} (Seat {req.seatIndex + 1}, ${req.stack})
                  </span>
                  <button
                    onClick={() => onApproveSeat(req.playerId)}
                    className="px-3 py-1 bg-accent-1 text-white text-[10px] font-bold rounded hover:brightness-110"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {room.status === "LOBBY" && isHost ? (
            <button
              onClick={onStartGame}
              disabled={players.length < 2}
              className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full py-4 font-bold text-white transition-all border rounded-xl hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                borderColor: "rgba(167,139,250,0.4)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
              }}
            >
              <Play size={20} className="mr-2" />
              Start Game
            </button>
          ) : (
            <div className="space-y-3">
              <div
                className="text-center p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <p className="text-white/70 font-semibold text-sm">Claim a seat at the table to join this game.</p>
              </div>
              {pendingRequests.some((r) => r.playerId === userId) && (
                <div
                  className="p-4 rounded-xl animate-pulse flex items-center gap-3"
                  style={{ border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.08)" }}
                >
                  <div className="w-2 h-2 rounded-full bg-[#eab308]" />
                  <span className="text-xs font-bold text-[#eab308] uppercase tracking-wider">
                    Waiting for Host Approval...
                  </span>
                </div>
              )}
            </div>
          )}
          {room.status === "LOBBY" && isHost && players.length < 2 && (
            <p className="text-center text-sm text-white/30">Waiting for players...</p>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <div
          className="rounded-t-2xl overflow-hidden bg-[#16122a]"
          style={{ maxHeight: "85vh", animation: "slideUp 0.3s ease-out forwards" }}
        >
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
    >
      {content}
    </div>
  );
}
