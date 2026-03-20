# apps/gateway/src — Gateway Source

The authoritative realtime server. Owns all live game state, timers, and broadcast sequencing.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Express + Socket.IO setup, room lifecycle, all socket event handlers, timer management, state sanitization, and event broadcast |
| `types.ts` | TypeScript interfaces for every `INTENT_*` and `EVENT_*` socket message |

## Architecture

```
Socket.IO connection
  │
  ├── INTENT_JOIN_ROOM     → load room from DB, hydrate NLHMachine from HandEvents, emit EVENT_STATE_SNAPSHOT
  ├── INTENT_PLAYER_ACTION → validate via NLHMachine, persist HandEvent, broadcast EVENT_STATE_UPDATE
  ├── INTENT_START_GAME    → advance NLHMachine to first hand, start turn timer
  ├── INTENT_SEAT_REQUEST  → add to pendingApprovals, notify host
  ├── INTENT_APPROVE_SEAT  → move player to seated, notify client
  ├── INTENT_SETTINGS_UPDATE → update room in DB, broadcast EVENT_SETTINGS_UPDATED
  └── disconnect           → remove from room, pause game if needed
```

## Key Responsibilities

- **One `NLHMachine` per room** — instantiated in memory when a room is first joined, hydrated from `HandEvent` history in Postgres.
- **Sanitization** — `sanitizeState()` and `sanitizeEvent()` strip hidden information (opponent hole cards, deck state) before any broadcast. Never bypass these.
- **Turn timers** — `setTimeout`/`clearTimeout` logic in `index.ts`; fires `INTENT_PLAYER_ACTION` with `AUTO_FOLD` when a player's turn clock expires.
- **Event persistence** — every `NLHMachine` event is written to `HandEvent` in Postgres so rooms can be hydrated after restart.
- **Broadcast sequencing** — `server_seq` increments monotonically per room; clients use this to detect missed updates.

## Protocol Types (`types.ts`)

All socket messages are typed. Clients send `INTENT_*`, gateway emits `EVENT_*`. Every message includes:
- `schema_version: number` — increment only on breaking changes
- `client_msg_id?: string` — UUID from client for deduplication
- `server_seq?: number` — monotonic broadcast counter

## Environment

Requires `apps/gateway/.env`:
- `DATABASE_URL` — direct (non-pooled) Postgres connection
