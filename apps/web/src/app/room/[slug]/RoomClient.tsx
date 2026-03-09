"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Copy, Users, Play, Settings, List } from "lucide-react";
import { PokerTable } from "@/components/poker/PokerTable";
import { ActionBar } from "@/components/poker/ActionBar";
import { BuyInModal } from "@/components/poker/BuyInModal";
import { GameLog } from "@/components/poker/GameLog";
import WinnerOverlay from "@/components/poker/WinnerOverlay";
import RaiseModal from "@/components/poker/RaiseModal";
import LogPanel from "@/components/poker/LogPanel";
import { PlayerData, TurnTimer } from "@/components/poker/Seat";
import { useUser } from "@/hooks/useUser";

interface RoomSettings {
  variant: string;
  smallBlind: number;
  bigBlind: number;
  autoStartDelay?: number;
  turnTimeout?: number;  // seconds
  timeBank?: number;     // seconds
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
  phase: string;
  board: string[];
  pot: number;
  sidePots?: { amount: number, eligiblePlayers: string[] }[];
  dealerId: string;
  activePlayerId: string;
  players: any[]; // Engine players are an array
  currentBet?: number;
  minRaise?: number;
  lastHandReveal?: {
    seed: number;
    commitment: string;
  };
}

interface RoomProps {
  slug: string;
  initialRoom: Room;
}

export default function RoomClient({ slug, initialRoom }: RoomProps) {
  const { userId } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);

  // Seat request state
  const [isBuyInOpen, setIsBuyInOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number>(-1);
  const [pendingRequests, setPendingRequests] = useState<{ playerId: string, seatIndex: number, stack: number, displayName?: string }[]>([]);
  const [showFairnessModal, setShowFairnessModal] = useState(false);
  const [currentCommitment, setCurrentCommitment] = useState<string>("");
  const [turnTimer, setTurnTimer] = useState<TurnTimer | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);
  const [winnerToast, setWinnerToast] = useState<{ winner: string; pot: number; handName?: string } | null>(null);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);

  // Removed local userId effect, now using useUser() hook

  useEffect(() => {
    if (!userId) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000", {
      query: { roomId: slug, userId }
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Connected to room:", slug);
      socketInstance.emit("INTENT_JOIN_ROOM", {
        schema_version: 1,
        room_id: slug,
        client_msg_id: Math.random().toString(36)
      });
      // Explicitly request snapshot on connect to sync pending requests and room status
      socketInstance.emit("INTENT_REQUEST_SNAPSHOT", {
        schema_version: 1,
        room_id: slug,
        client_msg_id: Math.random().toString(36)
      });
    });

    socketInstance.on("EVENT_ERROR", (err: any) => {
      console.error("Socket error:", err);
      alert(err.message || "An error occurred");
    });

    socketInstance.on("EVENT_HAND_LOG", (data: any) => {
      if (data.type === "HAND_INIT" && data.commitment) {
        setCurrentCommitment(data.commitment);
      }
      setLogs(prev => [...prev, { ...data, timestamp: Date.now() }]);
      if (data.type === "WIN" && data.payload) {
        const winnerId = data.payload.playerId;
        const amount = data.payload.amount ?? 0;
        const handName = data.payload.handName;
        setWinnerToast(prev => {
          const existing = prev?.pot ?? 0;
          return { winner: winnerId, pot: existing + amount, handName: handName || prev?.handName };
        });
      }
      if (data.type === "EARLY_WIN" && data.payload) {
        const winnerId = data.payload.winnerId;
        const amount = data.payload.amount ?? 0;
        setWinnerToast(prev => {
          const existing = prev?.pot ?? 0;
          return { winner: winnerId, pot: existing + amount };
        });
      }
    });

    socketInstance.on("EVENT_HAND_REVEAL", (data: any) => {
      // We could show a toast here, but for now just updating currentCommitment is handled via state update
      console.log("Hand revealed:", data);
    });

    socketInstance.on("ROOM_SNAPSHOT", (snapshot: { room: Room; players: PlayerData[]; pendingRequests?: any[] }) => {
      console.log("Snapshot received. Host:", snapshot.room.hostId, "Me:", userId);
      setRoom(snapshot.room);
      setPlayers(snapshot.players || []);
      setIsHost(snapshot.room.hostId === userId);
      if (snapshot.pendingRequests) {
        setPendingRequests(snapshot.pendingRequests);
      }
    });

    socketInstance.on("EVENT_SEAT_REQUEST_PENDING", (data: any) => {
      console.log("Pending seat request received:", data);
      setPendingRequests(prev => {
        const otherRequests = prev.filter(r => r.playerId !== data.playerId);
        return [...otherRequests, data];
      });
    });

    socketInstance.on("EVENT_SEAT_APPROVED", (data: any) => {
      setPendingRequests(prev => prev.filter(r => r.playerId !== data.playerId));
      setPlayers(prev => {
        const exists = prev.find(p => p.id === data.playerId);
        if (exists) return prev;
        return [...prev, {
          id: data.playerId,
          username: data.displayName || `Player_${data.playerId.substring(0, 4)}`,
          chips: data.stack,
          status: 'ACTIVE',
          seatIndex: data.seatIndex
        }];
      });
    });

    socketInstance.on("EVENT_STATE_UPDATE", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      setGameState(snapshot.state);
      if (snapshot.state.phase === "LOBBY" || snapshot.state.phase === "HAND_INIT") {
        setWinnerToast(null);
      }
      if (snapshot.state.phase !== "LOBBY") {
        setRoom(prev => prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev);
      }
      setTurnTimer(prev => (prev && snapshot.state.activePlayerId === prev.playerId) ? prev : null);
    });

    socketInstance.on("EVENT_STATE_SNAPSHOT", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      setGameState(snapshot.state);
      if (snapshot.state.phase === "LOBBY" || snapshot.state.phase === "HAND_INIT") {
        setWinnerToast(null);
      }
      if (snapshot.state.phase !== "LOBBY") {
        setRoom(prev => prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev);
      }
      setTurnTimer(prev => (prev && snapshot.state.activePlayerId === prev.playerId) ? prev : null);
    });

    socketInstance.on("EVENT_TURN_TIMER", (data: any) => {
      console.log("Turn timer started:", data);
      setTurnTimer(data as TurnTimer);
    });

    socketInstance.on("EVENT_SETTINGS_UPDATED", (data: any) => {
      setRoom(prev => ({ ...prev, settings: data.settings }));
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

  const openBuyInModal = (seatIndex: number) => {
    const isTaken = players.some(p => p.seatIndex === seatIndex);
    if (isTaken) return;
    setSelectedSeat(seatIndex);
    setIsBuyInOpen(true);
  };

  const handleSeatRequest = (amount: number, displayName: string) => {
    console.log("Sending seat request for seat:", selectedSeat, "with stack:", amount);
    socket?.emit("INTENT_SEAT_REQUEST", {
      room_id: slug,
      seatIndex: selectedSeat,
      stack: amount,
      displayName: displayName // Send the custom display name
    });

    setIsBuyInOpen(false);
  };

  const approveSeat = (playerId: string) => {
    socket?.emit("INTENT_SEAT_APPROVE", { room_id: slug, targetPlayerId: playerId });
  };

  const handleStartGame = () => {
    socket?.emit("INTENT_START_GAME", { room_id: slug });
  };

  const handleAction = (type: string, amount?: number) => {
    socket?.emit("INTENT_PLAYER_ACTION", {
      room_id: slug,
      action: { type, amount }
    });
  };

  const handleOpenSettings = () => {
    setSettingsDraft({ ...room.settings });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = () => {
    if (!settingsDraft) return;
    socket?.emit("INTENT_UPDATE_SETTINGS", {
      room_id: slug,
      settings: settingsDraft
    });
    setShowSettingsModal(false);
  };

  if (!room) return <div className="flex items-center justify-center min-h-screen">Loading room...</div>;

  // Sync gameState.players with local players array for rendering
  const mappedPlayers: PlayerData[] = [
    ...players.map(p => {
      // Game state players is an array from the engine
      const gPlayer = Array.isArray(gameState?.players)
        ? gameState.players.find(gp => gp.id === p.id)
        : (gameState?.players as any)?.[p.id];

      if (gPlayer) {
        return {
          ...p,
          chips: gPlayer.chips ?? gPlayer.stack ?? p.chips,
          bet: gPlayer.bet || 0,
          cards: gPlayer.cards || gPlayer.holeCards || []
        } as PlayerData;
      }
      return p as PlayerData;
    }),
    // CRITICAL FIX: Merge pending requests into the table players
    ...pendingRequests
      .filter(req => !players.some(p => p.id === req.playerId)) // Don't duplicate if already seated
      .map(req => ({
        id: req.playerId,
        username: req.displayName || `Player_${req.playerId.substring(0, 4)}`,
        chips: req.stack,
        status: 'PENDING' as any,
        seatIndex: req.seatIndex,
        bet: 0,
        cards: []
      } as PlayerData))
  ];

  if (room.status === "LOBBY") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 w-full">
        <BuyInModal
          isOpen={isBuyInOpen}
          onClose={() => setIsBuyInOpen(false)}
          onSubmit={handleSeatRequest}
          minAmount={room.settings?.smallBlind * 50 || 1000}
          maxAmount={room.settings?.bigBlind * 200 || 4000}
          seatIndex={selectedSeat}
          isGuest={true} // For now, treat all as guests for testing name input
          initialDisplayName=""
        />

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
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {players.length === 0 ? (
                  <p className="text-white/30 italic text-sm">No players yet...</p>
                ) : (
                  players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5 text-sm">
                      <span className="font-medium">{p.username}</span>
                      <span className="text-accent-2 font-mono">${p.chips}</span>
                      {room.hostId === p.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-1/20 text-accent-1 border border-accent-1/30">HOST</span>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border rounded-xl bg-black/20 border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-accent-2 font-semibold">
                  <Settings size={20} />
                  <h2>Settings</h2>
                </div>
                {isHost && (
                  <button
                    onClick={handleOpenSettings}
                    className="text-[10px] px-2 py-1 rounded border border-accent-2/30 bg-accent-2/10 text-accent-2 hover:bg-accent-2/20 transition-colors font-bold uppercase tracking-wider"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Variant</span>
                  <span className="font-medium">{room.settings?.variant || "NLH"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Blinds</span>
                  <span className="font-medium">{room.settings?.smallBlind || 10}/{room.settings?.bigBlind || 20}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Turn Time</span>
                  <span className="font-medium">{room.settings?.turnTimeout || 30}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Time Bank</span>
                  <span className="font-medium">{room.settings?.timeBank || 30}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Auto-Start</span>
                  <span className="font-medium">{room.settings?.autoStartDelay || 5}s</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-10">
            {isHost && pendingRequests.length > 0 && (
              <div className="mb-6 p-4 border border-accent-1/30 bg-accent-1/5 rounded-xl">
                <h3 className="text-sm font-bold text-accent-1 uppercase tracking-wider mb-3">Pending Seat Requests</h3>
                <div className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.playerId} className="flex items-center justify-between p-2 bg-black/40 rounded-lg">
                      <span className="text-xs font-medium">
                        {req.displayName || `Player_${req.playerId.substring(0, 4)}`} (Seat {req.seatIndex + 1}, ${req.stack})
                      </span>
                      <button
                        onClick={() => approveSeat(req.playerId)}
                        className="px-3 py-1 bg-accent-1 text-white text-[10px] font-bold rounded hover:brightness-110"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full py-4 font-bold text-white transition-all border shadow-lg rounded-xl bg-accent-1 hover:brightness-110 active:scale-[0.98] shadow-accent-1/20 border-white/10 text-lg"
              >
                <Play size={20} className="mr-2" />
                Start Game
              </button>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-white/70 font-semibold mb-2">Claim a seat below to join this game.</p>
                </div>

                {pendingRequests.find(r => r.playerId === userId) && (
                  <div className="p-4 border border-accent-2/30 bg-accent-2/5 rounded-xl animate-pulse flex items-center gap-3">
                    <div className="w-2 h-2 bg-accent-2 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                    <span className="text-xs font-bold text-accent-2 uppercase tracking-wider">Waiting for Host Approval...</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-center text-sm text-white/30">
              {isHost && players.length < 2 ? "Waiting for players..." : ""}
            </p>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettingsModal && settingsDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 border bg-surface rounded-2xl border-white/10 shadow-2xl relative">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="absolute top-4 right-4 text-white/30 hover:text-white text-xl"
              >✕</button>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="text-accent-2" size={20} />
                Room Settings
              </h2>

              <div className="space-y-5">
                {/* Turn Timeout */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Turn Time</label>
                    <span className="text-accent-1 font-mono font-bold text-sm">{settingsDraft.turnTimeout || 30}s</span>
                  </div>
                  <input
                    type="range" min={10} max={120} step={5}
                    value={settingsDraft.turnTimeout || 30}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, turnTimeout: Number(e.target.value) } : prev)}
                    className="w-full accent-accent-1"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>10s</span><span>120s</span>
                  </div>
                </div>

                {/* Time Bank */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Time Bank</label>
                    <span className="text-orange-400 font-mono font-bold text-sm">{settingsDraft.timeBank || 30}s</span>
                  </div>
                  <input
                    type="range" min={0} max={120} step={5}
                    value={settingsDraft.timeBank || 30}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, timeBank: Number(e.target.value) } : prev)}
                    className="w-full accent-orange-400"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>0s (off)</span><span>120s</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1 italic">Extra time pool per player. Activates after turn time expires.</p>
                </div>

                {/* Auto-Start Delay */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Auto-Start Delay</label>
                    <span className="text-accent-2 font-mono font-bold text-sm">{settingsDraft.autoStartDelay || 5}s</span>
                  </div>
                  <input
                    type="range" min={2} max={30} step={1}
                    value={settingsDraft.autoStartDelay || 5}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, autoStartDelay: Number(e.target.value) } : prev)}
                    className="w-full accent-accent-2"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>2s</span><span>30s</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1 italic">Seconds between hand end and next hand start.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 py-2 rounded-xl bg-accent-1 text-white font-bold text-sm hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-accent-1/20"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini Preview Table for seating */}
        <div className="mt-12 w-full flex justify-center scale-75 origin-top">
          <PokerTable
            players={mappedPlayers}
            dealerId=""
            activePlayerId=""
            userId={userId}
            board={[]}
            pots={[]}
            handleSeatClick={openBuyInModal}
            turnTimer={null}
          />
        </div>
      </div>
    );
  }

  // GAME TABLE VIEW
  const myPlayerInfo = Array.isArray(gameState?.players) 
    ? gameState.players.find(p => p.id === userId)
    : null;
    
  const isActivePlayer = gameState?.activePlayerId === userId;

  // Format pots for PokerTable
  const displayPots = [];
  if (gameState?.pot && gameState.pot > 0) displayPots.push({ amount: gameState.pot, type: 'MAIN' });
  if (gameState?.sidePots) {
    gameState.sidePots.forEach(sp => displayPots.push({ amount: sp.amount, type: 'SIDE' }));
  }


  return (
    <div className="flex flex-col lg:flex-row items-start justify-center min-h-[calc(100vh-80px)] p-4 overflow-hidden w-full gap-8">
      <div className="flex flex-col items-center flex-1 w-full relative pt-12">
        <BuyInModal
          isOpen={isBuyInOpen}
          onClose={() => setIsBuyInOpen(false)}
          onSubmit={handleSeatRequest}
          minAmount={room.settings?.smallBlind * 50 || 1000}
          maxAmount={room.settings?.bigBlind * 200 || 4000}
          seatIndex={selectedSeat}
          isGuest={true}
          initialDisplayName=""
        />

        <PokerTable
          players={mappedPlayers}
          dealerId={gameState?.dealerId || ""}
          activePlayerId={gameState?.activePlayerId || ""}
          userId={userId}
          board={gameState?.board || []}
          pots={displayPots}
          handleSeatClick={openBuyInModal}
          turnTimer={turnTimer}
        />

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {isHost && (
            <button
              onClick={handleOpenSettings}
              className="p-2 border rounded-full bg-surface/50 border-white/10 hover:bg-white/10 transition-colors text-white/50 hover:text-accent-2"
              title="Room Settings"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            onClick={() => setShowLogPanel(p => !p)}
            className="p-2 border rounded-full bg-surface/50 border-white/10 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Game Log"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setShowFairnessModal(true)}
            className="p-2 border rounded-full bg-surface/50 border-white/10 hover:bg-white/10 transition-colors text-white/50 hover:text-accent-1"
            title="Provably Fair Info"
          >
            🔒
          </button>
        </div>

        {showLogPanel && (
          <LogPanel
            logs={logs}
            players={mappedPlayers}
            onClose={() => setShowLogPanel(false)}
          />
        )}

        {winnerToast && (
          <WinnerOverlay
            winner={mappedPlayers.find(p => p.id === winnerToast.winner)?.username ?? winnerToast.winner}
            pot={winnerToast.pot}
            handName={winnerToast.handName}
            onDismiss={() => setWinnerToast(null)}
          />
        )}

        {showRaiseModal && (
          <RaiseModal
            minRaise={Math.max((gameState?.currentBet ?? 0) + (gameState?.minRaise ?? room.settings?.bigBlind ?? 10), 1)}
            maxRaise={(myPlayerInfo?.stack ?? 0) + (myPlayerInfo?.bet ?? 0)}
            currentBet={gameState?.currentBet ?? 0}
            onConfirm={(amount) => {
              handleAction("RAISE", amount);
              setShowRaiseModal(false);
            }}
            onCancel={() => setShowRaiseModal(false)}
          />
        )}

        {/* Settings Modal (available in-game for host) */}
        {showSettingsModal && settingsDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 border bg-surface rounded-2xl border-white/10 shadow-2xl relative">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="absolute top-4 right-4 text-white/30 hover:text-white text-xl"
              >✕</button>
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Settings className="text-accent-2" size={20} />
                Room Settings
              </h2>
              <p className="text-[10px] text-white/30 mb-6 italic">Changes take effect on the next hand.</p>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Turn Time</label>
                    <span className="text-accent-1 font-mono font-bold text-sm">{settingsDraft.turnTimeout || 30}s</span>
                  </div>
                  <input
                    type="range" min={10} max={120} step={5}
                    value={settingsDraft.turnTimeout || 30}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, turnTimeout: Number(e.target.value) } : prev)}
                    className="w-full accent-accent-1"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>10s</span><span>120s</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Time Bank</label>
                    <span className="text-orange-400 font-mono font-bold text-sm">{settingsDraft.timeBank || 30}s</span>
                  </div>
                  <input
                    type="range" min={0} max={120} step={5}
                    value={settingsDraft.timeBank || 30}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, timeBank: Number(e.target.value) } : prev)}
                    className="w-full accent-orange-400"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>0s (off)</span><span>120s</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1 italic">Extra time pool per player. Activates after turn time expires.</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-semibold text-white/80">Auto-Start Delay</label>
                    <span className="text-accent-2 font-mono font-bold text-sm">{settingsDraft.autoStartDelay || 5}s</span>
                  </div>
                  <input
                    type="range" min={2} max={30} step={1}
                    value={settingsDraft.autoStartDelay || 5}
                    onChange={e => setSettingsDraft(prev => prev ? { ...prev, autoStartDelay: Number(e.target.value) } : prev)}
                    className="w-full accent-accent-2"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                    <span>2s</span><span>30s</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1 italic">Seconds between hand end and next hand start.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 py-2 rounded-xl bg-accent-1 text-white font-bold text-sm hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-accent-1/20"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {showFairnessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 border bg-surface rounded-2xl border-white/10 shadow-2xl relative">
              <button
                onClick={() => setShowFairnessModal(false)}
                className="absolute top-4 right-4 text-white/30 hover:text-white"
              >
                ✕
              </button>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings className="text-accent-1" size={20} />
                Fairness & Integrity
              </h2>

              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-2">Current Hand Commitment</label>
                  <div className="font-mono text-[10px] break-all bg-black/30 p-2 rounded border border-white/5">
                    {currentCommitment || "Waiting for hand..."}
                  </div>
                  <p className="mt-2 text-[10px] text-white/30 leading-relaxed italic">
                    This SHA-256 hash was generated before any cards were dealt, proving the deck order is fixed and unchangeable.
                  </p>
                </div>

                {gameState?.lastHandReveal && (
                  <div className="p-4 rounded-xl bg-accent-1/5 border border-accent-1/20 animate-in fade-in slide-in-from-bottom-2">
                    <label className="text-[10px] text-accent-1 font-bold uppercase tracking-wider block mb-2 flex items-center justify-between">
                      Last Hand Revealed
                      <span className="bg-accent-1/20 text-[8px] px-1.5 py-0.5 rounded text-accent-1 border border-accent-1/30">VERIFIED</span>
                    </label>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[9px] text-white/50 block">Revealed Seed</span>
                        <code className="text-sm font-mono text-accent-1">{gameState.lastHandReveal.seed}</code>
                      </div>
                      <div>
                        <span className="text-[9px] text-white/50 block">Matching Commitment</span>
                        <code className="text-[9px] font-mono text-white/40 break-all">{gameState.lastHandReveal.commitment}</code>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-white/30 text-center px-4">
                  Absolute randomness ensures that even the server host cannot see your cards until they are revealed.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col w-full max-w-xl gap-6 mt-16">
          <div className="flex gap-4">
            <div className="flex items-center justify-between flex-1 p-4 border bg-surface border-white/5 rounded-2xl">
              <div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Your Hand</div>
                <div className="flex gap-2 mt-1">
                  {myPlayerInfo?.holeCards?.map((card: string, i: number) => (
                    <div key={i} className="flex items-center justify-center w-10 text-sm font-bold text-black bg-white shadow-lg rounded-md h-14">
                      {card}
                    </div>
                  )) || (
                      <>
                        <div className="flex items-center justify-center w-10 border rounded-md h-14 bg-accent-1/20 border-accent-1/30">
                          <div className="w-4 h-6 border rounded-sm border-accent-1/50"></div>
                        </div>
                        <div className="flex items-center justify-center w-10 border rounded-md h-14 bg-accent-1/20 border-accent-1/30">
                          <div className="w-4 h-6 border rounded-sm border-accent-1/50"></div>
                        </div>
                      </>
                    )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Your Stack</div>
                <div className="mt-1 text-2xl font-black text-accent-1">${myPlayerInfo?.stack || "---"}</div>
              </div>
            </div>
          </div>

          <ActionBar
            isActive={isActivePlayer}
            stack={myPlayerInfo?.stack || 0}
            currentBet={gameState?.currentBet || 0}
            playerBet={myPlayerInfo?.bet || 0}
            minRaise={gameState?.minRaise || 0}
            onAction={handleAction}
            onOpenRaiseModal={() => setShowRaiseModal(true)}
          />

          {isHost && pendingRequests.length > 0 && (
            <div className="mt-8 p-4 border border-accent-1/30 bg-accent-1/5 rounded-xl">
              <h3 className="text-xs font-bold text-accent-1 uppercase tracking-wider mb-3">Pending Seat Requests</h3>
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.playerId} className="flex items-center justify-between p-2 bg-black/40 rounded-lg">
                    <span className="text-xs font-medium">
                      {req.displayName || `Player_${req.playerId.substring(0, 4)}`} (Seat {req.seatIndex + 1}, ${req.stack})
                    </span>
                    <button
                      onClick={() => approveSeat(req.playerId)}
                      className="px-3 py-1 bg-accent-1 text-white text-[10px] font-bold rounded hover:brightness-110"
                    >
                      Approve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requester Status Banner */}
          {!isHost && pendingRequests.some(r => r.playerId === userId) && (
            <div className="mt-8 p-4 border border-accent-2/30 bg-accent-2/5 rounded-xl animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-accent-2 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                <h3 className="text-xs font-bold text-accent-2 uppercase tracking-wider">Request Pending Approval</h3>
              </div>
              <p className="mt-2 text-[10px] text-white/50 leading-relaxed">
                Your request for a seat has been sent to the host. Once approved, you'll be automatically seated and ready to play.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 mt-8 lg:mt-0">
        <GameLog logs={logs} players={mappedPlayers} />
      </div>
    </div>
  );
}
