#!/usr/bin/env bash
# 3p timer regression suite: preflop/postflop timeout, boundary race, cross-client convergence.
# Runs all 3p timer-critical scenarios with convergence checks.
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"

run_case() {
  local name="$1"
  shift
  echo "== Running 3p: $name =="
  env SCENARIO_NAME="$name" PLAYER_COUNT=3 "$@" bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
}

run_case "3p-timeout-preflop-no-freeze" \
  TARGET_HANDS=2 TIMEOUT_MODE=preflop EXPECT_TIMEOUT_CONTINUE=1 REQUIRE_PREFLOP_TIMEOUT_TO_FLOP=1

run_case "3p-timeout-postflop-no-freeze" \
  TARGET_HANDS=2 TIMEOUT_MODE=postflop EXPECT_TIMEOUT_CONTINUE=1

run_case "3p-timeout-boundary-race" \
  TARGET_HANDS=2 TIMEOUT_MODE=boundary

run_case "3p-timeout-cross-client-convergence" \
  TARGET_HANDS=3 TIMEOUT_MODE=default

echo "3p timer regression suite passed."
