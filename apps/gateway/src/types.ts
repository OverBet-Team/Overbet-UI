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
}

export type AppIntent =
    | IntentJoinRoom
    | IntentRequestSnapshot
    | IntentPlayerAction
    | IntentSeatRequest;

// ==========================================
// EVENT_ types (Server -> Client)
// ==========================================

export interface EventStateSnapshot extends BaseEvent {
    type: "EVENT_STATE_SNAPSHOT";
    /**
     * The full authoritative state machine state.
     * Typed as ny or unknown until engine logic is wired.
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
    seatIndex: number;
    stack: number;
}

export type AppEvent =
    | EventStateSnapshot
    | EventStateUpdate
    | EventActionConfirmed
    | EventSeatApproved;
