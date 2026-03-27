# hooks — Client Hooks

Client-side React hooks for the web app.

| File | Purpose |
|------|---------|
| `useUser.ts` | Generates and persists an anonymous user ID in `localStorage` under `overbet_user_id`. Returns `{ userId }`. Used by RoomClient to identify the hero seat. |

## Conventions

- All hooks in this directory are client-only (`'use client'` context assumed).
- Hooks that manage socket connections or game state belong in `hooks/game/` (a subdirectory, created when RoomClient is split).
- Do not import server-only modules (`@overbet/db`, Prisma) from hooks.
