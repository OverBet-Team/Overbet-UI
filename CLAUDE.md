# Overbet — Claude Code Context

> Full guidelines live in `AGENTS.md`. This file is the fast-path entry point for Claude Code sessions.

## What This Is

Real-time multiplayer poker platform. pnpm/Turborepo monorepo with four packages:

| Package | Purpose | Port |
|---------|---------|------|
| `apps/web` | Next.js 15 frontend — rendering only | 3000 |
| `apps/gateway` | Express + Socket.IO authoritative server | 4000 |
| `packages/engine` | Pure TypeScript NLH state machine (no I/O) | — |
| `packages/db` | Prisma 5 + PostgreSQL schema/client | — |

**Authority model:** Engine owns rules → Gateway owns live state + timers → Web owns rendering.

## Start Here by Task

| Task | Entry point |
|------|------------|
| UI component work | `apps/web/src/components/poker/` → see `README.md` there |
| Room/game flow (client) | `apps/web/src/app/room/[slug]/RoomClient.tsx` → see `README.md` there |
| Realtime server / socket events | `apps/gateway/src/index.ts` → see `apps/gateway/src/README.md` |
| Poker rules / state machine | `packages/engine/src/variants/NLH.ts` → see `packages/engine/src/README.md` |
| Database schema | `packages/db/prisma/schema.prisma` → see `packages/db/README.md` |
| State-to-UI adapters | `apps/web/src/lib/` → see `README.md` there |
| Client hooks | `apps/web/src/hooks/` → see `README.md` there |
| Server actions (room CRUD) | `apps/web/src/app/actions/room.ts` |
| Socket protocol types | `apps/gateway/src/types.ts` |

## Critical Constraints

- `packages/engine` must stay pure — no DB, no sockets, no framework imports.
- Gateway is the only place that sanitizes hidden state (opponent hole cards). Never move sanitization to the client.
- Socket messages: `INTENT_*` = client→server, `EVENT_*` = server→client. Preserve `schema_version` and `server_seq`.
- Package manager: `pnpm` only. Do not introduce npm/yarn/bun.

## Key Commands

```bash
pnpm dev                          # Start all apps
pnpm test                         # All Vitest tests
pnpm --filter web test            # Web tests only
pnpm --filter @overbet/engine test # Engine tests (safety net for rule changes)
pnpm --filter @overbet/gateway test
pnpm test:e2e                     # Playwright (starts gateway + web automatically)
```

## Subdirectory READMEs

Detailed navigation for each area of the codebase:
- `apps/web/src/README.md` — web source structure
- `apps/web/src/components/poker/README.md` — component inventory
- `apps/web/src/app/room/[slug]/README.md` — room flow detail
- `apps/web/src/hooks/README.md` — hook inventory
- `apps/web/src/lib/README.md` — adapter/utility inventory
- `apps/gateway/src/README.md` — gateway architecture
- `packages/engine/src/README.md` — engine module layout
- `packages/db/README.md` — schema and Prisma patterns
