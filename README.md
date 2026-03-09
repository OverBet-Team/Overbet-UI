# Overbet — Real-Time Home-Game Poker

A minimalist, real-time multiplayer poker platform built with Next.js, Socket.io, and a pure TypeScript NLH engine.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Gateway | Express + Socket.io 4 |
| Engine | `@overbet/engine` — pure NLH state machine |
| Database | PostgreSQL via Prisma 5 (Supabase / Neon / Railway) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Local Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- A PostgreSQL database (Supabase free tier works perfectly)

### 1. Clone and install

```bash
git clone https://github.com/ColtFourtyFive/Overbet-UI.git
cd Overbet-UI
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local` and fill in:

- `DATABASE_URL` — pooled Postgres connection string
- `DIRECT_URL` — direct (non-pooled) connection string for migrations
- `NEXT_PUBLIC_GATEWAY_URL` — leave as `http://localhost:4000` for local dev

For the gateway, create `apps/gateway/.env`:

```bash
cp apps/gateway/.env.example apps/gateway/.env
```

And set `DATABASE_URL` to the same **direct** connection string.

### 3. Generate Prisma client and run migrations

```bash
pnpm --filter @overbet/db generate
pnpm --filter @overbet/db db:push   # or db:migrate for production
```

### 4. Run the full stack

In separate terminals:

```bash
# Terminal 1 — Next.js frontend (port 3000)
pnpm --filter web dev

# Terminal 2 — Socket.io gateway (port 4000)
pnpm --filter @overbet/gateway dev
```

Or run everything together with Turborepo:

```bash
pnpm dev
```

### 5. Open the app

Navigate to [http://localhost:3000](http://localhost:3000) and click **Start New Game**.

---

## Running Tests

```bash
# Engine unit tests
pnpm --filter @overbet/engine test

# Web component tests
pnpm --filter web test

# All tests
pnpm test
```

---

## Deployment

The frontend deploys to Vercel. The `vercel.json` at the root handles the build pipeline including `prisma generate`. Set the following environment variables in your Vercel project settings:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_GATEWAY_URL` (your deployed gateway URL)

The gateway should be deployed separately (Railway, Render, Fly.io, etc.) as a long-running Node.js process.

---

## Architecture

```
apps/
  web/          Next.js frontend (room creation, game table UI)
  gateway/      Socket.io server (game engine host, real-time events)
packages/
  engine/       Pure NLH poker state machine (no I/O)
  db/           Prisma client + schema
```

All game state is authoritative on the gateway. The frontend is a pure rendering client that communicates exclusively over WebSocket.
