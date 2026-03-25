# apps/gateway/src — Gateway Source

The authoritative realtime server. Owns all live game state, timers, and broadcast sequencing.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Express + Socket.IO setup, room lifecycle, all socket event handlers, timer management, state sanitization, event broadcast, and ledger handlers |
| `types.ts` | TypeScript interfaces for every `INTENT_*` and `EVENT_*` socket message including all ledger types |
| `ledger.ts` | Ledger DB write module: `writeLedgerEntry`, `writeSessionEndEntries` (transactional), `loadLedgerEntries`, `loadConfirmations`, `loadOpenDisputes`. Receives PrismaClient as parameter — never constructs its own. |

## Architecture

```
Socket.IO connection
  │
  ├── INTENT_JOIN_ROOM       → load room from DB, hydrate NLHMachine from HandEvents, emit EVENT_STATE_SNAPSHOT
  ├── INTENT_PLAYER_ACTION   → validate via NLHMachine, persist HandEvent, broadcast EVENT_STATE_UPDATE
  │                            CLEANUP phase also broadcasts EVENT_LEDGER_UPDATE (zero DB reads — uses cache)
  ├── INTENT_START_GAME      → advance NLHMachine to first hand, start turn timer, set Room.status=IN_PROGRESS
  ├── INTENT_SEAT_REQUEST    → add to pendingApprovals, notify host
  ├── INTENT_SEAT_APPROVE    → move player to seated, write BUY_IN ledger entry, notify client
  ├── INTENT_SETTINGS_UPDATE → update room in DB, broadcast EVENT_SETTINGS_UPDATED
  ├── INTENT_ADD_ON          → host adds chips to player, writes ADD_ON entry, broadcasts ledger+state
  ├── INTENT_CASH_OUT        → player exits between hands, writes CASH_OUT entry
  ├── INTENT_STOP_GAME       → host ends session, writes remaining CASH_OUTs, emits EVENT_SESSION_ENDED
  ├── INTENT_REQUEST_LEDGER  → unicast current ledger snapshot to requesting socket
  ├── INTENT_CONFIRM_LEDGER  → record player confirmation; auto-locks when all players confirm
  ├── INTENT_DISPUTE_ENTRY   → player raises dispute on an entry
  ├── INTENT_RESOLVE_DISPUTE → host resolves dispute (OVERRIDDEN writes ADJUSTMENT entry)
  ├── INTENT_LOCK_LEDGER     → host manually sets Room.status=SETTLED
  └── disconnect             → remove from room, pause game if needed
```

## Key Responsibilities

- **One `NLHMachine` per room** — instantiated in memory when a room is first joined, hydrated from `HandEvent` history in Postgres.
- **Sanitization** — `sanitizeState()` and `sanitizeEvent()` strip hidden information (opponent hole cards, deck state) before any broadcast. Never bypass these.
- **Turn timers** — `setTimeout`/`clearTimeout` logic in `index.ts`; fires `INTENT_PLAYER_ACTION` with `AUTO_FOLD` when a player's turn clock expires.
- **Event persistence** — every `NLHMachine` event is written to `HandEvent` in Postgres so rooms can be hydrated after restart.
- **Broadcast sequencing** — `server_seq` increments monotonically per room; clients use this to detect missed updates.


## Ledger Concurrency & Correctness

- `lockLedger` is idempotent — `updateMany` with `status: { not: 'SETTLED' }` prevents duplicate transitions.
- `writeSessionEndEntries` wraps all CASH_OUT creates in a Prisma `$transaction` — all-or-nothing.
- `INTENT_ADD_ON` writes DB (roomMember + ledger entry) before mutating engine state. DB failure leaves engine unmodified.
- Disputes use typed status: `'OPEN' | 'ACKNOWLEDGED' | 'OVERRIDDEN' | 'DISMISSED'`.
## Protocol Types (`types.ts`)

All socket messages are typed. Clients send `INTENT_*`, gateway emits `EVENT_*`. Every message includes:
- `schema_version: number` — increment only on breaking changes
- `client_msg_id?: string` — UUID from client for deduplication
- `server_seq?: number` — monotonic broadcast counter

## Environment

Requires `apps/gateway/.env`:
- `DATABASE_URL` — direct (non-pooled) Postgres connection
