#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
TIERS="${TIERS:-2 3 4 5 6}"
BASE_HANDS="${BASE_HANDS:-2}"
LONG_HANDS="${LONG_HANDS:-3}"

run_case() {
  local name="$1"
  shift
  echo "== Running $name =="
  env SCENARIO_NAME="$name" "$@" bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
}

for pc in $TIERS; do
  run_case "${pc}p-timeout-preflop-no-freeze" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE="preflop" EXPECT_TIMEOUT_CONTINUE="1" REQUIRE_PREFLOP_TIMEOUT_TO_FLOP="1"

  run_case "${pc}p-timeout-postflop-no-freeze" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE="postflop" EXPECT_TIMEOUT_CONTINUE="1"

  run_case "${pc}p-timeout-boundary-race" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE="boundary"

  run_case "${pc}p-timeout-cross-client-convergence" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$LONG_HANDS" TIMEOUT_MODE="default"

  run_case "${pc}p-repeated-timeout-same-player" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$LONG_HANDS" TIMEOUT_MODE="target" TIMEOUT_TARGET_USER_ID="ab-joiner-1" TIMEOUT_REPEAT_COUNT="2"

  run_case "${pc}p-timeout-continue-branch" \
    PLAYER_COUNT="$pc" TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE="preflop" EXPECT_TIMEOUT_CONTINUE="1"
done

# Named high-signal 2p regressions
run_case "2p-allin-rebuy-timeout-next-hand" \
  PLAYER_COUNT="2" TARGET_HANDS="2" ACTION_STYLE="aggressive" TIMEOUT_MODE="target" TIMEOUT_TARGET_USER_ID="ab-joiner-1" TIMEOUT_REPEAT_COUNT="1"

run_case "2p-timeout-after-rebuy-then-timeout-again" \
  PLAYER_COUNT="2" TARGET_HANDS="3" TIMEOUT_MODE="target" TIMEOUT_TARGET_USER_ID="ab-joiner-1" TIMEOUT_REPEAT_COUNT="2"

# End-branch probe: timeout while folds are preferred should end hands rapidly.
run_case "2p-timeout-end-branch" \
  PLAYER_COUNT="2" TARGET_HANDS="2" TIMEOUT_MODE="preflop" ACTION_STYLE="force-fold" EXPECT_TIMEOUT_END="1"

echo "Timer matrix run complete for tiers: $TIERS"
