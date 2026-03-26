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
import Shield from 'lucide-react/dist/esm/icons/shield'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text'
import Lock from 'lucide-react/dist/esm/icons/lock'
import { PokerTable } from "@/components/poker/PokerTable";
import { PlayerPerspectiveView } from "@/components/poker/PlayerPerspectiveView";
import { toPlayerViewState } from "@/lib/overbet-to-player-view";
import { getPotDisplayAmounts } from "@/lib/pot-display";
import { ActionBar } from "@/components/poker/action-bar";
import dynamic from 'next/dynamic'
const BuyInModal = dynamic(() => import('@/components/poker/BuyInModal').then(m => ({ default: m.BuyInModal })), { ssr: false })
import { GameLog } from "@/components/poker/GameLog";
import { ChipAmount } from "@/components/poker/ChipAmount";
import { PlayerData, TurnTimer } from "@/components/poker/Seat";
import WinnerToast from "@/components/poker/WinnerToast";
const RoomSettingsModal = dynamic(() => import('@/components/poker/SettingsModal').then(m => ({ default: m.SettingsModal })), { ssr: false })
const RoomFairnessModal = dynamic(() => import('@/components/poker/FairnessModal').then(m => ({ default: m.FairnessModal })), { ssr: false })
import { useUser } from "@/hooks/useUser";
import { PADDING, RADIUS, CONTAINERS, COLORS } from './roomStyles';

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
          ...(floating ? { position: "absolute", top: 8, left: 8, zIndex: 50 } : {}),
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
            padding: PADDING.medium, borderRadius: RADIUS.pill,
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
          <div className="glass-panel rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)] border border-white/10">
            <div className="flex gap-2 mb-3">
              <button
                data-testid="host-start-resume-button"
                onClick={isPaused ? handleResumeGame : handleStartGame}
                disabled={!isPaused && !canStart}
                className={`
                  flex-1 py-2 px-4 rounded-xl font-bold text-xs uppercase tracking-wider
                  transition-all duration-200
                  ${isPaused
                    ? 'bg-[--tertiary] hover:bg-[--tertiary-dim] text-white shadow-[0_4px_12px_rgba(0,229,255,0.3)]'
                    : 'bg-[--tertiary] hover:bg-[--tertiary-dim] text-white shadow-[0_4px_12px_rgba(0,229,255,0.3)]'
                  }
                  ${!isPaused && !canStart ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isPaused ? 'Resume' : 'Start'}
              </button>
              <button
                data-testid="host-pause-button"
                onClick={handlePauseGame}
                disabled={!canPause}
                className={`
                  flex-1 py-2 px-4 rounded-xl font-bold text-xs uppercase tracking-wider
                  border border-white/20 bg-white/5 hover:bg-white/10 text-white/80
                  transition-all duration-200
                  ${canPause ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'}
                `}
              >
                Pause
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
                          background: "linear-gradient(135deg, var(--success), #16a34a)", color: "#fff",
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
                          border: "1px solid var(--secondary)", background: "transparent",
                          color: "var(--secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "Outfit, sans-serif",
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
          background: "var(--surface-container)", border: "1px solid rgba(72, 71, 74, 0.3)",
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
                  color: "var(--primary)", fontFamily: "monospace", fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.15em", background: "rgba(228,215,253,0.1)",
                  padding: "2px 10px", borderRadius: 6, border: "1px solid rgba(228, 215, 253, 0.2)",
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
                borderRadius: 10, border: copied ? "1px solid var(--success)" : "1px solid var(--outline-variant)",
                background: copied ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                color: copied ? "var(--success)" : "rgba(255,255,255,0.6)",
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
              padding: 18, borderRadius: 16, background: "var(--surface-container)",
              border: "1px solid rgba(72, 71, 74, 0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <Users size={15} color="var(--primary)" />
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
                          amountStyle={{ color: "var(--primary)", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}
                        />
                        {room.hostId === p.id && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 999,
                            background: "rgba(255,109,139,0.15)", color: "var(--secondary)",
                            border: "1px solid var(--secondary)", fontWeight: 700,
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
              padding: 18, borderRadius: 16, background: "var(--surface-container)",
              border: "1px solid rgba(72, 71, 74, 0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Settings size={15} color="var(--primary)" />
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Settings
                  </span>
                </div>
                {isHost && (
                  <button
                    onClick={handleOpenSettings}
                    style={{
                      padding: "3px 10px", borderRadius: 6, border: "1px solid var(--primary)",
                      background: "rgba(228,215,253,0.1)", color: "var(--primary)",
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
              borderRadius: RADIUS.card, background: "rgba(228,215,253,0.06)",
              border: "1px solid rgba(228, 215, 253, 0.2)", marginTop: 16,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "var(--primary)",
                boxShadow: "0 0 8px rgba(228,215,253,0.6)", animation: "pulse 2s infinite",
              }} />
              <span style={{ color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
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
                    : "linear-gradient(135deg, var(--secondary), #dc2626)",
                  color: players.length < 2 ? "rgba(255,255,255,0.25)" : "#fff",
                  fontFamily: "Outfit, sans-serif", fontSize: 16, fontWeight: 700,
                  cursor: players.length < 2 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: players.length >= 2 ? "0 6px 24px rgba(255,109,139,0.3)" : "none",
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
  // Fallback to the lobby players list when gameState isn't available yet
  // (player is seated but hand hasn't started)
  const myLobbyPlayer = players.find((p) => p.id === userId);
  const myStack = myPlayerInfo?.stack ?? myPlayerInfo?.chips ?? myLobbyPlayer?.chips ?? null;
  const isActivePlayer = gameState?.activePlayerId === userId;

  const playerBet = myPlayerInfo?.bet ?? 0;
  const { totalPot, currentRoundAmount } = getPotDisplayAmounts(gameState);
  // Moon-style bottom bar helpers
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

  return (
    <div
      data-testid="in-game-view"
      className="flex flex-col w-full h-screen overflow-hidden font-body"
    >
      {/* OVERBET header */}
      <header className="fixed top-0 left-0 w-full px-6 md:px-10 py-4 md:py-6 z-[60] flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-3 md:gap-10">
          <span className="font-headline font-bold text-sm md:text-base uppercase italic tracking-tighter text-[--on-surface] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[--gold]" />
            OVERBET
          </span>
          <span className="hidden md:inline text-[0.6rem] font-headline uppercase tracking-[0.2em] text-[--on-surface-variant]/40">
            Table: <span className="text-[--on-surface]/80">{room.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {/* Icon buttons */}
          <div className="flex items-center gap-3">
            {isHost && (
              <button
                onClick={handleOpenSettings}
                className="icon-btn hover:text-[--tertiary] hover:border-[--tertiary] focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
                title="Room Settings"
                aria-label="Room settings"
              >
                <Settings size={16} />
              </button>
            )}
            <button
              onClick={() => setShowFairnessModal(true)}
              className="icon-btn hover:text-[--tertiary] hover:border-[--tertiary] focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
              title="Provably Fair"
              aria-label="Provably fair verification"
            >
              <Shield size={16} />
            </button>
            <button
              onClick={() => setShowHelpOverlay((v) => !v)}
              className="icon-btn hover:text-[--tertiary] hover:border-[--tertiary] focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
              title="Help"
              aria-label="Show help"
            >
              <HelpCircle size={16} />
            </button>
            <button
              onClick={() => setShowLogOverlay((v) => !v)}
              className="icon-btn hover:text-[--tertiary] hover:border-[--tertiary] focus-visible:ring-2 focus-visible:ring-[--ring-active] focus-visible:ring-offset-2"
              title="Game Log"
              aria-label="Show game log"
            >
              <ScrollText size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Atmospheric background orbs */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[--primary]/5 blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[20%] w-[50%] h-[50%] rounded-full bg-[--tertiary]/5 blur-[100px]" />
        <div className="absolute top-[40%] left-[30%] w-[20%] h-[20%] rounded-full bg-[--secondary]/5 blur-[80px]" />
      </div>

      {/* ── Game canvas (flex-fill) ────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", paddingTop: isPortraitMobile ? 36 : 0 }}>
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
        {lastSocketError && (
          <div
            data-testid="ui-error-banner"
            style={{
              position: "absolute",
              top: isPortraitMobile ? 44 : 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              padding: PADDING.standard,
              borderRadius: 10,
              background: "rgba(255,110,132,0.15)",
              border: "1px solid var(--error)",
              color: "var(--error)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {lastSocketError}
          </div>
        )}
        <BuyInModal
          isOpen={isBuyInOpen}
          onClose={() => setIsBuyInOpen(false)}
          onSubmit={handleSeatRequest}
          minAmount={0}
          seatIndex={selectedSeat}
          isGuest={true}
          initialDisplayName=""
        />

        {/* Table — PlayerPerspectiveView fills canvas */}
        {(() => {
          const viewState = toPlayerViewState(mappedPlayers, gameState, userId);
          if (viewState) {
            const isCleanup = gameState?.phase === "CLEANUP";
            const board5 = Array.from({ length: 5 }, (_, i) => (gameState?.board ?? [])[i] ?? null);
            const hasUnrevealedCards = board5.some((c: string | null) => !c);
            const showShowAllButton = isCleanup && !cleanupShowAllRevealed && hasUnrevealedCards;
            return (
              <div style={{ flex: 1, minHeight: 0, display: "flex", width: "100%", position: "relative" }}>
                <PlayerPerspectiveView
                  viewState={viewState}
                  winnerId={winner?.winnerId}
                  winnerCards={winner?.winnerCards}
                  compactMode={isPortraitMobile}
                  turnTimer={turnTimer}
                />
                {showShowAllButton && (
                  <button
                    onClick={() => setCleanupShowAllRevealed(true)}
                    style={{
                      position: "fixed",
                      left: 20,
                      bottom: isPortraitMobile ? "calc(148px + env(safe-area-inset-bottom, 0px))" : 88,
                      zIndex: 50,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: "rgba(18, 15, 32, 0.94)",
                      border: "1px solid rgba(124, 58, 237, 0.45)",
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "Outfit, sans-serif",
                      cursor: "pointer",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                      backdropFilter: "blur(16px)",
                      letterSpacing: "0.01em",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(124,58,237,0.25)";
                      e.currentTarget.style.borderColor = "rgba(167,139,250,0.65)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(18,15,32,0.94)";
                      e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)";
                    }}
                  >
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Show All
                  </button>
                )}
              </div>
            );
          }
          return null;
        })()}

        {isPortraitMobile && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            background: "linear-gradient(180deg, rgba(19,19,21,0.88) 0%, rgba(19,19,21,0.2) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--on-surface-variant)", opacity: 0.6, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <span data-testid="phase-label-visual">
                {gameState?.phase?.replaceAll("_", " ") || "Waiting"}
              </span>
              </span>
              {isHost && (
                <button
                  onClick={() => setShowHostOverlay(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 999,
                    border: "1px solid var(--outline-variant)",
                    background: "rgba(255,255,255,0.04)", color: "var(--on-surface-variant)",
                    fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Outfit, sans-serif",
                  }}
                >
                  <Users size={11} />
                  Host
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pot</span>
                <ChipAmount amount={totalPot} iconSize={11} iconColor="var(--tertiary)" amountStyle={{ color: "var(--tertiary)", fontSize: 12, fontWeight: 700 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Round</span>
                <ChipAmount amount={currentRoundAmount} iconSize={10} iconColor="var(--primary)" amountStyle={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }} />
              </div>
            </div>
          </div>
        )}

        {/* Host controls (in-game, floating top-left) */}
        {!isPortraitMobile && <HostControlPanel floating />}

        {isPaused && (
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            zIndex: 50, padding: "6px 12px", borderRadius: 999,
            background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.5)",
            color: "#fdba74", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Game Paused
          </div>
        )}

        {/* Modals */}
        {showSettingsModal && settingsDraft && <SettingsModal />}
        {showFairnessModal && <FairnessModal />}

        {/* Pre-hand waiting banner — floating above bottom bar */}
        {!gameState && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
            borderRadius: 16, background: "rgba(228,215,253,0.06)",
            border: "1px solid var(--primary)", zIndex: 40,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: "var(--primary)", boxShadow: "0 0 10px rgba(228,215,253,0.6)",
              animation: "pulse 2s infinite",
            }} />
            <div>
              <div style={{ color: "var(--primary)", fontSize: 13, fontWeight: 700 }}>
                {isHost ? "Ready to start" : "Waiting for host to start the game"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>
                {isHost
                  ? players.length < 2
                    ? "Need at least 2 players seated to start"
                    : `${players.length} players seated — click Start Game when ready`
                  : "Cards will be dealt once the host starts the hand"}
              </div>
            </div>
            {isHost && players.length >= 2 && (
              <button
                data-testid="floating-start-game-button"
                onClick={handleStartGame}
                style={{
                  marginLeft: "auto", padding: "9px 18px", borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg, var(--secondary), #dc2626)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "Outfit, sans-serif",
                  boxShadow: "0 4px 16px rgba(239,68,68,0.25)", flexShrink: 0,
                }}
              >
                Start Game
              </button>
            )}
          </div>
        )}

        {/* Re-buy CTA — floating above bottom bar */}
        {isBusted && !pendingRequests.some((r) => r.playerId === userId) && (
          <div data-testid="rebuy-cta" style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderRadius: 16, zIndex: 40,
            background: "rgba(255,109,139,0.06)", border: "1px solid var(--secondary)",
          }}>
            <div>
              <div style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 700 }}>You're out of chips</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>Re-buy to stay in the game</div>
            </div>
            <button
              data-testid="rebuy-open-button"
              onClick={() => setIsRebuyOpen(true)}
              style={{
                marginLeft: 16, padding: "9px 18px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, var(--secondary), #dc2626)",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "Outfit, sans-serif",
                boxShadow: "0 4px 16px rgba(239,68,68,0.25)",
              }}
            >
              Re-buy
            </button>
          </div>
        )}

        {/* Requester waiting banner — floating */}
        {!isHost && !!myPendingRequest && (
          <div data-testid="pending-request-banner" style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
            borderRadius: 12, background: "rgba(228,215,253,0.06)",
            border: "1px solid rgba(228, 215, 253, 0.2)", zIndex: 40,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "var(--primary)",
              boxShadow: "0 0 8px rgba(228,215,253,0.6)",
            }} />
            <span style={{ color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
              {myPendingRequest?.requestType === "REBUY"
                ? "Waiting for host re-buy approval…"
                : "Waiting for host approval…"}
            </span>
          </div>
        )}
      </div>

      {/* ── Moon-style bottom tray ──────────────────────────────────────────── */}
      {isPortraitMobile ? (
        <div style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
        }} className="glass-panel rounded-t-[1.5rem] border-t border-[--outline-variant]/20">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setShowHelpOverlay((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
                  borderRadius: 999, border: "1px solid var(--outline-variant)",
                  background: showHelpOverlay ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Outfit, sans-serif",
                }}
              >
                <HelpCircle size={14} />
                Help
              </button>
              <button
                onClick={() => setShowLogOverlay((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
                  borderRadius: 999, border: "1px solid var(--outline-variant)",
                  background: showLogOverlay ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "Outfit, sans-serif",
                }}
              >
                <ScrollText size={14} />
                Log
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {myStack != null ? (
                <ChipAmount amount={myStack} iconSize={12} amountStyle={{ color: "var(--primary)", fontSize: 14, fontWeight: 800 }} />
              ) : (
                <span style={{ color: "var(--primary)", fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>—</span>
              )}
              {turnTimer && turnTimer.playerId === userId && <TurnTimerPill timer={turnTimer} />}
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            {gameState && gameState.phase !== "LOBBY" && gameState.phase !== "CLEANUP" ? (
              <ActionBar
                isActive={isActivePlayer}
                stack={myPlayerInfo?.stack || 0}
                currentBet={gameState?.currentBet || 0}
                playerBet={playerBet}
                minRaise={gameState?.minRaise || 0}
                pot={totalPot}
                compact
                turnTimer={turnTimer}
                userId={userId}
                onAction={handleAction}
              />
            ) : (
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500 }}>Waiting for hand…</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 40,
          padding: "0 16px 12px",
        }}>
          {gameState && gameState.phase !== "LOBBY" && gameState.phase !== "CLEANUP" ? (
            <ActionBar
              isActive={isActivePlayer}
              stack={myPlayerInfo?.stack || 0}
              currentBet={gameState?.currentBet || 0}
              playerBet={playerBet}
              minRaise={gameState?.minRaise || 0}
              pot={totalPot}
              bank={myStack ?? 0}
              turnTimer={turnTimer}
              userId={userId}
              onAction={handleAction}
            />
          ) : (
            <div className="glass-dock rounded-2xl border border-[--outline-variant]/15 px-5 py-6 flex justify-center items-center">
              <span className="text-sm text-white/35 font-medium">Waiting for hand…</span>
            </div>
          )}
        </div>
      )}

      {/* Game log overlay — toggle from bottom bar */}
      {showLogOverlay && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 70,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: isPortraitMobile ? "flex-end" : "center",
          justifyContent: "center",
          padding: isPortraitMobile ? 0 : 24,
        }} onClick={() => setShowLogOverlay(false)}>
          <div style={{
            width: "100%", maxWidth: isPortraitMobile ? "100%" : 420, maxHeight: isPortraitMobile ? "78dvh" : "70vh", overflow: "hidden",
            background: "var(--surface-container-low)", borderRadius: isPortraitMobile ? "1.5rem 1.5rem 0 0" : 20,
            border: "1px solid rgba(72, 71, 74, 0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(72, 71, 74, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Hand Log</span>
              <button onClick={() => setShowLogOverlay(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: isPortraitMobile ? "calc(78dvh - 60px)" : "calc(70vh - 60px)" }}>
              <GameLog logs={logs} players={mappedPlayers} />
            </div>
          </div>
        </div>
      )}

      {/* Host controls mobile sheet */}
      {showHostOverlay && isPortraitMobile && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 70,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0,
          }}
          onClick={() => setShowHostOverlay(false)}
        >
          <div
            style={{
              width: "100%", maxHeight: "78dvh", overflowY: "auto",
              borderRadius: "1.5rem 1.5rem 0 0",
              background: "var(--surface-container-low)",
              border: "1px solid rgba(72, 71, 74, 0.3)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              padding: "12px 12px calc(12px + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Host Controls</span>
              <button onClick={() => setShowHostOverlay(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <HostControlPanel />
          </div>
        </div>
      )}

      {/* Help overlay */}
      {showHelpOverlay && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 70,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: isPortraitMobile ? "flex-end" : "center",
          justifyContent: "center",
          padding: isPortraitMobile ? 0 : 24,
        }} onClick={() => setShowHelpOverlay(false)}>
          <div style={{
            width: "100%", maxWidth: isPortraitMobile ? "100%" : 360, padding: isPortraitMobile ? "18px 16px 24px" : 24,
            background: "var(--surface-container-low)", borderRadius: isPortraitMobile ? "1.5rem 1.5rem 0 0" : 20,
            border: "1px solid rgba(72, 71, 74, 0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 16px 0" }}>
              {isPortraitMobile ? "Quick Actions" : "Keyboard Shortcuts"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
              <div>{isPortraitMobile ? "Use the bottom action tray for Fold, Check/Call, Raise, and All-In." : <><kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>F</kbd> Fold</>}</div>
              <div>{isPortraitMobile ? "Tap Log to inspect hand history while playing." : <><kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>C</kbd> Call / Check</>}</div>
              {!isPortraitMobile && <div><kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>R</kbd> Raise</div>}
              {!isPortraitMobile && <div><kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 6 }}>A</kbd> All-In</div>}
            </div>
            <button onClick={() => setShowHelpOverlay(false)} style={{ marginTop: 20, padding: "10px 20px", borderRadius: 12, border: "none", background: "#a78bfa", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* Winner toast — no New Hand button, auto-start is handled by gateway */}
      {winner && (
        <WinnerToast
          winner={winner.name}
          pot={winner.pot}
          handName={winner.handName}
          compact={isPortraitMobile}
        />
      )}

      {/* Re-buy modal */}
      <BuyInModal
        isOpen={isRebuyOpen}
        onClose={() => setIsRebuyOpen(false)}
        onSubmit={handleRebuy}
        minAmount={0}
        seatIndex={players.find((p) => p.id === userId)?.seatIndex ?? 0}
        isGuest={true}
        initialDisplayName={myDisplayName || players.find((p) => p.id === userId)?.username || ""}
        mode="rebuy"
      />
    </div>
  );
}
