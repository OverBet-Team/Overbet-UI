/**
 * Maps OverBet game state to presentation-ready shapes for moon-poker ported components.
 * OverBet remains source of truth; this is display-only mapping.
 */

export type OverBetPhase =
  | 'LOBBY'
  | 'HAND_INIT'
  | 'POST_BLINDS_ANTES'
  | 'DEAL_PRIVATE'
  | 'PRE_FLOP_BETTING'
  | 'DEAL_FLOP'
  | 'FLOP_BETTING'
  | 'DEAL_TURN'
  | 'TURN_BETTING'
  | 'DEAL_RIVER'
  | 'RIVER_BETTING'
  | 'SHOWDOWN'
  | 'CLEANUP';

export type OverBetPlayerStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'BUSTED' | 'SITTING_OUT';

export interface OverBetPlayer {
  id: string;
  displayName?: string;
  stack: number;
  status: OverBetPlayerStatus;
  seatIndex: number;
  holeCards: string[];
  bet: number;
  hasActed: boolean;
}

export type DisplayPlayerStatus = 'active' | 'called' | 'folded' | 'raised' | 'checked' | 'all-in' | 'waiting';

/**
 * Map OverBet status to display label.
 */
export function mapOverBetStatus(status: OverBetPlayerStatus): DisplayPlayerStatus {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'FOLDED':
      return 'folded';
    case 'ALL_IN':
      return 'all-in';
    case 'BUSTED':
      return 'folded';
    case 'SITTING_OUT':
      return 'waiting';
    default:
      return 'waiting';
  }
}

/**
 * Get display label for status (for badges).
 */
export function getStatusLabel(status: DisplayPlayerStatus): string {
  const labels: Record<DisplayPlayerStatus, string> = {
    active: 'Active',
    called: 'Called',
    folded: 'Folded',
    raised: 'Raised',
    checked: 'Checked',
    'all-in': 'All-In',
    waiting: 'Waiting',
  };
  return labels[status];
}
