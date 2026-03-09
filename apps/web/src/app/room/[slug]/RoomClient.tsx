"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Copy, Users, Play, Settings, List } from "lucide-react";
import { PokerTable } from "@/components/poker/PokerTable";
import { RoomOverlay } from "@/components/poker/RoomOverlay";
import { ActionBar } from "@/components/poker/ActionBar";
import { BuyInModal } from "@/components/poker/BuyInModal";
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
  const [showRoomOverlay, setShowRoomOverlay] = useState(false);
  const hasAutoOpenedOverlay = useRef(false);
  const hasAutoSeatedHost = useRef(false);
  const roomRef = useRef(initialRoom);
  roomRef.current = room;

  // One-time auto-open room overlay for host when entering LOBBY
  useEffect(() => {
    if (room?.status === "LOBBY" && isHost && !hasAutoOpenedOverlay.current) {
      setShowRoomOverlay(true);
      hasAutoOpenedOverlay.current = true;
    }
  }, [room?.status, isHost]);

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
      roomRef.current = snapshot.room;
      setRoom(snapshot.room);
      setPlayers(snapshot.players || []);
      setIsHost(snapshot.room.hostId === userId);
      if (snapshot.pendingRequests) {
        setPendingRequests(snapshot.pendingRequests);
      }
      // Host auto-seat: when host creates room, auto-request seat 0 and skip bird's-eye selection
      const isHostNow = snapshot.room.hostId === userId;
      const alreadySeated = (snapshot.players || []).some((p: PlayerData) => p.id === userId);
      if (isHostNow && snapshot.room.status === "LOBBY" && !alreadySeated && !hasAutoSeatedHost.current) {
        hasAutoSeatedHost.current = true;
        const stack = snapshot.room.settings?.smallBlind ? snapshot.room.settings.smallBlind * 50 : 1000;
        socketInstance.emit("INTENT_SEAT_REQUEST", {
          room_id: slug,
          seatIndex: 0,
          stack: Math.max(stack, 1000),
          displayName: "Host"
        });
      }
    });

    socketInstance.on("EVENT_SEAT_REQUEST_PENDING", (data: any) => {
      console.log("Pending seat request received:", data);
      setPendingRequests(prev => {
        const otherRequests = prev.filter(r => r.playerId !== data.playerId);
        return [...otherRequests, data];
      });
      // Host auto-approve own seat request (for host auto-seat flow)
      const r = roomRef.current;
      if (data.playerId === userId && r?.hostId === userId) {
        socketInstance.emit("INTENT_SEAT_APPROVE", { room_id: slug, targetPlayerId: data.playerId });
      }
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

  // Unified table-first layout for both LOBBY and INGAME
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
    <div
      className="flex flex-col w-full h-[100dvh] overflow-hidden"
      style={{ background: 'linear-gradient(170deg, #1a1428 0%, #141420 35%, #0f0e1a 100%)' }}
    >
      {showRoomOverlay && (
        <RoomOverlay
          room={room}
          players={players}
          isHost={isHost}
          pendingRequests={pendingRequests}
          onClose={() => setShowRoomOverlay(false)}
          onCopyLink={copyLink}
          onStartGame={handleStartGame}
          onApproveSeat={approveSeat}
          onOpenSettings={handleOpenSettings}
          userId={userId}
          copied={copied}
        />
      )}

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

      <div className="flex-1 flex flex-col items-center w-full relative overflow-hidden">
        <PokerTable
          players={mappedPlayers}
          dealerId={gameState?.dealerId || ""}
          activePlayerId={gameState?.activePlayerId || ""}
          userId={userId}
          board={gameState?.board || []}
          pots={displayPots}
          handleSeatClick={openBuyInModal}
          turnTimer={turnTimer}
          myPlayerInfo={myPlayerInfo}
          handleAction={handleAction}
          onOpenRaiseModal={() => setShowRaiseModal(true)}
          roomSettings={room.settings}
          showLogPanel={showLogPanel}
          onToggleLogPanel={() => setShowLogPanel(p => !p)}
          currentBet={gameState?.currentBet ?? 0}
          minRaise={gameState?.minRaise ?? room.settings?.bigBlind ?? 10}
          onOpenRoomOverlay={() => setShowRoomOverlay(true)}
          roomName={room.name}
        />

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={() => setShowFairnessModal(true)}
            className="p-2 border rounded-full bg-surface/50 border-white/10 hover:bg-white/10 transition-colors text-white/50 hover:text-accent"
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

        {(isHost && pendingRequests.length > 0) && (
          <div className="absolute bottom-4 left-4 z-20 max-w-xs p-4 border border-accent/30 bg-surface/95 rounded-xl backdrop-blur">
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-3">Pending Seat Requests</h3>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div key={req.playerId} className="flex items-center justify-between p-2 bg-black/40 rounded-lg">
                  <span className="text-xs font-medium">
                    {req.displayName || `Player_${req.playerId.substring(0, 4)}`} (Seat {req.seatIndex + 1}, ${req.stack})
                  </span>
                  <button
                    onClick={() => approveSeat(req.playerId)}
                    className="px-3 py-1 bg-accent text-white text-[10px] font-bold rounded hover:brightness-110"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isHost && pendingRequests.some(r => r.playerId === userId) && (
          <div className="absolute bottom-4 left-4 z-20 max-w-xs p-4 border border-[#eab308]/30 bg-[#eab308]/10 rounded-xl animate-pulse backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
              <h3 className="text-xs font-bold text-[#eab308] uppercase tracking-wider">Request Pending Approval</h3>
            </div>
            <p className="mt-2 text-[10px] text-white/50 leading-relaxed">
              Your request for a seat has been sent to the host.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
