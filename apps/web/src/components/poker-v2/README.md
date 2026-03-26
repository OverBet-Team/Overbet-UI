# components/poker-v2 — V2 Component Inventory

V2 presentation components. Parallel to `components/poker/` (v1).
All components are **presentation-only** — no socket logic, no server calls.

## Data Flow

```
RoomClient.tsx  (feature flag: ?ui=v2)
  → toPlayerViewState()          [lib/overbet-to-player-view.ts — UNCHANGED]
    → toV2TableProps()            [lib/overbet-to-v2-view.ts — pure adapter]
      → V2GameContainer           [this dir — container, not presentational]
          → V2TableView           [replaces PlayerPerspectiveView]
              → V2Player          [replaces Seat — one per opponent + hero]
              → V2PlayingCard     [replaces PlayingCard — hole + community cards]
          → V2Controls            [replaces ActionBar — hero's turn only]
```

## Component Inventory

| File | Purpose | v1 Equivalent |
|------|---------|---------------|
| `V2GameContainer.tsx` | Container: calls toV2TableProps(), renders table + controls, wraps in ErrorBoundary | (RoomClient in-game section) |
| `V2TableView.tsx` | Arc layout: hero bottom, opponents in ellipse, community cards + pot | `PlayerPerspectiveView.tsx` |
| `V2Player.tsx` | Seat: glass-panel avatar, status badge, timer ring, chip count | `Seat.tsx` |
| `V2PlayingCard.tsx` | Card renderer: premium white card face, cyan winning glow | `PlayingCard.tsx` |
| `V2Controls.tsx` | Action bar: glass-panel, fold/check/raise/all-in, integrated timer | `ActionBar.tsx` |
| `card-constants.ts` | Card sizes, rank display map, parseCard() | (inline in PlayingCard.tsx) |
| `v2-tokens.css` | CSS design tokens and utilities scoped under `.v2-root` | `globals.css` tokens |

## Props Conventions

Inherited from `components/poker/` (same patterns, per poker/README.md):
- `isPortraitMobile: boolean` — switches between arc layout and compact portrait layout
- `userId: string` — identifies the hero seat (from `useUser()`)
- `compactMode?: boolean` — alias for `isPortraitMobile` used by PlayerPerspectiveView

V2-specific:
- `turnTimer?: TurnTimer | null` — integrated into V2Controls (not a separate pill)
- `winnerId?: string` — triggers cyan winner glow on winning seat
- `winnerCards?: string[]` — triggers cyan glow on winning cards

## CSS Scoping

All v2 styles are scoped under `.v2-root` (applied by V2GameContainer).
This prevents any v2 token from leaking into v1 components.

The `SUIT_SYMBOLS` constants are imported from `lib/gameLogFormatters.ts`.
Do not redefine them here.

## Relationship to v1

- v1 components (`components/poker/`) are **not modified** by v2.
- V2GameContainer wraps its output in a V2ErrorBoundary that falls back
  to v1 `PlayerPerspectiveView` + `ActionBar` if any v2 render error occurs.
- All modals (BuyInModal, SettingsModal, FairnessModal, WinnerToast, GameLog)
  remain at RoomClient level and are shared across both v1 and v2 paths.
