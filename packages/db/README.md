# packages/db — Database Package

Prisma 5 client and PostgreSQL schema. Shared by `apps/web` (server actions) and `apps/gateway`.

## Schema (`prisma/schema.prisma`)

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | `id`, `username`, `isGuest` | Anonymous guests have `isGuest: true` |
| `Room` | `id`, `slug`, `name`, `status`, `hostId`, `settings` (JSON) | `settings` holds variant config (blinds, timers) |
| `RoomMember` | `roomId`, `userId`, `seatIndex`, `stack`, `status` | Status: `SEATED`, `PENDING`, `BUSTED` |
| `Hand` | `roomId`, `metadata` | One Hand per game played in a room |
| `HandEvent` | `handId`, `type`, `sequence`, `payload` (JSON) | Append-only event log for event sourcing |

## Event Sourcing Pattern

Rooms hydrate from `HandEvent` history, not from a denormalized snapshot:
1. Load all `HandEvent` rows for the latest `Hand` in the room.
2. Replay events into a fresh `NLHMachine` → reconstructs live game state.
3. New events are appended after each `applyAction()` call in the gateway.

## Usage

```typescript
// apps/web server actions — use the singleton
import { prisma } from '@overbet/db';

// apps/gateway — constructs its own PrismaClient directly
// (see apps/gateway/src/index.ts)
```

`packages/db/index.ts` exports a `PrismaClient` singleton. Import from `@overbet/db` in web server actions. Do not create a second client in the web app.

## Commands

```bash
pnpm --filter @overbet/db generate   # Regenerate Prisma client after schema changes
pnpm --filter @overbet/db db:push    # Push schema to DB (dev)
pnpm --filter @overbet/db db:migrate # Run migrations (production)
```
