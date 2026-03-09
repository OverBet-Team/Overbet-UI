"use client";

// OverBet — RoomClient
// Moon Poker visual language applied to both LOBBY and INGAME views.
// NO manual "New Hand" button — OverBet auto-starts the next hand via gateway timer.

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Copy, Users, Play, Settings, Shield } from "lucide-react";
import { PokerTable } from "@/components/poker/PokerTable";
import { ActionBar } from "@/components/poker/ActionBar";
import { BuyInModal } from "@/components/poker/BuyInModal";
import { GameLog } from "@/components/poker/GameLog";
import { PlayerData, TurnTimer } from "@/components/poker/Seat";
import WinnerToast from "@/components/poker/WinnerToast";
import PlayingCard from "@/components/poker/PlayingCard";
import { useUser } from "@/hooks/useUser";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RoomSettings {
  variant: string;
  smallBlind: number;
  bigBlind: number;
  autoStartDelay?: number;
  turnTimeout?: number;
  timeBank?: number;
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
  sidePots?: { amount: number; eligiblePlayers: string[] }[];
  dealerId: string;
  activePlayerId: string;
  players: any[];
  currentBet?: number;
  minRaise?: number;
  lastHandReveal?: { seed: number; commitment: string };
}

interface RoomProps {
  slug: string;
  initialRoom: Room;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoomClient({ slug, initialRoom }: RoomProps) {
  const { userId } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [copied, setCopied] = useState(false);

  const [isBuyInOpen, setIsBuyInOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number>(-1);
  const [pendingRequests, setPendingRequests] = useState<
    { playerId: string; seatIndex: number; stack: number; displayName?: string }[]
  >([]);
  const [showFairnessModal, setShowFairnessModal] = useState(false);
  const [currentCommitment, setCurrentCommitment] = useState<string>("");
  const [turnTimer, setTurnTimer] = useState<TurnTimer | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);
  const [winner, setWinner] = useState<{ name: string; pot: number; handName?: string } | null>(null);
  const [isRebuyOpen, setIsRebuyOpen] = useState(false);
  const [isBusted, setIsBusted] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState("");

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const socketInstance = io(
      process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000",
      { query: { roomId: slug, userId } }
    );
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      socketInstance.emit("INTENT_JOIN_ROOM", {
        schema_version: 1, room_id: slug, client_msg_id: crypto.randomUUID(),
      });
      socketInstance.emit("INTENT_REQUEST_SNAPSHOT", {
        schema_version: 1, room_id: slug, client_msg_id: crypto.randomUUID(),
      });
    });

    socketInstance.on("EVENT_ERROR", (err: any) => {
      console.error("Socket error:", err);
      alert(err.message || "An error occurred");
    });

    socketInstance.on("EVENT_HAND_LOG", (data: any) => {
      // HAND_INIT carries the commitment for the Fairness modal
      if (data.type === "HAND_INIT" && data.commitment) {
        setCurrentCommitment(data.commitment);
      }
      // HAND_REVEAL carries the seed + commitment for provably-fair verification
      // The engine emits this event before CLEANUP; gateway forwards it via EVENT_HAND_LOG
      if (data.type === "HAND_REVEAL" && data.payload) {
        setGameState((prev) =>
          prev
            ? { ...prev, lastHandReveal: { seed: data.payload.seed, commitment: data.payload.commitment } }
            : prev
        );
      }
      setLogs((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });

    // EVENT_HAND_REVEAL is a direct socket event (emitted by gateway when it detects
    // the HAND_REVEAL engine event). It carries { seed, commitment } directly.
    socketInstance.on("EVENT_HAND_REVEAL", (data: any) => {
      if (data.seed !== undefined && data.commitment) {
        setGameState((prev) =>
          prev
            ? { ...prev, lastHandReveal: { seed: data.seed, commitment: data.commitment } }
            : prev
        );
      }
    });

    socketInstance.on("ROOM_SNAPSHOT", (snapshot: { room: Room; players: PlayerData[]; pendingRequests?: any[] }) => {
      setRoom(snapshot.room);
      setPlayers(snapshot.players || []);
      setIsHost(snapshot.room.hostId === userId);
      if (snapshot.pendingRequests) setPendingRequests(snapshot.pendingRequests);
    });

    socketInstance.on("EVENT_SEAT_REQUEST_PENDING", (data: any) => {
      setPendingRequests((prev) => {
        const others = prev.filter((r) => r.playerId !== data.playerId);
        return [...others, data];
      });
    });

    socketInstance.on("EVENT_SEAT_APPROVED", (data: any) => {
      setPendingRequests((prev) => prev.filter((r) => r.playerId !== data.playerId));
      setPlayers((prev) => {
        if (prev.find((p) => p.id === data.playerId)) return prev;
        return [
          ...prev,
          {
            id: data.playerId,
            username: data.displayName || `Player_${data.playerId.slice(0, 4)}`,
            chips: data.stack,
            status: "ACTIVE",
            seatIndex: data.seatIndex,
          },
        ];
      });
    });

    socketInstance.on("EVENT_STATE_UPDATE", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      const state = snapshot.state;
      setGameState(state);
      if (state.phase !== "LOBBY") {
        setRoom((prev) => (prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev));
      }
      setTurnTimer((prev) => (prev && state.activePlayerId === prev.playerId ? prev : null));

      // Detect if local player is busted (stack === 0) after CLEANUP
      if (state.phase === "CLEANUP") {
        const myEnginePlayer = Array.isArray(state.players)
          ? state.players.find((p: any) => p.id === userId)
          : null;
        if (myEnginePlayer && (myEnginePlayer.stack === 0 || myEnginePlayer.chips === 0)) {
          setIsBusted(true);
        }
      } else if (state.phase === "PRE_FLOP" || state.phase === "PREFLOP") {
        // New hand started — check if we're back in
        const myEnginePlayer = Array.isArray(state.players)
          ? state.players.find((p: any) => p.id === userId)
          : null;
        if (myEnginePlayer && (myEnginePlayer.stack > 0 || myEnginePlayer.chips > 0)) {
          setIsBusted(false);
        }
      }

      // Detect winner from CLEANUP/SHOWDOWN
      if (state.phase === "CLEANUP" || state.phase === "SHOWDOWN") {
        const winnerPlayer = state.players?.find(
          (p: any) => p.status === "WINNER" || p.status === "WIN"
        );
        if (winnerPlayer) {
          setWinner({
            name: winnerPlayer.displayName || winnerPlayer.username || winnerPlayer.id,
            pot: state.pot || 0,
            handName: winnerPlayer.handName,
          });
        }
      } else if (state.phase === "PRE_FLOP" || state.phase === "PREFLOP" || state.phase === "PRE_FLOP_BETTING") {
        // New hand started — clear winner toast
        setWinner(null);
      }
    });

    socketInstance.on("EVENT_STATE_SNAPSHOT", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      setGameState(snapshot.state);
      if (snapshot.state.phase !== "LOBBY") {
        setRoom((prev) => (prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev));
      }
      setTurnTimer((prev) =>
        prev && snapshot.state.activePlayerId === prev.playerId ? prev : null
      );
    });

    socketInstance.on("EVENT_TURN_TIMER", (data: any) => {
      setTurnTimer(data as TurnTimer);
    });

    socketInstance.on("EVENT_SETTINGS_UPDATED", (data: any) => {
      setRoom((prev) => ({ ...prev, settings: data.settings }));
    });

    return () => { socketInstance.disconnect(); };
  }, [slug, userId]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openBuyInModal = (seatIndex: number) => {
    if (players.some((p) => p.seatIndex === seatIndex)) return;
    setSelectedSeat(seatIndex);
    setIsBuyInOpen(true);
  };

  const handleSeatRequest = (amount: number, displayName: string) => {
    socket?.emit("INTENT_SEAT_REQUEST", {
      schema_version: 1, client_msg_id: crypto.randomUUID(),
      room_id: slug, seatIndex: selectedSeat, stack: amount, displayName,
    });
    if (displayName) setMyDisplayName(displayName);
    setIsBuyInOpen(false);
  };

  const handleRebuy = (amount: number, _displayName: string) => {
    // Re-buy reuses the same seat the player was in
    const myPlayer = players.find((p) => p.id === userId);
    const seatIdx = myPlayer?.seatIndex ?? selectedSeat;
    socket?.emit("INTENT_SEAT_REQUEST", {
      schema_version: 1, client_msg_id: crypto.randomUUID(),
      room_id: slug, seatIndex: seatIdx, stack: amount,
      displayName: myDisplayName || myPlayer?.username || `Player_${userId.slice(0, 4)}`,
    });
    setIsRebuyOpen(false);
    setIsBusted(false);
  };

  const approveSeat = (playerId: string) => {
    socket?.emit("INTENT_SEAT_APPROVE", {
      schema_version: 1, client_msg_id: crypto.randomUUID(),
      room_id: slug, targetPlayerId: playerId,
    });
  };

  const handleStartGame = () => {
    socket?.emit("INTENT_START_GAME", {
      schema_version: 1, client_msg_id: crypto.randomUUID(), room_id: slug,
    });
  };

  const handleAction = (type: string, amount?: number) => {
    socket?.emit("INTENT_PLAYER_ACTION", {
      schema_version: 1, client_msg_id: crypto.randomUUID(),
      room_id: slug, action: { type, amount },
    });
  };

  const handleOpenSettings = () => {
    setSettingsDraft({ ...room.settings });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = () => {
    if (!settingsDraft) return;
    socket?.emit("INTENT_UPDATE_SETTINGS", { room_id: slug, settings: settingsDraft });
    setShowSettingsModal(false);
  };

  if (!room) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "rgba(255,255,255,0.5)", fontFamily: "Outfit, sans-serif" }}>
      Loading room…
    </div>
  );

  // ── Player mapping ──────────────────────────────────────────────────────────
  const mappedPlayers: PlayerData[] = [
    ...players.map((p) => {
      const gPlayer = Array.isArray(gameState?.players)
        ? gameState.players.find((gp) => gp.id === p.id)
        : (gameState?.players as any)?.[p.id];
      if (gPlayer) {
        return {
          ...p,
          chips: gPlayer.chips ?? gPlayer.stack ?? p.chips,
          bet: gPlayer.bet || 0,
          cards: gPlayer.cards || gPlayer.holeCards || [],
        } as PlayerData;
      }
      return p as PlayerData;
    }),
    ...pendingRequests
      .filter((req) => !players.some((p) => p.id === req.playerId))
      .map((req) => ({
        id: req.playerId,
        username: req.displayName || `Player_${req.playerId.slice(0, 4)}`,
        chips: req.stack,
        status: "PENDING" as any,
        seatIndex: req.seatIndex,
        bet: 0,
        cards: [],
      } as PlayerData)),
  ];

  // ── Settings Modal (shared between lobby and in-game) ───────────────────────
  const SettingsModal = () => (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, padding: 28, position: "relative",
        background: "rgba(16,13,28,0.98)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        fontFamily: "Outfit, sans-serif",
      }}>
        <button onClick={() => setShowSettingsModal(false)} style={{
          position: "absolute", top: 16, right: 16, background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 20, cursor: "pointer", lineHeight: 1,
        }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Settings size={18} color="rgba(167,139,250,0.8)" />
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>Room Settings</h2>
        </div>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginBottom: 24, fontStyle: "italic" }}>
          Changes take effect on the next hand.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { key: "turnTimeout", label: "Turn Time", min: 10, max: 120, step: 5, unit: "s", color: "#f87171" },
            { key: "timeBank", label: "Time Bank", min: 0, max: 120, step: 5, unit: "s", color: "#fb923c" },
            { key: "autoStartDelay", label: "Auto-Start Delay", min: 2, max: 30, step: 1, unit: "s", color: "#a78bfa" },
          ].map(({ key, label, min, max, step, unit, color }) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>{label}</label>
                <span style={{ color, fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                  {(settingsDraft as any)?.[key] ?? 30}{unit}
                </span>
              </div>
              <input
                type="range" min={min} max={max} step={step}
                value={(settingsDraft as any)?.[key] ?? 30}
                onChange={(e) => setSettingsDraft((prev) => prev ? { ...prev, [key]: Number(e.target.value) } : prev)}
                style={{ width: "100%", accentColor: color }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{min}{unit}</span>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{max}{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button onClick={() => setShowSettingsModal(false)} style={{
            flex: 1, padding: "11px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "rgba(255,255,255,0.4)", fontFamily: "Outfit, sans-serif",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleSaveSettings} style={{
            flex: 1, padding: "11px 0", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            color: "#fff", fontFamily: "Outfit, sans-serif",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
          }}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  // ── Fairness Modal ──────────────────────────────────────────────────────────
  const FairnessModal = () => (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, padding: 28, position: "relative",
        background: "rgba(16,13,28,0.98)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        fontFamily: "Outfit, sans-serif",
      }}>
        <button onClick={() => setShowFairnessModal(false)} style={{
          position: "absolute", top: 16, right: 16, background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 20, cursor: "pointer",
        }}>✕</button>

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
              {currentCommitment || "Waiting for hand…"}
            </div>
            <p style={{ marginTop: 8, color: "rgba(255,255,255,0.25)", fontSize: 10, fontStyle: "italic", lineHeight: 1.5 }}>
              SHA-256 hash generated before cards were dealt — proves the deck order is fixed.
            </p>
          </div>

          {gameState?.lastHandReveal && (
            <div style={{
              padding: 16, borderRadius: 14,
              background: "rgba(110,231,183,0.05)", border: "1px solid rgba(110,231,183,0.2)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Last Hand Revealed
                </span>
                <span style={{
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
                    {gameState.lastHandReveal.seed}
                  </code>
                </div>
                <div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, display: "block", marginBottom: 2 }}>Commitment</span>
                  <code style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 9, wordBreak: "break-all" }}>
                    {gameState.lastHandReveal.commitment}
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

  // ── Pending seat requests panel ─────────────────────────────────────────────
  const PendingRequestsPanel = () => (
    isHost && pendingRequests.length > 0 ? (
      <div style={{
        padding: "14px 16px", borderRadius: 16, marginTop: 16,
        background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
        fontFamily: "Outfit, sans-serif",
      }}>
        <div style={{ color: "#f87171", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          Seat Requests ({pendingRequests.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pendingRequests.map((req) => (
            <div key={req.playerId} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 10, background: "rgba(0,0,0,0.3)",
            }}>
              <div>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
                  {req.displayName || `Player_${req.playerId.slice(0, 4)}`}
                </span>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginLeft: 8 }}>
                  Seat {req.seatIndex + 1} · ${req.stack.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => approveSeat(req.playerId)}
                style={{
                  padding: "5px 14px", borderRadius: 8, border: "none",
                  background: "rgba(239,68,68,0.8)", color: "#fff",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LOBBY VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (room.status === "LOBBY") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        minHeight: "calc(100vh - 80px)", padding: "24px 16px",
        fontFamily: "Outfit, sans-serif",
      }}>
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

        {/* Lobby card */}
        <div style={{
          width: "100%", maxWidth: 640, padding: 32,
          background: "rgba(16,13,28,0.92)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          backdropFilter: "blur(20px)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                {room.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Room Code:</span>
                <span style={{
                  color: "#a78bfa", fontFamily: "monospace", fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.15em", background: "rgba(167,139,250,0.1)",
                  padding: "2px 10px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.2)",
                }}>
                  {slug.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={copyLink}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                borderRadius: 10, border: copied ? "1px solid rgba(110,231,183,0.4)" : "1px solid rgba(255,255,255,0.1)",
                background: copied ? "rgba(110,231,183,0.08)" : "rgba(255,255,255,0.04)",
                color: copied ? "#6ee7b7" : "rgba(255,255,255,0.6)",
                fontFamily: "Outfit, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <Copy size={14} />
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          {/* Two-column info grid */}
          <div className="lobby-info-grid">
            {/* Players */}
            <div style={{
              padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <Users size={15} color="rgba(167,139,250,0.8)" />
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Players ({players.length})
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
                {players.length === 0 ? (
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, fontStyle: "italic" }}>No players yet…</span>
                ) : (
                  players.map((p) => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
                    }}>
                      <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{p.username}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "#a78bfa", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                          ${p.chips.toLocaleString()}
                        </span>
                        {room.hostId === p.id && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 999,
                            background: "rgba(239,68,68,0.15)", color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.25)", fontWeight: 700,
                          }}>
                            HOST
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Settings */}
            <div style={{
              padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Settings size={15} color="rgba(167,139,250,0.8)" />
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Settings
                  </span>
                </div>
                {isHost && (
                  <button
                    onClick={handleOpenSettings}
                    style={{
                      padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.3)",
                      background: "rgba(167,139,250,0.1)", color: "#a78bfa",
                      fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Variant", value: room.settings?.variant || "NLH" },
                  { label: "Blinds", value: `${room.settings?.smallBlind || 10} / ${room.settings?.bigBlind || 20}` },
                  { label: "Turn Time", value: `${room.settings?.turnTimeout || 30}s` },
                  { label: "Time Bank", value: `${room.settings?.timeBank || 30}s` },
                  { label: "Auto-Start", value: `${room.settings?.autoStartDelay || 5}s` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{label}</span>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pending requests */}
          <PendingRequestsPanel />

          {/* Waiting banner for non-host pending player */}
          {!isHost && pendingRequests.some((r) => r.playerId === userId) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              borderRadius: 12, background: "rgba(167,139,250,0.06)",
              border: "1px solid rgba(167,139,250,0.2)", marginTop: 16,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#a78bfa",
                boxShadow: "0 0 8px rgba(167,139,250,0.6)", animation: "pulse 2s infinite",
              }} />
              <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600 }}>
                Waiting for host approval…
              </span>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 24 }}>
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                style={{
                  width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
                  background: players.length < 2
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: players.length < 2 ? "rgba(255,255,255,0.25)" : "#fff",
                  fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: 700,
                  cursor: players.length < 2 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: players.length >= 2 ? "0 6px 24px rgba(239,68,68,0.3)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <Play size={18} />
                {players.length < 2 ? "Waiting for players…" : "Start Game"}
              </button>
            ) : (
              <div style={{
                padding: "14px 16px", borderRadius: 14, textAlign: "center",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
                  Click an empty seat on the table below to join the game.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Settings modal */}
        {showSettingsModal && settingsDraft && <SettingsModal />}

        {/* Seat-selection table preview */}
        <div style={{ marginTop: 48, width: "100%", display: "flex", justifyContent: "center", zoom: 0.78 }}>
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

  // ════════════════════════════════════════════════════════════════════════════
  // IN-GAME VIEW
  // ════════════════════════════════════════════════════════════════════════════
  const myPlayerInfo = Array.isArray(gameState?.players)
    ? gameState.players.find((p) => p.id === userId)
    : null;
  const isActivePlayer = gameState?.activePlayerId === userId;

  const displayPots: { amount: number; type: string }[] = [];
  if (gameState?.pot && gameState.pot > 0) displayPots.push({ amount: gameState.pot, type: "MAIN" });
  if (gameState?.sidePots) {
    gameState.sidePots.forEach((sp) => displayPots.push({ amount: sp.amount, type: "SIDE" }));
  }

  return (
    <div
      className="ingame-layout"
      style={{ fontFamily: "Outfit, sans-serif" }}
    >
      {/* ── Main table column ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative", paddingTop: 48 }}>
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

        {/* Table */}
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

        {/* Top-right icon buttons */}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
          {isHost && (
            <button
              onClick={handleOpenSettings}
              style={{
                width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(16,13,28,0.8)", color: "rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", backdropFilter: "blur(8px)", transition: "all 0.15s",
              }}
              title="Room Settings"
              onMouseEnter={(e) => { e.currentTarget.style.color = "#a78bfa"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <Settings size={16} />
            </button>
          )}
          <button
            onClick={() => setShowFairnessModal(true)}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(16,13,28,0.8)", color: "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", backdropFilter: "blur(8px)", transition: "all 0.15s",
              fontSize: 16,
            }}
            title="Provably Fair"
            onMouseEnter={(e) => { e.currentTarget.style.color = "#6ee7b7"; e.currentTarget.style.borderColor = "rgba(110,231,183,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            <Shield size={16} />
          </button>
        </div>

        {/* Modals */}
        {showSettingsModal && settingsDraft && <SettingsModal />}
        {showFairnessModal && <FairnessModal />}

        {/* ── Bottom panel: hand + action bar ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, gap: 12, marginTop: 32 }}>

          {/* Your Hand + Stack */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 18,
            background: "rgba(16,13,28,0.9)", border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
          }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Your Hand
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(myPlayerInfo?.holeCards || myPlayerInfo?.cards)?.length === 2 ? (
                  (myPlayerInfo?.holeCards || myPlayerInfo?.cards).map((card: string, i: number) => (
                    <PlayingCard key={i} card={card} size="sm" />
                  ))
                ) : (
                  <>
                    <PlayingCard dashed size="sm" />
                    <PlayingCard dashed size="sm" />
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Stack
              </div>
              <div style={{ color: "#a78bfa", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {myPlayerInfo?.stack != null ? `$${myPlayerInfo.stack.toLocaleString()}` : "—"}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <ActionBar
            isActive={isActivePlayer}
            stack={myPlayerInfo?.stack || 0}
            currentBet={gameState?.currentBet || 0}
            playerBet={myPlayerInfo?.bet || 0}
            minRaise={gameState?.minRaise || 0}
            pot={gameState?.pot || 0}
            onAction={handleAction}
          />

          {/* Pending requests (host, in-game) */}
          <PendingRequestsPanel />

          {/* Re-buy CTA — shown when local player is busted */}
          {isBusted && !pendingRequests.some((r) => r.playerId === userId) && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderRadius: 16,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <div>
                <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>You're out of chips</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>Re-buy to stay in the game</div>
              </div>
              <button
                onClick={() => setIsRebuyOpen(true)}
                style={{
                  padding: "9px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "Outfit, sans-serif",
                  boxShadow: "0 4px 16px rgba(239,68,68,0.25)",
                }}
              >
                Re-buy
              </button>
            </div>
          )}

          {/* Requester waiting banner */}
          {!isHost && pendingRequests.some((r) => r.playerId === userId) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              borderRadius: 12, background: "rgba(167,139,250,0.06)",
              border: "1px solid rgba(167,139,250,0.2)",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#a78bfa",
                boxShadow: "0 0 8px rgba(167,139,250,0.6)",
              }} />
              <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600 }}>
                Waiting for host approval…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar: game log ───────────────────────────────────────────────────────── */}
      <div className="gamelog-sidebar">
        <GameLog logs={logs} players={mappedPlayers} />
      </div>

      {/* Winner toast — no New Hand button, auto-start is handled by gateway */}
      {winner && (
        <WinnerToast
          winner={winner.name}
          pot={winner.pot}
          handName={winner.handName}
        />
      )}

      {/* Re-buy modal */}
      <BuyInModal
        isOpen={isRebuyOpen}
        onClose={() => setIsRebuyOpen(false)}
        onSubmit={handleRebuy}
        minAmount={room.settings?.smallBlind * 50 || 1000}
        maxAmount={room.settings?.bigBlind * 200 || 4000}
        seatIndex={players.find((p) => p.id === userId)?.seatIndex ?? 0}
        isGuest={true}
        initialDisplayName={myDisplayName || players.find((p) => p.id === userId)?.username || ""}
        mode="rebuy"
      />
    </div>
  );
}
