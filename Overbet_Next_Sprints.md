# Overbet: Agile Sprint Plan (Target: Playable NLH MVP)

This document outlines the optimal sprint breakdown to reach the milestone defined as: **"An NLH game room can be created easily, shared with friends for them to join, and a game can be started."**

Sprints are strictly sized to maximize the context window of an Antigravity agent in Planning Mode. We have aggressively decoupled frontend and backend scopes so that these larger feature slices can be built entirely in parallel.

---

## 🚀 Execution Topology & Dependencies

### Phase A: Foundation (Sprints 1-5)
These foundational sprints (defined in `Sprint_Prompts.md`) establish the UI shell, the gateway baseline, the engine framework, the complete engine game loop, and the ledger math.

### Phase B: The Playable MVP (Parallelizable FE/BE)
This phase connects the foundation into a working product flow where a room can be created, joined, and a game started.
*   **Sprint 6:** Full Backend Gateway & Engine Integration (Room, Seats, Actions) 
*   **Sprint 7:** Full Frontend Room, Lobby, and Table Flow (UI & Client Sockets)

Because Socket.io typings and the Prisma DB schema were defined in Sprints 2 & 3, the frontend agent (Sprint 7) and the backend agent (Sprint 6) can operate completely independently of one another.

---

## 📝 Agent Prompts

### Sprint 6: Full Backend Integration (Room, Seats, Actions)
**Context Files:** `pokernow_dev_spec_v0_3.md` (Sections 8, 9, & 10)
**Scope:** `packages/db`, `packages/engine`, `apps/gateway`, `apps/web/src/actions` (Next.js server actions)

**Prompt for Antigravity Agent:**
> "I am building the 'Overbet' poker platform. Please execute 'Sprint 6: Full Backend Integration' in Planning Mode. Your scope is strictly backend (`packages/db`, `packages/engine`, `apps/gateway`, and `/apps/web` server APIs). Do not implement React UI components. Please plan and implement the following:
> 1. DB & API: Create a Next.js Server Action (or API route) to instantiate a new `Room` in the DB with a unique slug and standard NLH default configurations.
> 2. Gateway Seats: In `apps/gateway`, handle the `INTENT_SEAT_REQUEST` socket event (validate against DB) and allow the host connection to emit `EVENT_SEAT_APPROVED` which updates connected clients.
> 3. Engine Gateway Hooks: In `apps/gateway`, handle the `INTENT_START_GAME` and `INTENT_PLAYER_ACTION` events. Wire this so that the `packages/engine` processes player actions, evaluates showdowns, and fans out authoritative `EVENT` payloads."

---

### Sprint 7: Full Frontend Room, Lobby, and Table Flow
**Context Files:** `Overbet Brand System & Design Scheme.md`, `pokernow_dev_spec_v0_3.md` (Section 5)
**Scope:** `apps/web` (React Components, Tailwind UI, Socket Context)

**Prompt for Antigravity Agent:**
> "I am building the 'Overbet' poker platform. Please execute 'Sprint 7: Full Frontend Flow' in Planning Mode. Your scope is strictly the Next.js frontend (`apps/web`). Do not modify the gateway or engine logic. Please plan and implement the following:
> 1. Room Creation UI: Create a 'Start New Game' flow that calls the room creation API/Action and redirects the host to `/room/[slug]`. Add a 'Copy Link' share button.
> 2. Lobby UI & Sockets: Build the 'Pre-Game Lobby' UI in `/room/[slug]` using the dark-mode design system. Wire it to a client-side Socket.io provider that emits `INTENT_SEAT_REQUEST` and listens for `EVENT_SEAT_APPROVED`. Include the Host controls for approving seats.
> 3. Game Table UI: Build the minimal Game Table view (dark felt, player avatars in their approved seats, and the Host 'Start Game' control). When 'Start Game' is clicked, emit `INTENT_START_GAME` and render the table based on the incoming `EVENT` snapshots."
