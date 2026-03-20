# app/room/[slug] — Realtime Room Flow

## Files

| File | Purpose |
|------|---------|
| `page.tsx` | Server component — fetches room from DB via server action, renders `RoomClient` |
| `RoomClient.tsx` | Main realtime client — all socket logic, game state, and UI orchestration |

## What RoomClient Does

`RoomClient.tsx` is the stateful core of the game UI. It:

1. **Connects** to the gateway via Socket.IO on mount (`NEXT_PUBLIC_GATEWAY_URL`).
2. **Joins** the room by emitting `INTENT_JOIN_ROOM` with the room slug and user ID.
3. **Receives** authoritative state via `EVENT_STATE_SNAPSHOT` / `EVENT_STATE_UPDATE` — stores it in React state.
4. **Adapts** raw gateway state into view props using `toPlayerViewState()` from `lib/overbet-to-player-view.ts`.
5. **Renders** either `LobbyLayout` (pre-game) or the active game UI (`PlayerPerspectiveView`, `ActionBar`, overlays).
6. **Emits** player intents (`INTENT_PLAYER_ACTION`, `INTENT_START_GAME`, etc.) in response to UI events.

## Socket Message Types

Defined in `apps/gateway/src/types.ts`. Pattern:
- `INTENT_*` — client → gateway (player wants to do something)
- `EVENT_*` — gateway → client (authoritative state change)

## State Ownership

- **Live game state** (`gameState`) — owned by gateway, treated as read-only on the client.
- **UI-only state** (modal open/close, overlay visibility, timer countdown) — local React state in RoomClient.
- **Room metadata** (seat list, room name, host ID) — loaded from server action, then updated via socket events.

## Before Editing

- Trace whether new logic belongs in RoomClient, in an adapter (`lib/`), or in a component.
- Do not filter hidden information (opponent cards, deck) on the client — that is the gateway's job.
- See `apps/gateway/src/README.md` for the server-side counterpart.
