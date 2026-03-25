# packages/engine/src — Engine Source

Pure TypeScript NLH poker state machine. **No I/O of any kind** — no DB, no sockets, no framework imports. Deterministic and testable in isolation.

## Files

| File | Purpose |
|------|---------|
| `PokerEngine.ts` | Interface definition that all engine variants implement |
| `types.ts` | Engine type contracts: `GameState`, `PlayerState`, `EngineEvent`, action types |
| `variants/NLH.ts` | `NLHMachine` — full No-Limit Hold'em implementation (697 lines). Handles deal, betting rounds, showdown, side-pot calculation, and cleanup. |
| `math/Ledger.ts` | Ledger accounting: `LedgerMath` (session P&L, settlement matrix), `computeLedgerSnapshot` (pure running/final snapshot with ADJUSTMENT/VOID resolution), `LedgerSnapshot`, `LedgerEntry`, `SettlementTransfer`. Enforces circular-reference protection, single-active-adjustment per entry (last-write-wins), deterministic settlement sorting, and zero-sum violation warnings. |
| `utils/Deck.ts` | Deck construction, seeded shuffle (Mersenne Twister), card utilities |

## How It Works

```
NLHMachine
  .applyAction(playerId, action)    // advance state, returns events emitted
  .getState()                       // current GameState snapshot
  .getEvents()                      // full event log (used for event sourcing)
```

The gateway creates one `NLHMachine` per room, calls `applyAction()` for each player move, and persists the resulting events to `HandEvent` in Postgres. On restart, the machine is reconstituted by replaying the stored events.

## Key Properties

- **Deterministic** — deck shuffle uses a seeded Mersenne Twister; same seed always produces same shuffle.
- **Event-sourced** — all state changes are derived from an append-only event log.
- **Invariant-heavy** — chip conservation, phase progression, and invalid-action rejection are enforced and tested.

## Tests (`../test/`)

The engine test suite is the primary behavioral safety net. Run before/after any rule change:

```bash
pnpm --filter @overbet/engine test
```

Key test files:
- `engine.test.ts` — rule progression, phase transitions
- `simulation.test.ts` — multi-hand simulation
- `fuzz-seeded.test.ts` — seeded random play
- `utils/invariants.ts` — chip conservation and state invariant checkers
- `ledger.test.ts` — ledger P&L, settlement, ADJUSTMENT/VOID resolution, circular-reference protection, deterministic ordering
