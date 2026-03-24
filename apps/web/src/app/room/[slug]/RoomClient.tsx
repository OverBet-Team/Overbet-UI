"use client";

// OverBet — RoomClient
// Moon Poker visual language applied to both LOBBY and INGAME views.
// NO manual "New Hand" button — OverBet auto-starts the next hand via gateway timer.

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Copy from 'lucide-react/dist/esm/icons/copy'
import Users from 'lucide-react/dist/esm/icons/users'
import Play from 'lucide-react/dist/esm/icons/play'
import Settings from 'lucide-react/dist/esm/icons/settings'
import { PokerTable } from "@/components/poker/PokerTable";
import { PlayerPerspectiveView } from "@/components/poker/PlayerPerspectiveView";
import { toPlayerViewState } from "@/lib/overbet-to-player-view";
import { getPotDisplayAmounts } from "@/lib/pot-display";
import { ActionBar } from "@/components/poker/ActionBar";
import dynamic from 'next/dynamic'
const BuyInModal = dynamic(() => import('@/components/poker/BuyInModal').then(m => ({ default: m.BuyInModal })), { ssr: false })
import { GameLog } from "@/components/poker/GameLog";
import { ChipAmount } from "@/components/poker/ChipAmount";
import { PlayerData, TurnTimer } from "@/components/poker/Seat";
import WinnerToast from "@/components/poker/WinnerToast";
const RoomSettingsModal = dynamic(() => import('@/components/poker/SettingsModal').then(m => ({ default: m.SettingsModal })), { ssr: false })
const RoomFairnessModal = dynamic(() => import('@/components/poker/FairnessModal').then(m => ({ default: m.FairnessModal })), { ssr: false })
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
  sbPlayerId?: string;
  bbPlayerId?: string;
  players: any[];
  currentBet?: number;
  minRaise?: number;
  lastHandReveal?: { seed: number; commitment: string };
}

interface RoomProps {
  slug: string;
  initialRoom: Room;
}

// Timer pill for hero's turn — Moon-style, shown in bottom bar
function TurnTimerPill({ timer }: { timer: TurnTimer }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, timer.expiresAt - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setTimeLeft(Math.max(0, timer.expiresAt - Date.now())), 100);
    return () => clearInterval(iv);
  }, [timer.expiresAt]);
  const secs = Math.ceil(timeLeft / 1000);
  const progress = timer.total > 0 ? timeLeft / timer.total : 0;
  const color = progress < 0.2 ? "#ef4444" : progress < 0.4 ? "#f97316" : "#22c55e";
  return (
    <div data-testid="turn-timer-pill" style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
      borderRadius: 999, background: "rgba(255,255,255,0.06)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{secs}s</span>
    </div>
  );
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
    { playerId: string; seatIndex: number; stack: number; displayName?: string; requestType?: "SEAT" | "REBUY" }[]
  >([]);
  const [showFairnessModal, setShowFairnessModal] = useState(false);
  const [currentCommitment, setCurrentCommitment] = useState<string>("");
  const [turnTimer, setTurnTimer] = useState<TurnTimer | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<RoomSettings | null>(null);
  const [winner, setWinner] = useState<{
    name: string;
    pot: number;
    handName?: string;
    winnerId?: string;
    winnerCards?: string[];
  } | null>(null);
  const [isRebuyOpen, setIsRebuyOpen] = useState(false);
  const [isBusted, setIsBusted] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState("");
  const [showLogOverlay, setShowLogOverlay] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSeatPanelOpen, setIsSeatPanelOpen] = useState(false);
  const [showHostOverlay, setShowHostOverlay] = useState(false);
  const [lastSocketError, setLastSocketError] = useState<string | null>(null);
  const [approvedSeatOverride, setApprovedSeatOverride] = useState<PlayerData | null>(null);
  const [cleanupShowAllRevealed, setCleanupShowAllRevealed] = useState(false);
  const justApprovedRef = useRef(false);
  const logsRef = useRef<any[]>([]);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setIsPortraitMobile(window.innerWidth <= 640 && window.innerHeight >= window.innerWidth);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!lastSocketError) return;
    const t = setTimeout(() => setLastSocketError(null), 4500);
    return () => clearTimeout(t);
  }, [lastSocketError]);

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
      const msg = err?.message ?? err?.code ?? "An error occurred";
      console.error("Socket error:", err?.code, msg, err);
      setLastSocketError(msg);
      alert(msg);
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
      setLogs((prev) => {
        const next = [...prev, { ...data, timestamp: Date.now() }];
        logsRef.current = next;
        return next;
      });
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

    socketInstance.on("ROOM_SNAPSHOT", (snapshot: { room: Room; players: PlayerData[]; pendingRequests?: any[]; isPaused?: boolean }) => {
      setRoom(snapshot.room);
      const fromSnapshot = snapshot.players || [];
      const meFromSnapshot = fromSnapshot.find((p: any) => p.id === userId);
      if (meFromSnapshot) {
        setApprovedSeatOverride(null);
      }
      setPlayers((prev) => {
        if (fromSnapshot.some((p: any) => p.id === userId)) {
          justApprovedRef.current = false;
          return fromSnapshot;
        }
        const me = prev.find((p) => p.id === userId && p.seatIndex !== undefined);
        if (me && justApprovedRef.current) {
          justApprovedRef.current = false;
          return [...fromSnapshot, me];
        }
        return fromSnapshot;
      });
      setIsHost(snapshot.room.hostId === userId);
      if (snapshot.pendingRequests) setPendingRequests(snapshot.pendingRequests);
      setIsPaused(!!snapshot.isPaused);
    });

    socketInstance.on("EVENT_SEAT_REQUEST_PENDING", (data: any) => {
      setPendingRequests((prev) => {
        const others = prev.filter((r) => r.playerId !== data.playerId);
        return [...others, data];
      });
    });

    socketInstance.on("EVENT_SEAT_APPROVED", (data: any) => {
      if (data.playerId === userId) justApprovedRef.current = true;
      setPendingRequests((prev) => prev.filter((r) => r.playerId !== data.playerId));
      let nextApprovedSeatOverride: PlayerData | null = null;
      let shouldApplyApprovedSeatOverride = false;
      setPlayers((prev) => {
        const existing = prev.find((p) => p.id === data.playerId);
        if (existing) {
          if (data.playerId === userId) {
            nextApprovedSeatOverride = null;
          }
          return prev.map((p) =>
            p.id === data.playerId
              ? {
                  ...p,
                  chips: data.stack,
                  status: p.status,
                  seatIndex: data.seatIndex,
                  username: data.displayName || p.username,
                }
              : p
          );
        }
        if (data.playerId === userId) {
          shouldApplyApprovedSeatOverride = true;
          nextApprovedSeatOverride = {
            id: data.playerId,
            username: data.displayName || `Player_${data.playerId.slice(0, 4)}`,
            chips: data.stack,
            status: "ACTIVE",
            seatIndex: data.seatIndex,
            bet: 0,
            cards: [],
          } as PlayerData;
        }
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
      if (data.playerId === userId) {
        setApprovedSeatOverride(shouldApplyApprovedSeatOverride ? nextApprovedSeatOverride : null);
      }
    });

    socketInstance.on("EVENT_STATE_UPDATE", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      const state = snapshot.state;
      if (process.env.NODE_ENV === "development") {
        const board = state?.board ?? [];
        console.log("[EVENT_STATE_UPDATE] phase=", state?.phase, "board.length=", board.length, "board=", board.slice(0, 5));
      }
      setGameState(state);
      if (state.phase === "LOBBY") {
        setCleanupShowAllRevealed(false);
      }
      if (state.phase !== "LOBBY") {
        setRoom((prev) => (prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev));
      }
      setTurnTimer((prev) => {
        if (!state.phase?.endsWith("BETTING")) return null;
        return prev && state.activePlayerId === prev.playerId ? prev : null;
      });

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
        let winnerInfo: { name: string; pot: number; handName?: string; winnerId?: string; winnerCards?: string[] } | null = null;
        const latestLogs = logsRef.current;
        let latestWinningEvent: { amount: number; handName?: string; winnerId?: string } | null = null;

        for (let i = latestLogs.length - 1; i >= 0; i--) {
          const entry = latestLogs[i];
          const t = entry?.type;
          if (t === "WIN" || t === "EARLY_WIN") {
            const payload = entry?.payload ?? entry;
            latestWinningEvent = {
              amount: payload.amount ?? 0,
              handName: t === "WIN" ? payload.handName : "(uncontested)",
              winnerId: payload.playerId ?? payload.winnerId,
            };
            break;
          }
          if (entry?.type === "HAND_INIT") break;
        }

        const winnerPlayer = state.players?.find(
          (p: any) => p.status === "WINNER" || p.status === "WIN"
        );
        const { totalPot: resolvedWinnerPot } = getPotDisplayAmounts(state);

        if (winnerPlayer) {
          winnerInfo = {
            name: winnerPlayer.displayName || winnerPlayer.username || winnerPlayer.id,
            pot: latestWinningEvent?.amount ?? resolvedWinnerPot,
            handName: latestWinningEvent?.handName ?? winnerPlayer.handName,
            winnerId: winnerPlayer.id,
            winnerCards: Array.isArray(winnerPlayer.holeCards) ? winnerPlayer.holeCards : winnerPlayer.cards,
          };
        } else if (latestWinningEvent?.winnerId) {
          const wp = state.players?.find((x: any) => x.id === latestWinningEvent?.winnerId);
          const displayName = wp?.displayName || wp?.username || wp?.id || latestWinningEvent.winnerId;
          winnerInfo = {
            name: displayName,
            pot: latestWinningEvent.amount,
            handName: latestWinningEvent.handName,
            winnerId: latestWinningEvent.winnerId,
            winnerCards: wp ? (Array.isArray(wp.holeCards) ? wp.holeCards : wp.cards) : undefined,
          };
        }
        if (winnerInfo) setWinner(winnerInfo);
      } else if (state.phase === "PRE_FLOP" || state.phase === "PREFLOP" || state.phase === "PRE_FLOP_BETTING") {
        // New hand started — clear winner toast and reset cleanup Show All
        setWinner(null);
        setCleanupShowAllRevealed(false);
      }
    });

    socketInstance.on("EVENT_STATE_SNAPSHOT", (snapshot: { state: any }) => {
      if (!snapshot.state) return;
      if (process.env.NODE_ENV === "development") {
        const board = snapshot.state?.board ?? [];
        console.log("[EVENT_STATE_SNAPSHOT] phase=", snapshot.state?.phase, "board.length=", board.length, "board=", board.slice(0, 5));
      }
      setGameState(snapshot.state);
      if (snapshot.state.phase !== "LOBBY") {
        setRoom((prev) => (prev.status !== "INGAME" ? { ...prev, status: "INGAME" } : prev));
      }
      setTurnTimer((prev) => {
        if (!snapshot.state.phase?.endsWith("BETTING")) return null;
        return prev && snapshot.state.activePlayerId === prev.playerId ? prev : null;
      });
    });

    socketInstance.on("EVENT_TURN_TIMER", (data: any) => {
      setTurnTimer(data as TurnTimer);
    });

    socketInstance.on("EVENT_SETTINGS_UPDATED", (data: any) => {
      setRoom((prev) => ({ ...prev, settings: data.settings }));
    });

    socketInstance.on("EVENT_GAME_PAUSED", () => {
      setIsPaused(true);
      setTurnTimer(null);
    });

    socketInstance.on("EVENT_GAME_RESUMED", () => {
      setIsPaused(false);
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

  const rejectSeat = (playerId: string) => {
    socket?.emit("INTENT_SEAT_REJECT", {
      schema_version: 1, client_msg_id: crypto.randomUUID(),
      room_id: slug, targetPlayerId: playerId,
    });
    setPendingRequests((prev) => prev.filter((r) => r.playerId !== playerId));
  };

  const handleStartGame = () => {
    socket?.emit("INTENT_START_GAME", {
      schema_version: 1, client_msg_id: crypto.randomUUID(), room_id: slug,
    });
  };

  const handlePauseGame = () => {
    socket?.emit("INTENT_PAUSE_GAME", {
      schema_version: 1, client_msg_id: crypto.randomUUID(), room_id: slug,
    });
  };

  const handleResumeGame = () => {
    socket?.emit("INTENT_RESUME_GAME", {
      schema_version: 1, client_msg_id: crypto.randomUUID(), room_id: slug,
    });
  };

  const handleAction = (type: string, amount?: number) => {
    if (isPaused) return;
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
    ...(approvedSeatOverride && !players.some((p) => p.id === approvedSeatOverride.id)
      ? [approvedSeatOverride]
      : []),
  ];

  // ── Settings Modal (extracted) ───────────────────────────────────────────────
  const SettingsModal = () => {
    if (!settingsDraft) return null;
    return (
      <RoomSettingsModal
        settingsDraft={settingsDraft}
        onSettingsChange={(next) => setSettingsDraft(next)}
        onSave={handleSaveSettings}
        onClose={() => setShowSettingsModal(false)}
        isPortraitMobile={isPortraitMobile}
      />
    );
  };

  // ── Fairness Modal (extracted) ───────────────────────────────────────────────
  const FairnessModal = () => (
    <RoomFairnessModal
      currentCommitment={currentCommitment}
      lastHandReveal={gameState?.lastHandReveal ?? null}
      onClose={() => setShowFairnessModal(false)}
      isPortraitMobile={isPortraitMobile}
    />
  );

  // ── Host controls panel (collapsable) ───────────────────────────────────────
  const HostControlPanel = ({ floating = false }: { floating?: boolean }) => {
    if (!isHost) return null;
    const hasPending = pendingRequests.length > 0;
    const canStart =
      players.length >= 2 &&
      (!gameState || gameState.phase === "LOBBY" || gameState.phase === "CLEANUP");
    const canPause =
      !!gameState &&
      gameState.phase !== "LOBBY" &&
      gameState.phase !== "CLEANUP" &&
      !isPaused;

    return (
      <div
        style={{
          ...(floating ? { position: "absolute", top: 8, left: 8, zIndex: 24 } : {}),
          width: floating ? 260 : "100%",
          maxWidth: floating ? 320 : "100%",
          fontFamily: "Outfit, sans-serif",
        }}
      >
        <button
          data-testid="host-seat-requests-toggle"
          onClick={() => setIsSeatPanelOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            border: hasPending ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.14)",
            background: "rgba(16,13,28,0.9)",
            color: hasPending ? "#fca5a5" : "rgba(255,255,255,0.65)",
            fontSize: 11, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(8px)",
          }}
        >
          <Users size={13} />
          Seat Requests {hasPending ? `(${pendingRequests.length})` : ""}
        </button>

        {isSeatPanelOpen && (
          <div
            style={{
              marginTop: 8,
              padding: "12px",
              borderRadius: 14,
              background: "rgba(16,13,28,0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
              <button
                data-testid="host-start-resume-button"
                onClick={isPaused ? handleResumeGame : handleStartGame}
                disabled={!isPaused && !canStart}
                style={{
                  padding: "8px 8px",
                  borderRadius: 10,
                  border: "none",
                  background: isPaused
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#fff",
                  opacity: !isPaused && !canStart ? 0.45 : 1,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: !isPaused && !canStart ? "not-allowed" : "pointer",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                {isPaused ? "Resume" : "Start"}
              </button>
              <button
                data-testid="host-pause-button"
                onClick={handlePauseGame}
                disabled={!canPause}
                style={{
                  padding: "8px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(251,146,60,0.55)",
                  background: "rgba(251,146,60,0.12)",
                  color: "#fdba74",
                  opacity: canPause ? 1 : 0.45,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: canPause ? "pointer" : "not-allowed",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                style={{
                  padding: "8px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(228,215,253,0.24)",
                  background: "rgba(228,215,253,0.08)",
                  color: "#e4d7fd",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Settings
              </button>
            </div>

            {hasPending ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {pendingRequests.map((req) => (
                  <div
                    key={req.playerId}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 10px", borderRadius: 10, background: "rgba(0,0,0,0.35)",
                    }}
                  >
                    <div>
                      <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
                        {req.displayName || `Player_${req.playerId.slice(0, 4)}`}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{req.requestType === "REBUY" ? "Re-buy" : "Seat"} {req.seatIndex + 1} ·</span>
                        <ChipAmount
                          amount={req.stack}
                          iconSize={11}
                          amountStyle={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 10 }}>
                      <button
                        data-testid={`approve-seat-${req.playerId}`}
                        onClick={() => approveSeat(req.playerId)}
                        style={{
                          padding: "4px 10px", borderRadius: 8, border: "none",
                          background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff",
                          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        data-testid={`reject-seat-${req.playerId}`}
                        onClick={() => rejectSeat(req.playerId)}
                        style={{
                          padding: "3px 10px", borderRadius: 8,
                          border: "1px solid rgba(239,68,68,0.5)", background: "transparent",
                          color: "#fca5a5", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit, sans-serif",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center", padding: "8px 0 2px" }}>
                No pending requests.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW SWITCH — mySeat is the authoritative trigger
  // Bird's-eye when !mySeat; PlayerPerspectiveView when mySeat exists.
  // ════════════════════════════════════════════════════════════════════════════
  const myPendingRequest = pendingRequests.find((r) => r.playerId === userId);
  const mySeat =
    players.find((p) => p.id === userId && p.seatIndex !== undefined) ||
    (approvedSeatOverride && approvedSeatOverride.id === userId ? approvedSeatOverride : undefined);
  if (!mySeat) {
    return (
      <div data-testid="lobby-view" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        minHeight: "calc(100vh - 80px)", padding: "24px 16px",
        fontFamily: "Outfit, sans-serif",
      }}>
        <BuyInModal
          isOpen={isBuyInOpen}
          onClose={() => setIsBuyInOpen(false)}
          onSubmit={handleSeatRequest}
          minAmount={0}
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
              data-testid="copy-room-link"
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
                <span data-testid="lobby-player-count" style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                        <ChipAmount
                          amount={p.chips}
                          iconSize={11}
                          amountStyle={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}
                        />
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
                  { label: "Variant", value: <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{room.settings?.variant || "NLH"}</span> },
                  {
                    label: "Blinds",
                    value: (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)" }}>
                        <ChipAmount amount={room.settings?.smallBlind || 10} iconSize={11} amountStyle={{ color: "inherit", fontSize: 12, fontWeight: 600 }} />
                        <span>/</span>
                        <ChipAmount amount={room.settings?.bigBlind || 20} iconSize={11} amountStyle={{ color: "inherit", fontSize: 12, fontWeight: 600 }} />
                      </span>
                    ),
                  },
                  { label: "Turn Time", value: <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{`${room.settings?.turnTimeout || 30}s`}</span> },
                  { label: "Time Bank", value: <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{`${room.settings?.timeBank || 30}s`}</span> },
                  { label: "Auto-Start", value: <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{`${room.settings?.autoStartDelay || 5}s`}</span> },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{label}</span>
                    {value}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Host controls */}
          <HostControlPanel />

          {/* Waiting banner for non-host pending player */}
          {!isHost && !!myPendingRequest && (
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
                {myPendingRequest?.requestType === "REBUY"
                  ? "Waiting for host re-buy approval…"
                  : "Waiting for host approval…"}
              </span>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 24 }}>
            {isHost ? (
              <button
                data-testid="host-start-game-button"
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
        <div style={{ marginTop: 40, width: "100%", display: "flex", justifyContent: "center" }}>
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
  const myLobbyPlayer = players.find((p) => p.id === userId);
  const myStack = myPlayerInfo?.stack ?? myPlayerInfo?.chips ?? myLobbyPlayer?.chips ?? null;
  const isActivePlayer = gameState?.activePlayerId === userId;
  const playerBet = myPlayerInfo?.bet ?? 0;
  const { totalPot } = getPotDisplayAmounts(gameState);
  const revealedBoardCount = (gameState?.board ?? []).filter(Boolean).length;
  const actionBarInteractable =
    !!gameState &&
    gameState.phase !== "LOBBY" &&
    gameState.phase !== "CLEANUP" &&
    isActivePlayer;
  const uiStateSignature = [
    gameState?.phase ?? "NONE",
    `board=${revealedBoardCount}`,
    `active=${gameState?.activePlayerId ?? "none"}`,
    `actionBar=${actionBarInteractable ? "active" : "inactive"}`,
    `winner=${winner ? "1" : "0"}`,
    `error=${lastSocketError ?? ""}`,
  ].join("|");
  const viewState = toPlayerViewState(mappedPlayers, gameState, userId);
  const board5 = Array.from({ length: 5 }, (_, i) => (gameState?.board ?? [])[i] ?? null);
  const hasUnrevealedCards = board5.some((card: string | null) => !card);
  const showRevealAllButton =
    gameState?.phase === "CLEANUP" && !cleanupShowAllRevealed && hasUnrevealedCards;
  const playerCount = mappedPlayers.filter(
    (player) => player.seatIndex !== undefined && player.status !== "PENDING"
  ).length;
  const actionBarNode =
    gameState && gameState.phase !== "LOBBY" && gameState.phase !== "CLEANUP" ? (
      <ActionBar
        isActive={isActivePlayer}
        stack={myPlayerInfo?.stack || 0}
        currentBet={gameState?.currentBet || 0}
        playerBet={playerBet}
        minRaise={gameState?.minRaise || 0}
        pot={totalPot}
        compact={isPortraitMobile}
        onAction={handleAction}
      />
    ) : (
      <div
        style={{
          width: "100%",
          minHeight: isPortraitMobile ? 48 : 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          color: "rgba(255,255,255,0.38)",
          fontSize: isPortraitMobile ? 11 : 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Waiting for hand
      </div>
    );

  return (
    <div
      data-testid="in-game-view"
      style={{
        position: "relative",
        width: "100%",
        height: isPortraitMobile ? "calc(100dvh - 56px)" : "calc(100dvh - 5rem)",
        minHeight: 0,
        overflow: "hidden",
        fontFamily: "var(--font-body), Inter, sans-serif",
      }}
    >
      <div
        data-testid="ui-state-signature"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        {uiStateSignature}
      </div>
      <div
        data-testid="phase-label"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        {gameState?.phase ?? "NONE"}
      </div>
      <div
        data-testid="active-player-id"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        {gameState?.activePlayerId ?? ""}
      </div>

      {showSettingsModal && settingsDraft && <SettingsModal />}
      {showFairnessModal && <FairnessModal />}

      {viewState ? (
        <PlayerPerspectiveView
          viewState={viewState}
          roomName={room.name}
          variantLabel={room.settings?.variant || "NLH"}
          blindLabel={`${room.settings?.smallBlind || 0} / ${room.settings?.bigBlind || 0}`}
          playerCount={playerCount}
          heroStack={myStack}
          heroBet={playerBet}
          actionBar={actionBarNode}
          turnTimerBadge={
            turnTimer && turnTimer.playerId === userId ? <TurnTimerPill timer={turnTimer} /> : null
          }
          helpActive={showHelpOverlay}
          logActive={showLogOverlay}
          onToggleHelp={() => setShowHelpOverlay((value) => !value)}
          onToggleLog={() => setShowLogOverlay((value) => !value)}
          onOpenFairness={() => setShowFairnessModal(true)}
          onOpenHostControls={isHost ? () => setShowHostOverlay(true) : undefined}
          winnerId={winner?.winnerId}
          winnerCards={winner?.winnerCards}
          compactMode={isPortraitMobile}
          isHost={isHost}
          isPaused={isPaused}
          lastSocketError={lastSocketError}
          showRevealAllButton={showRevealAllButton}
          onRevealAll={() => setCleanupShowAllRevealed(true)}
        />
      ) : null}

      {!gameState && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: isPortraitMobile ? 92 : 112,
            transform: "translateX(-50%)",
            zIndex: 24,
            width: "min(560px, calc(100% - 24px))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: isPortraitMobile ? "14px 16px" : "18px 20px",
            borderRadius: 22,
            background: "rgba(25,25,28,0.78)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "#f6f3f5",
                fontSize: isPortraitMobile ? 14 : 16,
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              {isHost ? "Ready to deal a new hand" : "Waiting for the host to deal"}
            </div>
            <div
              style={{
                marginTop: 4,
                color: "rgba(255,255,255,0.58)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {isHost
                ? players.length < 2
                  ? "Need at least 2 seated players before the hand can start."
                  : `${players.length} seated players ready.`
                : "The gateway will auto-advance once the host starts the hand."}
            </div>
          </div>
          {isHost && players.length >= 2 ? (
            <button
              data-testid="floating-start-game-button"
              type="button"
              onClick={handleStartGame}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                minHeight: 46,
                padding: "0 18px",
                borderRadius: 16,
                border: "1px solid rgba(129,236,255,0.28)",
                background: "linear-gradient(135deg, rgba(129,236,255,0.94), rgba(0,212,236,0.82))",
                color: "#0e0e10",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Deal hand
            </button>
          ) : null}
        </div>
      )}

      {isBusted && !pendingRequests.some((request) => request.playerId === userId) && (
        <div
          data-testid="rebuy-cta"
          style={{
            position: "absolute",
            left: "50%",
            top: isPortraitMobile ? 92 : 112,
            transform: "translateX(-50%)",
            zIndex: 24,
            width: "min(520px, calc(100% - 24px))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: isPortraitMobile ? "14px 16px" : "18px 20px",
            borderRadius: 22,
            background: "rgba(25,25,28,0.78)",
            border: "1px solid rgba(244,63,94,0.22)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div>
            <div style={{ color: "#ff9aac", fontSize: 16, fontWeight: 700 }}>You are out of chips</div>
            <div style={{ marginTop: 4, color: "rgba(255,255,255,0.58)", fontSize: 12 }}>
              Submit a re-buy request to keep playing.
            </div>
          </div>
          <button
            data-testid="rebuy-open-button"
            type="button"
            onClick={() => setIsRebuyOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              minHeight: 46,
              padding: "0 18px",
              borderRadius: 16,
              border: "1px solid rgba(244,63,94,0.26)",
              background: "rgba(244,63,94,0.14)",
              color: "#ff9aac",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Re-buy
          </button>
        </div>
      )}

      {!isHost && !!myPendingRequest && (
        <div
          data-testid="pending-request-banner"
          style={{
            position: "absolute",
            left: "50%",
            top: isPortraitMobile ? 92 : 112,
            transform: "translateX(-50%)",
            zIndex: 24,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 999,
            background: "rgba(25,25,28,0.78)",
            border: "1px solid rgba(228,215,253,0.22)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
            backdropFilter: "blur(24px)",
            color: "#e4d7fd",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#e4d7fd",
              boxShadow: "0 0 10px rgba(228,215,253,0.65)",
            }}
          />
          {myPendingRequest?.requestType === "REBUY"
            ? "Waiting for host re-buy approval"
            : "Waiting for host seat approval"}
        </div>
      )}

      {showLogOverlay && (
        <div className="modal-backdrop" onClick={() => setShowLogOverlay(false)} style={{ zIndex: 40 }}>
          <div
            className={isPortraitMobile ? "panel panel--sheet" : "panel"}
            role="dialog"
            aria-modal="true"
            aria-label="Hand log"
            style={{
              maxWidth: isPortraitMobile ? "100%" : 460,
              maxHeight: isPortraitMobile ? "80dvh" : "72vh",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <div style={{ color: "#f6f3f5", fontSize: 16, fontWeight: 700 }}>Hand log</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                  Live action history and showdown results
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowLogOverlay(false)} aria-label="Close hand log">
                ✕
              </button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: isPortraitMobile ? "calc(80dvh - 74px)" : "calc(72vh - 74px)" }}>
              <GameLog logs={logs} players={mappedPlayers} />
            </div>
          </div>
        </div>
      )}

      {showHostOverlay && (
        <div className="modal-backdrop" onClick={() => setShowHostOverlay(false)} style={{ zIndex: 42 }}>
          <div
            className={isPortraitMobile ? "panel panel--sheet" : "panel"}
            role="dialog"
            aria-modal="true"
            aria-label="Host controls"
            style={{
              width: "min(520px, 100%)",
              padding: isPortraitMobile ? "12px 12px calc(12px + env(safe-area-inset-bottom, 0px))" : 16,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                padding: "0 4px",
              }}
            >
              <div>
                <div style={{ color: "#f6f3f5", fontSize: 16, fontWeight: 700 }}>Host controls</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                  Seat approvals, round control, and room admin
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowHostOverlay(false)} aria-label="Close host controls">
                ✕
              </button>
            </div>
            <HostControlPanel />
          </div>
        </div>
      )}

      {showHelpOverlay && (
        <div className="modal-backdrop" onClick={() => setShowHelpOverlay(false)} style={{ zIndex: 40 }}>
          <div
            className={isPortraitMobile ? "panel panel--sheet" : "panel"}
            role="dialog"
            aria-modal="true"
            aria-label="Help"
            style={{ width: "min(380px, 100%)", padding: isPortraitMobile ? "18px 16px 24px" : 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3
                style={{
                  color: "#f6f3f5",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: "-0.03em",
                }}
              >
                {isPortraitMobile ? "Quick actions" : "Keyboard shortcuts"}
              </h3>
              <button className="close-btn" onClick={() => setShowHelpOverlay(false)} aria-label="Close help">
                ✕
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 18,
                color: "rgba(255,255,255,0.78)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div>
                {isPortraitMobile ? (
                  "Use the dock to fold, check/call, raise, or go all in."
                ) : (
                  <>
                    <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>F</kbd> Fold
                  </>
                )}
              </div>
              <div>
                {isPortraitMobile ? (
                  "Open Log to inspect action history without leaving the table."
                ) : (
                  <>
                    <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>C</kbd> Call / Check
                  </>
                )}
              </div>
              {!isPortraitMobile && (
                <div>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>R</kbd> Open raise controls
                </div>
              )}
              {!isPortraitMobile && (
                <div>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>A</kbd> All in
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {winner && (
        <WinnerToast
          winner={winner.name}
          pot={winner.pot}
          handName={winner.handName}
          compact={isPortraitMobile}
        />
      )}

      <BuyInModal
        isOpen={isRebuyOpen}
        onClose={() => setIsRebuyOpen(false)}
        onSubmit={handleRebuy}
        minAmount={0}
        seatIndex={players.find((player) => player.id === userId)?.seatIndex ?? 0}
        isGuest={true}
        initialDisplayName={myDisplayName || players.find((player) => player.id === userId)?.username || ""}
        mode="rebuy"
      />
    </div>
  );
}
