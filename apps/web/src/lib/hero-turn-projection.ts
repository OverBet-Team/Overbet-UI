import type { TurnTimer } from "@/components/poker/Seat";

export { toPlayerViewState } from "@/lib/overbet-to-player-view";

const EMPTY_ACTIVE_PLAYER_ID = "";

export interface HeroTurnProjectionInput {
  userId: string;
  heroStatus?: string | null;
  phase?: string | null;
  activePlayerId?: string | null;
  turnTimer?: Pick<
    TurnTimer,
    "playerId" | "expiresAt" | "phase" | "timeBankMs"
  > | null;
  nowMs: number;
}

export interface HeroTurnProjection {
  isBettingPhase: boolean;
  heroHasAuthoritativeTurn: boolean;
  heroTimerExpiredLocally: boolean;
  heroCanAct: boolean;
  showHeroTimer: boolean;
  projectedViewActivePlayerId: string;
}

export function isBettingPhase(phase?: string | null): boolean {
  return !!phase && phase.endsWith("BETTING");
}

function getFinalTurnDeadlineMs(
  timer: Pick<TurnTimer, "expiresAt" | "phase" | "timeBankMs">,
): number {
  if (timer.phase === "timebank") {
    return timer.expiresAt;
  }

  // In base phase, a client can still act through time bank. If the explicit
  // timebank timer event is delayed/missed, we still project against the full
  // local deadline to avoid stale action-bar truthfulness.
  return timer.expiresAt + Math.max(timer.timeBankMs, 0);
}

function canStatusAct(status?: string | null): boolean {
  if (!status) return true;
  return status === "ACTIVE";
}

/**
 * Derives local hero-turn truth from authoritative state + local timer wall-clock.
 *
 * Gateway state remains authoritative; this only projects what this client can truthfully
 * claim about the local hero's immediate ability to act while timeout propagation is in flight.
 */
export function projectHeroTurnState({
  userId,
  heroStatus,
  phase,
  activePlayerId,
  turnTimer,
  nowMs,
}: HeroTurnProjectionInput): HeroTurnProjection {
  const bettingPhase = isBettingPhase(phase);
  const heroHasAuthoritativeTurn =
    bettingPhase && !!userId && activePlayerId === userId;

  const timerBelongsToHero = !!turnTimer && turnTimer.playerId === userId;
  const shouldEvaluateHeroTimer =
    heroHasAuthoritativeTurn && timerBelongsToHero;

  const finalTurnDeadlineMs = turnTimer
    ? getFinalTurnDeadlineMs(turnTimer)
    : null;

  const heroTimerExpiredLocally =
    shouldEvaluateHeroTimer &&
    finalTurnDeadlineMs !== null &&
    finalTurnDeadlineMs <= nowMs;

  const heroStatusCanAct = canStatusAct(heroStatus);
  const heroCanAct =
    heroHasAuthoritativeTurn && heroStatusCanAct && !heroTimerExpiredLocally;
  const showHeroTimer = shouldEvaluateHeroTimer && heroCanAct;

  const projectedViewActivePlayerId =
    heroHasAuthoritativeTurn && !heroCanAct
      ? EMPTY_ACTIVE_PLAYER_ID
      : (activePlayerId ?? EMPTY_ACTIVE_PLAYER_ID);

  return {
    isBettingPhase: bettingPhase,
    heroHasAuthoritativeTurn,
    heroTimerExpiredLocally,
    heroCanAct,
    showHeroTimer,
    projectedViewActivePlayerId,
  };
}
