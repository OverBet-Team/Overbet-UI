# Browser-CLI Coverage Audit

## Current Assertions vs Required Timer/Rebuy/Reset Failure Classes

### 1. 2-Player Scripts

| Script | Player Count | Timer/Rebuy/Reset Coverage |
|--------|--------------|---------------------------|
| agent-browser-multiplayer-smoke.sh | 2 | **Gaps**: No timeout scenarios, no rebuy, no next-hand-after-timeout. **Present**: Approval checkpoint, Start Game enabled, in-game seated, phase/action-bar convergence, lobby-seated nuance. |
| agent-browser-nplayer-run.sh (PLAYER_COUNT=2) | 2 | **Present**: TIMEOUT_MODE (preflop/postflop/target/boundary), post-timeout invalid-click rejection, lifecycle-leak assertions, assert_room_health, rebuy handling. **Required**: Explicit 2p-allin-rebuy-timeout-next-hand gate. |

### 2. 3-Player Scripts

| Script | Player Count | Timer/Rebuy/Reset Coverage |
|--------|--------------|---------------------------|
| agent-browser-3player-smoke.sh | 3 | **Present**: Liveness/timeout progression (passive - waits for progression, does not induce timeout), convergence (phase/board/active), flop reveal, winner/showdown, next-hand reset. **Gaps**: No intentional timeout induction, no post-timeout stale-click check, no lifecycle-leak assertions. |
| agent-browser-nplayer-run.sh (PLAYER_COUNT=3) | 3 | Full timer matrix support when TIMEOUT_MODE set. Used by timer-matrix. |

### 3. N-Player (4–7) Scripts

| Script | Player Count | Timer/Rebuy/Reset Coverage |
|--------|--------------|---------------------------|
| agent-browser-nplayer-run.sh | 4–7 | Full: TIMEOUT_MODE, post-timeout check, lifecycle-leak, assert_room_health, rebuy, convergence, winner/reset. Used by timer-matrix and soak. |

### 4. Required Failure Classes (from Plan)

| Failure Class | 2p smoke | 2p nplayer | 3p smoke | 3p nplayer | 4–6p nplayer |
|--------------|----------|------------|----------|------------|--------------|
| Timer expiry → default action | ❌ | ✅ (when TIMEOUT_MODE set) | ❌ (passive) | ✅ | ✅ |
| Timeout → phase advances | ❌ | ✅ | ❌ | ✅ | ✅ |
| Rebuy + next-hand timeout | ❌ | ✅ (2p-allin-rebuy-timeout) | ❌ | ✅ | ✅ |
| Post-timeout invalid clicks rejected | ❌ | ✅ | ❌ | ✅ | ✅ |
| Lifecycle leak (Start Game in active room) | ❌ | ✅ | ❌ | ✅ | ✅ |
| Cross-client convergence after timeout | ❌ | ✅ | ✅ (no timeout) | ✅ | ✅ |
| Next-hand reset after timeout | ❌ | ✅ | ✅ | ✅ | ✅ |
| Active-player validity after timeout | ❌ | ✅ | ❌ | ✅ | ✅ |
| Preflop timeout → flop reveal | ❌ | ✅ (REQUIRE_PREFLOP_TIMEOUT_TO_FLOP) | ❌ | ✅ | ✅ |

### 5. Named Regression Coverage

| Regression | Implemented | Location |
|------------|-------------|----------|
| 2p-allin-rebuy-timeout-next-hand | ✅ | agent-browser-timer-matrix.sh |
| 2p-timeout-preflop-no-freeze | ✅ | agent-browser-timer-matrix.sh |
| 2p-timeout-postflop-no-freeze | ✅ | agent-browser-timer-matrix.sh |
| 2p-timeout-after-rebuy-then-timeout-again | ✅ | agent-browser-timer-matrix.sh |
| 3p-timeout-boundary-race | ✅ | agent-browser-timer-matrix.sh |
| 3p-timeout-cross-client-convergence | ✅ | agent-browser-timer-matrix.sh |
| 4p–6p repeated/timeout variants | ✅ | agent-browser-timer-matrix.sh |

### 6. Gaps Addressed (Post-Implementation)

1. **2p primary gate**: `agent-browser-2p-regression.sh` + `test:browser:agent:2p:regression`.
2. **3p timer**: `agent-browser-3player-timer.sh` + `test:browser:agent:3p:timer`.
3. **4–6p timer**: `agent-browser-nplayer-timer.sh` + `test:browser:agent:4p:timer` etc.
4. **Bug log schema**: 2p and 3p write_bug_log now include `startGameVisible`, `startGameEnabled`, `timeoutExpected`.
5. **Tiered validation**: `agent-browser-tiered-validation.sh` + `test:browser:agent:tiered` runs 2p→3p→4p→5p→6p in order.

### 7. Validation Run Finding (2026-03-17)

`2p-allin-rebuy-timeout-next-hand` failed at `lifecycle-leak`: Start Game control visible during PRE_FLOP_BETTING (startGameVisible=true, startGameEnabled=false). Classification: `gateway` (UI/state-sync). Action: hide floating/host Start Game controls during active betting phases.
