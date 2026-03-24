/**
 * Real-time event base types based on spec Phase 20 (v0.3).
 * Provides forward-compatibility and idempotency hooks.
 */

export interface BaseIntent {
    /**
     * Schema version to ensure forward compatibility.
     * E.g. 1 for base definitions, maybe higher for mod platforms later
     */
    schema_version: number;
    room_id: string;
    hand_id?: string;
    client_msg_id: string; // Used for idempotency
}

export interface BaseEvent {
    schema_version: number;
    room_id: string;
    hand_id?: string;
    server_seq: number; // Used for strict ordering
}

// ==========================================
// INTENT_ types (Client -> Server)
// ==========================================

export interface IntentJoinRoom extends BaseIntent {
    type: "INTENT_JOIN_ROOM";
    // Optional: any auth or identity tokens
}

export interface IntentRequestSnapshot extends BaseIntent {
    type: "INTENT_REQUEST_SNAPSHOT";
}

export interface IntentPlayerAction extends BaseIntent {
    type: "INTENT_PLAYER_ACTION";
    action: {
        type: "FOLD" | "CHECK" | "CALL" | "RAISE" | "ALL_IN";
        amount?: number;
    };
}

export interface IntentSeatRequest extends BaseIntent {
    type: "INTENT_SEAT_REQUEST";
    seatIndex: number;
    stack: number;
    displayName?: string;
}

export interface IntentSeatApprove extends BaseIntent {
    type: "INTENT_SEAT_APPROVE";
    targetPlayerId: string;
}

export interface IntentSeatReject extends BaseIntent {
    type: "INTENT_SEAT_REJECT";
    targetPlayerId: string;
}

// --- Ledger INTENT types ---

export interface IntentAddOn extends BaseIntent {
    type: "INTENT_ADD_ON";
    amount: number;          // chips to add; host validates reasonableness
    targetPlayerId: string;  // host specifies which player receives the add-on
}

export interface IntentCashOut extends BaseIntent {
    type: "INTENT_CASH_OUT";
    // Amount = player's current engine stack (server-authoritative; not provided by client)
}

export interface IntentStopGame extends BaseIntent {
    type: "INTENT_STOP_GAME";
    // Host-only. Finalizes session: writes remaining CASH_OUTs, emits EVENT_SESSION_ENDED.
}

export interface IntentRequestLedger extends BaseIntent {
    type: "INTENT_REQUEST_LEDGER";
    // Any client can request current ledger snapshot (running or final)
}

export interface IntentConfirmLedger extends BaseIntent {
    type: "INTENT_CONFIRM_LEDGER";
}

export interface IntentDisputeEntry extends BaseIntent {
    type: "INTENT_DISPUTE_ENTRY";
    ledgerEntryId: string;
    note: string;
}

export interface IntentResolveDispute extends BaseIntent {
    type: "INTENT_RESOLVE_DISPUTE";
    disputeId: string;
    resolution: "ACKNOWLEDGED" | "OVERRIDDEN" | "DISMISSED";
    adjustmentAmount?: number; // required when resolution = "OVERRIDDEN"
    note?: string;
}

export interface IntentLockLedger extends BaseIntent {
    type: "INTENT_LOCK_LEDGER";
    // Host-only. Sets Room.status = 'SETTLED' regardless of confirmations.
}

export type AppIntent =
    | IntentJoinRoom
    | IntentRequestSnapshot
    | IntentPlayerAction
    | IntentSeatRequest
    | IntentSeatApprove
    | IntentSeatReject
    | IntentAddOn
    | IntentCashOut
    | IntentStopGame
    | IntentRequestLedger
    | IntentConfirmLedger
    | IntentDisputeEntry
    | IntentResolveDispute
    | IntentLockLedger;

// ==========================================
// EVENT_ types (Server -> Client)
// ==========================================

export interface EventStateSnapshot extends BaseEvent {
    type: "EVENT_STATE_SNAPSHOT";
    /**
     * The full authoritative state machine state.
     * Typed as any or unknown until engine logic is wired.
     */
    state: any;
}

export interface EventStateUpdate extends BaseEvent {
    type: "EVENT_STATE_UPDATE";
    /**
     * The incremental diff or action that occurred.
     */
    action: any;
}

export interface EventActionConfirmed extends BaseEvent {
    type: "EVENT_ACTION_CONFIRMED";
    client_msg_id: string;
    server_ts: number;
}

export interface EventSeatApproved extends BaseEvent {
    type: "EVENT_SEAT_APPROVED";
    playerId: string;
    displayName?: string;
    seatIndex: number;
    stack: number;
}

export interface EventError extends BaseEvent {
    type: "EVENT_ERROR";
    code: string;
    message: string;
}

// --- Ledger EVENT types ---

/** Serialized ledger entry safe for wire transport. */
export interface SerializedLedgerEntry {
    id: string;
    userId: string;
    type: string;
    amount: number;
    authorId: string;
    parentId?: string;
    note?: string;
    createdAt: string; // ISO string
}

export interface SerializedDispute {
    id: string;
    ledgerEntryId: string;
    raisedByUserId: string;
    note: string;
    status: string;
    resolvedByUserId?: string;
    resolvedAt?: string;
}

/** Shared ledger payload shape reused across EVENT_LEDGER_UPDATE, EVENT_SESSION_ENDED, EVENT_LEDGER_SNAPSHOT. */
export interface LedgerPayload {
    entries: SerializedLedgerEntry[];
    pnl: Record<string, number>;       // playerId → net chips
    settlement: SettlementTransfer[];
    confirmations: string[];           // userIds who confirmed the final ledger
    disputes: SerializedDispute[];
    roomStatus: string;
    isRunning: boolean;                // true = mid-game; stacks are unrealized
    zeroSumError?: number;             // present only if chip conservation violated
}

export interface SettlementTransfer {
    from: string;
    to: string;
    amount: number;
}

/** Broadcast after every hand (CLEANUP) and after every explicit ledger mutation. */
export interface EventLedgerUpdate extends BaseEvent {
    type: "EVENT_LEDGER_UPDATE";
    ledger: LedgerPayload;
}

/** Broadcast when host calls INTENT_STOP_GAME. isRunning = false inside ledger payload. */
export interface EventSessionEnded extends BaseEvent {
    type: "EVENT_SESSION_ENDED";
    ledger: LedgerPayload;
    stoppedBy: string;
}

/** Unicast to the requesting socket only. */
export interface EventLedgerSnapshot extends BaseEvent {
    type: "EVENT_LEDGER_SNAPSHOT";
    ledger: LedgerPayload;
}

export interface EventLedgerLocked extends BaseEvent {
    type: "EVENT_LEDGER_LOCKED";
    lockedBy: string;
}

export type AppEvent =
    | EventStateSnapshot
    | EventStateUpdate
    | EventActionConfirmed
    | EventSeatApproved
    | EventError
    | EventLedgerUpdate
    | EventSessionEnded
    | EventLedgerSnapshot
    | EventLedgerLocked;
