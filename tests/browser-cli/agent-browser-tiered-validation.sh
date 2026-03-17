#!/usr/bin/env bash
# Tiered validation: run 2p -> 3p -> 4p -> 5p -> 6p in strict order.
# Stop on first failure. Do not promote if lower tier fails.
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
cd "$ROOT"

run_tier() {
  local name="$1"
  shift
  echo ""
  echo "========== TIER: $name =========="
  "$@" || {
    echo "[FAIL] $name failed. Stopping tiered validation."
    exit 1
  }
  echo "[PASS] $name"
}

# Tier 1: 2p primary gate (all-in, rebuy, timeout next hand)
run_tier "2p-allin-rebuy-timeout-next-hand" pnpm test:browser:agent:2p:regression

# Tier 2: 2p smoke (approval, start, basic phase)
run_tier "2p-smoke" pnpm test:browser:agent

# Tier 3: 3p timer regressions
run_tier "3p-timer" pnpm test:browser:agent:3p:timer

# Tier 4: 3p smoke (convergence, winner, next-hand)
run_tier "3p-smoke" pnpm test:browser:agent:3p

# Tier 5: 4p smoke
run_tier "4p-smoke" pnpm test:browser:agent:4p

# Tier 6: 4p timer
run_tier "4p-timer" pnpm test:browser:agent:4p:timer

# Tier 7: 5p smoke
run_tier "5p-smoke" pnpm test:browser:agent:5p

# Tier 8: 5p timer
run_tier "5p-timer" pnpm test:browser:agent:5p:timer

# Tier 9: 6p smoke
run_tier "6p-smoke" pnpm test:browser:agent:6p

# Tier 10: 6p timer
run_tier "6p-timer" pnpm test:browser:agent:6p:timer

echo ""
echo "========== TIERED VALIDATION COMPLETE: 2p->6p all passed =========="
