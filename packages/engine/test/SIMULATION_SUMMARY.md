# Engine Simulation Stress Suite — Summary

## Files Added/Modified

### Added
- `packages/engine/test/utils/invariants.ts` — Invariant validators (card integrity, board progression, chip conservation, turn validity, status sanity)
- `packages/engine/test/utils/simulation-harness.ts` — Reusable simulation harness with deterministic action driver, trace capture, rebuy-on-bust, failure context
- `packages/engine/test/simulation.test.ts` — Multi-player sweep tests (2–7 players × 30 rounds, 2/4 players × 50 rounds)

### Modified
- `packages/engine/src/variants/NLH.ts`:
  - EARLY_WIN: zero `pot` after awarding chips (fix chip creation)
  - UNCALLED_BET_RETURNED: subtract refund from `pot` (fix chip creation)
  - handleRoundEnd: subtract from `pot` when adding to side pots (fix double-counting)
- `packages/engine/test/engine.test.ts` — Regression test for EARLY_WIN chip conservation

## Invariants Checked

- **Card integrity**: No duplicate cards across hole cards, board, deck; valid card strings only
- **Board progression**: Board length matches phase (0/3/4/5 for preflop/flop/turn/river; CLEANUP allows 0,3,4,5)
- **Chip conservation**: `sum(stacks) + pot + sum(sidePots)` constant per hand
- **Turn validity**: `activePlayerIndex` points to ACTIVE or ALL_IN player in betting phases
- **Status sanity**: Valid player statuses, non‑negative stacks

## Bugs Found and Fixed

1. **EARLY_WIN chip creation**: Pot was awarded to winner but not zeroed, duplicating chips. Fixed by setting `pot = 0` after award.
2. **UNCALLED_BET_RETURNED chip creation**: Refund increased stack without reducing pot. Fixed by subtracting refund from `pot`.
3. **Side pot chip double-count**: Chips added to side pots without subtracting from main pot. Fixed by reducing `pot` when adding to side pots.

## Scenario Results

- 2 players × 30 rounds — pass
- 3 players × 30 rounds — pass
- 4 players × 30 rounds — pass
- 5 players × 30 rounds — pass
- 6 players × 30 rounds — pass
- 7 players × 30 rounds — pass
- 2 players × 50 rounds (extended stress) — pass
- 4 players × 50 rounds (extended stress) — pass

## Failure Replay

On failure, `lastError.simulationContext` contains:
- `baseSeed`, `handSeed`, `playerCount`, `round`, `handStep`
- `phase`, `activePlayerIndex`, `dealerIndex`, `pot`, `board`, `players`
- `traceWindow` (last 20 actions)
- `errorMessage`

Use these to reproduce a failing run with the same seed and configuration.

## Remaining Edge Cases

- `loadEvents` replay fidelity not yet tested
- Extreme player counts (8–10) not exercised
- Very large stacks / table stakes edge cases not covered
