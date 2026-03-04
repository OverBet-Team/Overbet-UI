# Sprint Prompts for Overbet Agents

Here are the specific, constrained prompts you can use to spin up new agents for each Sprint phase. By scoping them specifically, the agents will have higher accuracy and fewer context issues.

## Sprint 1: Frontend UI Shell Completion
**Context File to provide:** `Overbet Brand System & Design Scheme.md` and `pokernow_dev_spec_v0_3.md` (Sections 1-5).

**Prompt:**
> "I have initialized a Turborepo workspace for 'Overbet'. Your scope is strictly confined to the `apps/web` Next.js frontend directory; do not modify backend packages. Please finish the Phase 0->20 Foundation 'UI Shell Completion' based on the 'Overbet Brand System & Design Scheme.md' and the 'pokernow_dev_spec_v0_3.md'. Your tasks are:
> 1. Apply the 'Navy Theme' color tokens defined in the design scheme to a global level (e.g. `layout.tsx` or `globals.css`).
> 2. Implement the root `page.tsx` as a sleek 'Landing' page with a 'Start New Game' and 'Join Room' action trigger.
> 3. Ensure the UI represents the Offsuit-grade minimalist, dark-mode design with the correct Accent1 (Orange-Red) for primary actions."

---

## Sprint 2: Real-Time Sync Protocol & Gateway
**Context File to provide:** `pokernow_dev_spec_v0_3.md` (Sections 7 & 8).

**Prompt:**
> "I have a monorepo for a poker app called 'Overbet' with an Express/Socket.io server initialized in `apps/gateway`. Your scope is strictly confined to the `apps/gateway` package; do not modify the UI or the DB. Please finalize the 'Phase 20 Real-Time Sync Protocol' logic based on the `pokernow_dev_spec_v0_3.md`. Your tasks are:
> 1. Expand the Socket.io logic to support basic 'Room Presence' (users joining specific socket rooms).
> 2. Implement the 'Snapshot/Catch-up' system for clients to sync state upon reconnecting.
> 3. Define typings for the core `INTENT_` patterns and `EVENT_` update fanouts in the gateway."

---

## Sprint 3: Core Game Loop & Persistence
**Context File to provide:** `pokernow_dev_spec_v0_3.md` (Sections 9 & 12).

**Prompt:**
> "I am building a poker platform called 'Overbet'. Please execute 'Sprint 3: Core Game loop & Persistence' according to the `pokernow_dev_spec_v0_3.md`. Your scope is strictly confined to the `packages/engine` and `packages/db` folders. Your tasks are:
> 1. Expand the Prisma schema (if necessary) to fully support the Phase 20-50 requirements for storing `HandEvents` for event-sourcing and `Room` constraints.
> 2. Develop the No-Limit Hold'em (`packages/engine/src/variants/NLH.ts`) state machine logic far enough to process the `HAND_INIT` -> `POST_BLINDS_ANTES` -> `DEAL_PRIVATE` phases.
> 3. Implement the event-sourcing logic so that when the engine processes an action, it logs an immutable event type that can be saved via Prisma."

---

## Sprint 4: Complete Engine Gameplay Loop
**Context File to provide:** `pokernow_dev_spec_v0_3.md` (Section 9).

**Prompt:**
> "I am building a poker platform called 'Overbet'. Please execute 'Sprint 4: Complete Engine Gameplay Loop'. Your scope is strictly confined to the `packages/engine` logic. Your tasks are:
> 1. Expand the `packages/engine/src/variants/NLH.ts` state machine to fully handle all betting rounds (`PRE_FLOP_BETTING`, `FLOP_BETTING`, `TURN_BETTING`, `RIVER_BETTING`), enforcing minimum bet sizes and validating player actions (`FOLD`, `CHECK`, `CALL`, `RAISE`, `ALL_IN`).
> 2. Add logic to transition between streets by correctly dealing community cards out of the remaining PRNG deck array (`DEAL_FLOP`, `DEAL_TURN`, `DEAL_RIVER`).
> 3. Implement the `SHOWDOWN` and `CLEANUP` logic, utilizing a fast hand-evaluator algorithm (e.g. `pokersolver` or custom) to identify the best 5-card hands, correctly split the pot (handling complicated side-pots for all-ins), and award the winner(s)."

---

## Sprint 5: Accounting & Ledger Math
**Context File to provide:** `pokernow_dev_spec_v0_3.md` (Section 13).

**Prompt:**
> "Please execute the 'Accounting & Ledger v1 (Phase 50)' tasks for the 'Overbet' platform according to section 13 of the `pokernow_dev_spec_v0_3.md`. Your scope is strictly backend logic (e.g. creating an analytics/ledger service or adding math methods in `packages/engine`). Your tasks are:
> 1. Build the math logic to parse an array of `HandEvent` or `Ledger` entries (buy-ins, cash-outs, and final stack value) into a net Player PnL array. 
> 2. Build the 'Settlement Matrix' algorithm that takes the final PnL array, splits them into creditors/debtors, and uses a greedy matching algorithm to output the minimum number of user-to-user transfers (who owes who)."
