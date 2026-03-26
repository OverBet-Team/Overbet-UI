"use client";

/**
 * V2GameContainer — Container component for the v2 game UI.
 *
 * Responsibilities:
 * - Receives PlayerViewState from RoomClient (ai-studio live state)
 * - Calls toV2TableProps() to adapt state into v2 prop shapes
 * - Renders V2TableView (table layout) + V2Controls (action bar)
 * - Wraps output in V2ErrorBoundary — falls back to v1 PlayerPerspectiveView
 *   + ActionBar if any render error occurs
 *
 * This is the only v2 component that imports from v1. All other v2 components
 * are presentation-only and have no v1 knowledge.
 *
 * Feature flag: rendered only when ?ui=v2 (via useUIVersion in RoomClient).
 * CSS import: v2-tokens.css is imported by V2TableView (already scoped under .v2-root).
 */

import React, { Component, type ReactNode } from "react";
import type { PlayerViewState } from "@/lib/overbet-to-player-view";
import type { TurnTimer } from "@/components/poker/Seat";
import { toV2TableProps } from "@/lib/overbet-to-v2-view";
import { V2TableView } from "./V2TableView";
import { V2Controls, type PlayerActionType } from "./V2Controls";
// v1 fallback imports
import { PlayerPerspectiveView } from "@/components/poker/PlayerPerspectiveView";
import { ActionBar } from "@/components/poker/ActionBar";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface V2GameContainerProps {
  // Table state
  viewState: PlayerViewState;
  winnerId?: string;
  winnerCards?: string[];
  compactMode?: boolean;
  turnTimer?: TurnTimer | null;
  // Controls (mirrors ActionBarProps)
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  onAction: (type: PlayerActionType, amount?: number) => void;
}

// ── Error boundary — falls back to v1 on any render error ────────────────────

interface BoundaryState { hasError: boolean }

class V2ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  BoundaryState
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── V2GameContainer ───────────────────────────────────────────────────────────

export function V2GameContainer({
  viewState,
  winnerId,
  winnerCards,
  compactMode = false,
  turnTimer,
  isActive,
  stack,
  currentBet,
  playerBet,
  minRaise,
  pot,
  onAction,
}: V2GameContainerProps) {
  const tableProps = toV2TableProps(
    viewState,
    turnTimer,
    winnerId,
    winnerCards,
    compactMode
  );

  // v1 fallback rendered inside the error boundary
  const v1Fallback = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: "100%", position: "relative" }}>
      <PlayerPerspectiveView
        viewState={viewState}
        winnerId={winnerId}
        winnerCards={winnerCards}
        compactMode={compactMode}
        turnTimer={turnTimer}
      />
      <ActionBar
        isActive={isActive}
        stack={stack}
        currentBet={currentBet}
        playerBet={playerBet}
        minRaise={minRaise}
        pot={pot}
        onAction={onAction}
      />
    </div>
  );

  return (
    <V2ErrorBoundary fallback={v1Fallback}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: "100%", position: "relative" }}>
        <V2TableView {...tableProps} />
        <V2Controls
          isActive={isActive}
          stack={stack}
          currentBet={currentBet}
          playerBet={playerBet}
          minRaise={minRaise}
          pot={pot}
          onAction={onAction}
          turnTimer={turnTimer}
          compact={compactMode}
        />
      </div>
    </V2ErrorBoundary>
  );
}
