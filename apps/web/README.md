# apps/web — Next.js Frontend

Next.js 15 App Router frontend for Overbet. **Rendering-only client** — all game logic lives in `apps/gateway` and `packages/engine`.

- **Port:** 3000 (local dev)
- **Package name:** `web`
- **Framework:** Next.js 15, React 19, Tailwind CSS 4

## Source Structure

See `src/README.md` for a full directory map. Quick overview:

```
src/
├── app/                  # Next.js routes + server actions
│   ├── actions/room.ts   # Room CRUD (create, load) via Prisma
│   ├── room/[slug]/      # Realtime game room (RoomClient.tsx is the main entry)
│   ├── HomeClient.tsx    # Lobby / room creation UI
│   └── globals.css
├── components/
│   ├── poker/            # All poker-specific UI components (11 files)
│   └── ui/               # Shared primitives (Modal, Popover, Tooltip)
├── hooks/                # Client hooks (useUser, game hooks)
├── lib/                  # Adapters and formatters
└── types/
```

## Commands

```bash
pnpm --filter web dev     # Dev server on :3000
pnpm --filter web test    # Vitest + Testing Library
pnpm --filter web build   # Production build
```

## Environment Variables

Requires `apps/web/.env.local`:
- `DATABASE_URL` — pooled Postgres connection string
- `DIRECT_URL` — direct (non-pooled) for migrations
- `NEXT_PUBLIC_GATEWAY_URL` — Socket.IO gateway URL (default: `http://localhost:4000`)
