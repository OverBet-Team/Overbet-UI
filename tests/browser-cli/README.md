# Vercel Agent Browser CLI Tests

Browser tests use [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) CLI for multi-session automation.

## Prerequisites

- **System Chrome or Chromium** must be installed. Agent tests use it via `AGENT_BROWSER_EXECUTABLE_PATH`. No `playwright install` required.
- `agent-browser-env.sh` auto-detects common install paths (macOS, Linux, Windows). Override with `AGENT_BROWSER_EXECUTABLE_PATH` if needed.

```bash
pnpm install
```

## Run Tier 1 (2-player smoke)

```bash
pnpm test:browser:agent
```

Tier 1 script:

1. Starts gateway (4100) and web (3100)
2. Host creates room, requests seat
3. Joiner joins, requests seat
4. Host approves pending seats via Seat Requests panel
5. Host starts game
6. Joiner waits for in-game view

## Run Tier 2 (3-player convergence)

```bash
pnpm test:browser:agent:3p
```

Tier 2 script:

1. Starts gateway (4100) and web (3100)
2. Host creates room, all 3 users request seats
3. Host approves all requests and validates post-approval checkpoint
4. Host starts game, all 3 reach in-game + player-perspective
5. Executes at least one explicit player action
6. Verifies timeout/default-action progression and board reveal
7. Verifies cross-client convergence (phase/board/active player)
8. Verifies winner/showdown (`winner-toast`, `winner-hand-name`) convergence
9. Verifies next-hand reset convergence (phase/board/error/winner reset)

## Run Tier 3 (soak)

```bash
pnpm test:browser:agent:soak
```

Runs repeated Tier-2 cycles (default `SOAK_HANDS=3`) to catch long-run drift:

```bash
SOAK_HANDS=5 pnpm test:browser:agent:soak
```

## Run 4-7 player tiers (real UI, localhost)

Smoke (1 completed hand, single room run):

```bash
pnpm test:browser:agent:4p
pnpm test:browser:agent:5p
pnpm test:browser:agent:6p
pnpm test:browser:agent:7p
```

Soak (continuous completed hands in one room/session run):

```bash
SOAK_HANDS=30 pnpm test:browser:agent:4p:soak
SOAK_HANDS=30 pnpm test:browser:agent:5p:soak
SOAK_HANDS=30 pnpm test:browser:agent:6p:soak
SOAK_HANDS=30 pnpm test:browser:agent:7p:soak
```

7-session preflight capacity/stability check:

```bash
pnpm test:browser:agent:7p:preflight
```

## Run timer hardening matrix (2-6 players)

```bash
pnpm test:browser:agent:timer:matrix
```

This executes named timeout/default-action regressions across 2p-6p, including:

- preflop timeout progression
- postflop timeout progression
- timer-boundary race path
- repeated same-player timeout path
- cross-client convergence in timeout-heavy runs
- 2p named timeout/rebuy regressions

N-player runner uses safe gameplay policy:

- Prefer `CHECK/CALL`
- Use `FOLD` only as fallback
- Trigger occasional `RAISE` paths
- Preserve real timeout/default-action paths

## Test-mode timers

All browser-cli scripts default to short local test mode:

- `TEST_TIMER_MODE=short`
- `TURN_TIMEOUT_MS=5000`
- `TIMEBANK_MS=5000`
- `AUTO_START_DELAY_SECONDS=1`

Override when needed:

```bash
TEST_TIMER_MODE=short TURN_TIMEOUT_MS=7000 TIMEBANK_MS=7000 AUTO_START_DELAY_SECONDS=2 pnpm test:browser:agent:3p
```

## Sessions

- Tier 1: `host`, `joiner`
- Tier 2: `host`, `joiner1`, `joiner2`
- N-player: `host`, `joiner1..joiner6` (up to 7 players total)

## Failure Artifacts

On failure, per-run artifacts are saved under:

- `tests/browser-cli/artifacts/<run-id>/`

Plus a structured bug log:

- `tests/browser-cli/bug-log.jsonl`
