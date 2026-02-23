"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Copy, Users, Play, Settings } from "lucide-react";

interface Player {
  id: string;
  username: string;
}

interface RoomSettings {
  variant: string;
  smallBlind: number;
  bigBlind: number;
}

interface Room {
  id: string;
  slug: string;
  name: string;
  status: string;
  hostId: string;
  settings: RoomSettings;
}

interface GameState {
  board: { rank: string; suit: string }[];
  pot: number;
  dealerId: string;
  activePlayerId: string;
  players: Record<string, { chips: number; cards?: { rank: string; suit: string }[] }>;
}

interface RoomProps {
  slug: string;
  initialRoom: Room;
}

export default function RoomClient({ slug, initialRoom }: RoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    // Generate a consistent userId for the session
    const storedId = localStorage.getItem("overbet_user_id");
    const id = storedId || "user-" + Math.random().toString(36).substring(2, 9);
    if (!storedId) localStorage.setItem("overbet_user_id", id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001", {
      query: { roomId: slug, userId }
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Connected to room:", slug);
    });

    socketInstance.on("ROOM_SNAPSHOT", (snapshot: { room: Room; players: Player[] }) => {
      setRoom(snapshot.room);
      setPlayers(snapshot.players || []);
      setIsHost(snapshot.room.hostId === userId);
    });

    socketInstance.on("EVENT_SEAT_APPROVED", (data: { player: Player }) => {
        setPlayers(prev => [...prev, data.player]);
    });

    socketInstance.on("GAME_SNAPSHOT", (snapshot: GameState) => {
        setGameState(snapshot);
        setRoom(prev => {
            if (prev.status !== "INGAME") {
                return { ...prev, status: "INGAME" };
            }
            return prev;
        });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [slug, userId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSeatRequest = () => {
    socket?.emit("INTENT_SEAT_REQUEST", { userId, username: `Player_${userId.substring(5, 9)}` });
  };

  const handleStartGame = () => {
    socket?.emit("INTENT_START_GAME", { roomId: slug });
  };

  if (!room) return <div className="flex items-center justify-center min-h-screen">Loading room...</div>;

  if (room.status === "LOBBY") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="w-full max-w-2xl p-8 border bg-surface rounded-2xl border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">{room.name}</h1>
              <p className="text-white/50">Room ID: {slug}</p>
            </div>
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2 transition-all border rounded-lg bg-white/5 border-white/10 hover:bg-white/10 active:scale-95 ${copied ? 'text-green-400 border-green-400/30 bg-green-400/5' : ''}`}
            >
              <Copy size={18} />
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-6 border rounded-xl bg-black/20 border-white/5">
              <div className="flex items-center gap-2 mb-4 text-accent-1 font-semibold">
                <Users size={20} />
                <h2>Players ({players.length})</h2>
              </div>
              <div className="space-y-2">
                {players.length === 0 ? (
                  <p className="text-white/30 italic text-sm">No players yet...</p>
                ) : (
                  players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <span className="font-medium">{p.username}</span>
                      {room.hostId === p.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-1/20 text-accent-1 border border-accent-1/30">HOST</span>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border rounded-xl bg-black/20 border-white/5">
              <div className="flex items-center gap-2 mb-4 text-accent-2 font-semibold">
                <Settings size={20} />
                <h2>Settings</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Variant</span>
                  <span className="font-medium">{room.settings?.variant || "NLH"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Blinds</span>
                  <span className="font-medium">{room.settings?.smallBlind}/{room.settings?.bigBlind}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-10">
            {isHost ? (
              <button
                onClick={handleStartGame}
                className="flex items-center justify-center w-full py-4 font-bold text-white transition-all border shadow-lg rounded-xl bg-accent-1 hover:brightness-110 active:scale-[0.98] shadow-accent-1/20 border-white/10 text-lg"
              >
                <Play size={20} className="mr-2" />
                Start Game
              </button>
            ) : (
              <button
                onClick={handleSeatRequest}
                className="flex items-center justify-center w-full py-4 font-bold text-white transition-all border shadow-lg rounded-xl bg-accent-2 hover:brightness-110 active:scale-[0.98] shadow-accent-2/20 border-white/10 text-lg"
              >
                Request a Seat
              </button>
            )}
            <p className="text-center text-sm text-white/30">
              {isHost ? "Ready to shuffle?" : "Wait for the host to start the game."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // GAME TABLE VIEW
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 overflow-hidden">
        <div className="relative w-full max-w-5xl aspect-[2.1/1] bg-emerald-900/30 border-[12px] border-amber-900/40 rounded-[200px] shadow-2xl flex items-center justify-center">
            <div className="absolute inset-4 border-2 border-white/5 rounded-[180px]"></div>
            
            <div className="text-center">
                <div className="text-4xl font-bold text-white/10 uppercase tracking-[0.2em]">OverBet</div>
                
                <div className="mt-8 flex gap-3 justify-center">
                    {(gameState?.board || [null, null, null, null, null]).map((card, i) => (
                        <div key={i} className={`w-14 h-20 rounded-lg border flex items-center justify-center text-lg font-bold shadow-md transition-all ${card ? 'bg-white text-black border-white' : 'bg-black/20 border-white/10'}`}>
                            {card ? `${card.rank}${card.suit}` : ""}
                        </div>
                    ))}
                </div>

                {gameState && gameState.pot > 0 && (
                    <div className="mt-6 flex justify-center">
                        <div className="bg-black/40 px-4 py-2 rounded-full border border-accent-1/20 text-accent-1 font-bold text-sm shadow-lg backdrop-blur-sm">
                            POT: ${gameState.pot}
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <PlayerNode player={players[0]} gameState={gameState} userId={userId} />
            </div>
            <div className="absolute top-1/4 right-0 translate-x-1/2 -translate-y-1/2">
                <PlayerNode player={players[1]} gameState={gameState} userId={userId} />
            </div>
            <div className="absolute bottom-1/4 right-0 translate-x-1/2 translate-y-1/2">
                <PlayerNode player={players[2]} gameState={gameState} userId={userId} />
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                <PlayerNode player={players[3]} gameState={gameState} userId={userId} />
            </div>
            <div className="absolute bottom-1/4 left-0 -translate-x-1/2 translate-y-1/2">
                <PlayerNode player={players[4]} gameState={gameState} userId={userId} />
            </div>
            <div className="absolute top-1/4 left-0 -translate-x-1/2 -translate-y-1/2">
                <PlayerNode player={players[5]} gameState={gameState} userId={userId} />
            </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 w-full max-w-xl">
            <div className="flex gap-4">
                <div className="flex-1 bg-surface border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Your Hand</div>
                        <div className="flex gap-2 mt-1">
                            {gameState?.players?.[userId]?.cards?.map((card, i) => (
                                <div key={i} className="w-10 h-14 bg-white text-black rounded-md flex items-center justify-center font-bold text-sm shadow-lg">
                                    {card.rank}{card.suit}
                                </div>
                            )) || (
                                <>
                                    <div className="w-10 h-14 bg-accent-1/20 border border-accent-1/30 rounded-md flex items-center justify-center">
                                        <div className="w-4 h-6 border border-accent-1/50 rounded-sm"></div>
                                    </div>
                                    <div className="w-10 h-14 bg-accent-1/20 border border-accent-1/30 rounded-md flex items-center justify-center">
                                        <div className="w-4 h-6 border border-accent-1/50 rounded-sm"></div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Your Stack</div>
                        <div className="text-2xl font-black text-accent-1 mt-1">${gameState?.players?.[userId]?.chips || "---"}</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 active:scale-95 transition-all text-white/70">Fold</button>
                <button className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 active:scale-95 transition-all text-white">Call</button>
                <button className="flex-1 py-4 bg-accent-1 border border-white/10 rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all text-white shadow-lg shadow-accent-1/20">Raise</button>
            </div>
        </div>
    </div>
  );
}

function PlayerNode({ player, gameState, userId }: { player: Player | undefined; gameState: GameState | null; userId: string }) {
    if (!player) return null;
    const isDealer = gameState?.dealerId === player.id;
    const isActive = gameState?.activePlayerId === player.id;
    const isSelf = player.id === userId;
    const chips = gameState?.players?.[player.id]?.chips ?? 1000;
    
    return (
        <div className="flex flex-col items-center gap-2 group">
            <div className={`w-16 h-16 rounded-full bg-surface border-4 flex items-center justify-center text-xl font-black shadow-2xl transition-all duration-300 relative ${isActive ? 'border-accent-1 scale-110 ring-4 ring-accent-1/20' : 'border-white/10 group-hover:border-white/20'}`}>
                {player.username?.[0]}
                {isDealer && (
                    <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white text-black text-[10px] flex items-center justify-center font-bold border-2 border-surface shadow-md">
                        D
                    </div>
                )}
            </div>
            <div className="flex flex-col items-center gap-0.5">
                <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all ${isActive ? 'bg-accent-1 border-accent-1 text-white shadow-lg shadow-accent-1/30' : 'bg-black/60 border-white/10 text-white/80'}`}>
                    {player.username} {isSelf && "(You)"}
                </div>
                <div className="bg-accent-2/10 px-2 py-0.5 rounded-md border border-accent-2/20 text-[10px] font-mono font-bold text-accent-2 shadow-sm">
                    ${chips}
                </div>
            </div>
        </div>
    );
}
