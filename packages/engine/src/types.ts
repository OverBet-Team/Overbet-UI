export type GamePhase =
    | "LOBBY"
    | "HAND_INIT"
    | "POST_BLINDS_ANTES"
    | "DEAL_PRIVATE"
    | "PRE_FLOP_BETTING"
    | "DEAL_FLOP"
    | "FLOP_BETTING"
    | "DEAL_TURN"
    | "TURN_BETTING"
    | "DEAL_RIVER"
    | "RIVER_BETTING"
    | "SHOWDOWN"
    | "CLEANUP";

export type PlayerStatus = "ACTIVE" | "FOLDED" | "ALL_IN" | "BUSTED" | "SITTING_OUT";

export interface Player {
    id: string;
    stack: number;
    status: PlayerStatus;
    seatIndex: number;
    holeCards: string[];
    bet: number; // current bet in the active round
    hasActed: boolean;
}

export interface GameState {
    phase: GamePhase;
    pot: number;
    sidePots: { amount: number; eligiblePlayers: string[] }[];
    board: string[];
    deck: string[];
    players: Player[];
    dealerIndex: number;
    activePlayerIndex: number; // whose turn is it
    currentBet: number; // the highest bet so far in the round
    minRaise: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
}

export interface HandEvent {
    type: string;
    sequence: number;
    payload: any;
}

export interface PokerAction {
    type: "FOLD" | "CHECK" | "CALL" | "RAISE" | "ALL_IN";
    amount?: number;
}
