# components/poker — Component Inventory

All poker-specific UI components. These are **presentation-only** — no socket logic, no server calls.

| File | Lines | Purpose |
|------|-------|---------|
| `ActionBar.tsx` | 347 | Player action controls: fold/call/raise buttons, raise slider, keyboard shortcuts |
| `BuyInModal.tsx` | 232 | Modal for requesting a seat (buy-in) or re-buying after busting |
| `ChipAmount.tsx` | 123 | Chip icon + formatted amount display; `ChipIcon` exported separately |
| `FairnessModal.tsx` | 121 | Provably-fair verification: shows current commitment hash + last hand reveal |
| `GameLog.tsx` | ~200 | Scrollable hand history panel; imports formatters from `lib/gameLogFormatters.ts` |
| `PlayingCard.tsx` | 248 | SVG card renderer — face cards, suits, back-of-card |
| `PlayerPerspectiveView.tsx` | 544 | Hero-at-bottom arc layout: positions opponents around an ellipse, renders community board |
| `PokerTable.tsx` | 266 | Felt table with 10 seat slots in an oval layout |
| `Seat.tsx` | 372 | Individual seat: avatar, stack, bet, timer arc, dealer/SB/BB badges |
| `SettingsModal.tsx` | 153 | Host-only room settings editor: timer sliders for turnTimeout, timeBank, autoStartDelay |
| `WinnerToast.tsx` | 89 | Toast notification shown when a hand concludes (winner + amount + hand name) |

## Shared UI Primitives (../ui/)

- `Modal.tsx` — `BaseModal` wrapper used by `BuyInModal`, `SettingsModal`, `FairnessModal`. Handles Dialog.Root, AnimatePresence, overlay, and responsive positioning (portrait = bottom sheet, landscape = centered).

## Data Flow

```
RoomClient.tsx
  → toPlayerViewState() adapter (lib/overbet-to-player-view.ts)
    → PlayerPerspectiveView (hero + opponent layout)
      → Seat (individual player)
      → PlayingCard (hole/community cards)
  → ActionBar (shown only when it's the hero's turn)
  → GameLog (receives raw log entries from socket)
  → BuyInModal / SettingsModal / FairnessModal (conditionally rendered overlays)
```

## Props Conventions

- `isPortraitMobile: boolean` — passed to modals and some layout components to switch between bottom-sheet and centered layouts.
- `userId: string` — the local anonymous user ID from `useUser()`, used to identify the hero seat.
