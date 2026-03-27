# lib — Adapters and Formatters

Pure utility modules — no React, no sockets, no DB access.

| File | Purpose |
|------|---------|
| `overbet-to-player-view.ts` | **Main state adapter.** Maps raw gateway/engine state → `PlayerViewState` props for `PlayerPerspectiveView`. Entry point: `toPlayerViewState(players, gameState, userId)`. Exports types: `PlayerViewState`, `HeroForView`, `OpponentForView`, `GameEnginePlayer`. |
| `pot-display.ts` | `getPotDisplayAmounts(state)` — normalizes pot + side-pots into `{ totalPot, currentRoundAmount }` for display. Used by the adapter above. |
| `gameLogFormatters.ts` | Constants and formatters for `GameLog.tsx`: `SUIT_SYMBOLS`, `PHASE_NAMES`, `ACTION_COLORS`, `ACTION_CLASS`, and `CardChip` component. |

## When to Add Here

Add to `lib/` when logic is:
- A pure function (input → output, no side effects)
- Reused by more than one component
- Converting between two data shapes (adapter pattern)

Do not add React components or hooks here. Do not add anything with socket or DB access.
