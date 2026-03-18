# Repository Guidelines

## Project Overview
Overbet is a pnpm/Turborepo monorepo for a real-time multiplayer poker product.

Primary runtime pieces:
- `apps/web`: Next.js App Router frontend and server actions
- `apps/gateway`: Express + Socket.IO authoritative realtime server
- `packages/engine`: pure TypeScript poker engine (`NLHMachine`)
- `packages/db`: Prisma client and schema for PostgreSQL

The gateway is the source of truth for live game state. The web app renders snapshots and emits intents; it does not own game rules.

## Architecture & Data Flow
1. Room creation/read flows go through Next server actions in `apps/web/src/app/actions/room.ts`, which use `@overbet/db` directly.
2. Room play happens over Socket.IO from `apps/web/src/app/room/[slug]/RoomClient.tsx` to `apps/gateway/src/index.ts`.
3. The gateway hydrates room state from Prisma, hosts one in-memory `NLHMachine` per room, persists/reloads hand events, and emits sanitized snapshots.
4. The engine package (`packages/engine/src/`) is intentionally pure: no DB, no sockets, no framework code.
5. The UI converts authoritative state into presentation-oriented structures through adapters such as `apps/web/src/lib/overbet-to-player-view.ts`.

Important architectural boundaries:
- `packages/engine` is the rules/state-machine layer.
- `apps/gateway` owns timers, auto-actions, room lifecycle, sanitization, and broadcast sequencing.
- `apps/web` owns rendering, local UI state, and server-side room CRUD.
- `packages/db` owns Prisma schema/client only.

## Key Directories
- `apps/web/src/app/`: Next.js routes, layouts, and server actions
- `apps/web/src/components/poker/`: poker-specific UI components
- `apps/web/src/hooks/`: client hooks such as `useUser`
- `apps/web/src/lib/`: mapping/adaptation helpers between gateway/engine state and UI props
- `apps/gateway/src/`: Express/Socket.IO server, protocol types, room orchestration
- `packages/engine/src/variants/NLH.ts`: main Hold'em machine implementation
- `packages/engine/src/types.ts`: engine contracts and events
- `packages/engine/src/math/`: ledger/math helpers
- `packages/db/prisma/schema.prisma`: database schema
- `tests/e2e/`: Playwright browser tests
- `tests/browser-cli/`: multi-session agent-browser smoke/soak scripts and artifacts

## Important Files
- `package.json`: root commands; use these first
- `pnpm-workspace.yaml`: workspace membership (`apps/*`, `packages/*`)
- `turbo.json`: Turborepo pipeline and shared env
- `playwright.config.ts`: starts gateway on `4000` and web on `3000`
- `vitest.workspace.ts`: Vitest workspace across `apps/*` and `packages/*`
- `apps/gateway/src/index.ts`: core authoritative server implementation
- `apps/gateway/src/types.ts`: socket intent/event contracts
- `apps/web/src/app/room/[slug]/RoomClient.tsx`: main client realtime room flow
- `apps/web/src/app/actions/room.ts`: room creation/loading on the web side
- `packages/db/index.ts`: shared Prisma singleton export
- `packages/db/prisma/schema.prisma`: `User`, `Room`, `RoomMember`, `Hand`, `HandEvent`

## Development Commands
Run commands from repository root unless a package-specific command is clearer.

Workspace-level:
```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

Targeted commands:
```bash
pnpm --filter web dev
pnpm --filter @overbet/gateway dev
pnpm --filter @overbet/engine test
pnpm --filter web test
pnpm --filter @overbet/db generate
```

Browser automation tiers:
```bash
pnpm test:browser:agent
pnpm test:browser:agent:3p
pnpm test:browser:agent:timer:matrix
```

Prefer filtered package commands for local verification instead of full-workspace runs.

## Runtime/Tooling Preferences
- Package manager: `pnpm` only (`packageManager` is `pnpm@8.15.0`)
- Runtime: Node 20 (`.node-version` is `20.11.1`; CI uses Node 20)
- Monorepo orchestration: Turborepo
- Frontend linting: `apps/web/eslint.config.mjs` with Next core-web-vitals + TypeScript rules
- Formatting: root `format` script uses Prettier for `*.ts`, `*.tsx`, `*.md`
- Database: Prisma 5 + PostgreSQL; `DATABASE_URL` and `DIRECT_URL` are shared Turbo global env vars

Do not introduce npm/yarn lockfiles, alternate package managers, or Bun-specific commands.

## Code Conventions & Common Patterns

### Realtime protocol
- Socket contracts are explicit TypeScript interfaces in `apps/gateway/src/types.ts`.
- Client messages use `INTENT_*`; server messages use `EVENT_*`.
- Preserve `schema_version`, `client_msg_id`, and `server_seq` semantics when touching protocol code.

### Authoritative-state pattern
- The gateway sanitizes state before broadcasting (`sanitizeState`, `sanitizeEvent` in `apps/gateway/src/index.ts`).
- Never move hidden-information filtering into the client.
- The UI should treat socket snapshots as authoritative, then derive view models locally.

### UI state mapping
- `RoomClient.tsx` is large and stateful; before editing, trace whether logic belongs there or in adapters/components.
- Use helpers like `toPlayerViewState()` for presentation mapping instead of duplicating player/board normalization in components.

### Engine expectations
- Keep engine code pure and deterministic.
- Engine tests assume invariant-heavy behavior: chip conservation, phase progression, invalid-action rejection, deterministic seeded starts.
- If a change affects game rules, update engine tests first and propagate effects into gateway/web consumers.

### Database access
- Web server actions import the Prisma singleton from `@overbet/db`.
- `apps/gateway/src/index.ts` currently constructs a `PrismaClient` directly; be careful not to accidentally create conflicting access patterns elsewhere.
- Persistence is event-oriented: rooms hydrate from `HandEvent` history, not only from a denormalized room snapshot.

### Identity/session pattern
- `apps/web/src/hooks/useUser.ts` generates/stores a local anonymous user id in `localStorage` under `overbet_user_id`.
- Avoid edits that break anonymous-session continuity unless you are intentionally redesigning identity.

## Testing & QA

### Unit/integration layers
- Root `pnpm test` runs Vitest across workspaces.
- `packages/engine/test/` is the strongest behavioral safety net; it covers rule progression and invariants.
- `apps/web/test/` uses Vitest + Testing Library with `jsdom`.
- `apps/gateway/test/` contains socket/server tests, but some are lightweight and do not fully exercise the production gateway flow.

### Browser/e2e layers
- `playwright.config.ts` runs end-to-end tests from `tests/e2e/` and auto-starts both gateway and web servers.
- `tests/browser-cli/README.md` documents higher-level agent-browser smoke, timer, soak, and N-player validation flows.
- Browser-cli scripts default to short timer settings and expect Bash plus a local Chrome/Chromium install.
- On Windows, those scripts still rely on Bash (`bash ./tests/browser-cli/...`) and `tests/browser-cli/agent-browser-env.sh`; use Git Bash/WSL or equivalent.

### What to run for verification
- Engine rule change: `pnpm --filter @overbet/engine test`
- Web rendering/component change: `pnpm --filter web test`
- Gateway realtime logic change: relevant gateway Vitest plus Playwright or browser-cli coverage if sockets/timers changed
- Cross-client/timer behavior: `pnpm test:e2e` or the targeted browser-cli tier

## Deployment & CI Notes
- CI is `.github/workflows/test.yml`: install with pnpm, then run `pnpm test`. `pnpm prisma generate` and `pnpm lint` are currently allowed to fail (`|| true`), so do not treat CI as strict lint/type coverage.
- `vercel.json` builds the web app after Prisma generation.
- `DEPLOYMENT.md` documents a split deployment model: gateway first, then web.
- `packages/db/prisma/schema.prisma` sets Prisma binary targets for native and `rhel-openssl-3.0.x`; keep that in mind for deploy/runtime changes.

## Assistant Guidelines
- Start from the package boundary: engine -> gateway -> web. Fix contract violations at the owning layer.
- Before changing protocol types or exported symbols, inspect consumers across both `apps/` and `packages/`.
- Prefer small, targeted verification commands over full monorepo runs.
- Do not treat historical docs in `docs/specs/`, archived planning docs in `docs/archive/planning/`, or preserved verification outputs under `artifacts/` as source of truth over current code.
- When editing gameplay or timer logic, verify both hidden-information guarantees and cross-client convergence, not just single-client happy paths.
