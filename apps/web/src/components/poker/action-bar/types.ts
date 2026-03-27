// Shared types for ActionBar module

import type { TurnTimer } from "../Seat";

export type PlayerActionType = "FOLD" | "CALL" | "CHECK" | "RAISE" | "ALL_IN";

export type ActionVariant = "fold" | "check" | "call" | "raise" | "all-in";

// Re-export TurnTimer for convenience
export type { TurnTimer };

export interface ActionBarProps {
  isActive: boolean;
  stack: number;
  currentBet: number;
  playerBet: number;
  minRaise: number;
  pot?: number;
  bank?: number;
  compact?: boolean;
  turnTimer?: TurnTimer | null;
  userId?: string;
  onAction: (actionType: PlayerActionType, amount?: number) => void;
}
