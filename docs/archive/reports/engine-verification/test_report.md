# Engine Verification Pass — Test Report

**Date:** 2025-03-12  
**Scope:** Simulation stress suite + full engine suite

---

## 1. Exact Commands Run

| # | Purpose | Command |
|---|---------|---------|
| 1 | Simulation suite (×10 for flakiness) | `cd /Users/ayan/Desktop/Manus\ Poker/packages/engine && for i in 1 2 3 4 5 6 7 8 9 10; do echo "=== Simulation Run $i ==="; pnpm test -- test/simulation.test.ts 2>&1; done` |
| 2 | Full engine suite (×3) | `cd /Users/ayan/Desktop/Manus\ Poker/packages/engine && for i in 1 2 3; do echo "=== Full Engine Suite Run $i ==="; pnpm test 2>&1; done` |
| 3 | Single run (simulation only) | `cd /Users/ayan/Desktop/Manus\ Poker/packages/engine && pnpm test -- test/simulation.test.ts` |
| 4 | Single run (full suite) | `cd /Users/ayan/Desktop/Manus\ Poker/packages/engine && pnpm test` |

---

## 2. Tests Executed

### Simulation stress suite (8 tests)
- 2-player game × 30 rounds
- 3-player game × 30 rounds
- 4-player game × 30 rounds
- 5-player game × 30 rounds
- 6-player game × 30 rounds
- 7-player game × 30 rounds
- 2-player extended stress × 50 rounds
- 4-player extended stress × 50 rounds

### Broader engine suite (17 tests total)
- `test/ledger.test.ts` — 1 test
- `test/randomness.test.ts` — 1 test
- `test/engine.test.ts` — 7 tests
- `test/simulation.test.ts` — 8 tests

---

## 3. Full Result Summary

### Simulation suite — 10 consecutive runs

| Run | Result | Duration |
|-----|--------|----------|
| 1 | 8/8 passed | 44ms |
| 2 | 8/8 passed | 94ms |
| 3 | 8/8 passed | 112ms |
| 4 | 8/8 passed | 41ms |
| 5 | 8/8 passed | 46ms |
| 6 | 8/8 passed | 41ms |
| 7 | 8/8 passed | 42ms |
| 8 | 8/8 passed | 42ms |
| 9 | 8/8 passed | 42ms |
| 10 | 8/8 passed | 42ms |

**Total:** 80/80 tests passed across 10 runs. No failures.

### Full engine suite — 3 consecutive runs

| Run | Result | Duration |
|-----|--------|----------|
| 1 | 17/17 passed (4 files) | 350ms |
| 2 | 17/17 passed (4 files) | 342ms |
| 3 | 17/17 passed (4 files) | 288ms |

**Total:** 51/51 tests passed across 3 runs. No failures.

### Observed behavior
- **Invariant violations:** 0
- **Exceptions:** 0
- **Stalls / max-action aborts:** 0
- **Warnings:** None
- **stderr:** Empty

---

## 4. Errors / Issues Found

**None.** No invariant violations, exceptions, stalls, or max-action aborts occurred in any run.

---

## 5. Fixes Made

**None.** No fixes were required. The verification pass did not uncover any new bugs. Previous engine fixes (EARLY_WIN, UNCALLED_BET_RETURNED, handleRoundEnd side pot handling) remain in place.

---

## 6. Final Post-Fix Test Results

N/A — no fixes were applied. Final status is the same as the initial runs:

- **Simulation suite:** 10/10 runs passed (8 tests each)
- **Full engine suite:** 3/3 runs passed (17 tests each)

---

## 7. Remaining Edge Cases / Flaky Behavior

- **Flakiness:** None observed. Simulation uses deterministic seeds (`BASE_SEED + playerCount * 1000`), so runs are fully reproducible.
- **Known uncovered edge cases** (from SIMULATION_SUMMARY.md):
  - `loadEvents` replay fidelity not yet tested
  - Extreme player counts (8–10) not exercised
  - Very large stacks / table stakes edge cases not covered
