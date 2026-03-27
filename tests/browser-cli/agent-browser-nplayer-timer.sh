#!/usr/bin/env bash
# N-player (4–6) timer regression: preflop/postflop timeout, boundary race, convergence, repeated timeout.
# Promotes validated 2p/3p timer assertions to higher player counts.
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
PLAYER_COUNT="${PLAYER_COUNT:-4}"
BASE_HANDS="${BASE_HANDS:-2}"
LONG_HANDS="${LONG_HANDS:-3}"

if [[ "$PLAYER_COUNT" -lt 4 || "$PLAYER_COUNT" -gt 6 ]]; then
  echo "PLAYER_COUNT must be 4, 5, or 6 for nplayer-timer"
  exit 1
fi

run_case() {
  local name="$1"
  shift
  echo "== Running $name =="
  env SCENARIO_NAME="$name" PLAYER_COUNT="$PLAYER_COUNT" "$@" bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
}

run_case "${PLAYER_COUNT}p-timeout-preflop-no-freeze" \
  TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE=preflop EXPECT_TIMEOUT_CONTINUE=1 REQUIRE_PREFLOP_TIMEOUT_TO_FLOP=1

run_case "${PLAYER_COUNT}p-timeout-postflop-no-freeze" \
  TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE=postflop EXPECT_TIMEOUT_CONTINUE=1

run_case "${PLAYER_COUNT}p-timeout-boundary-race" \
  TARGET_HANDS="$BASE_HANDS" TIMEOUT_MODE=boundary

run_case "${PLAYER_COUNT}p-timeout-cross-client-convergence" \
  TARGET_HANDS="$LONG_HANDS" TIMEOUT_MODE=default

run_case "${PLAYER_COUNT}p-repeated-timeout-same-player" \
  TARGET_HANDS="$LONG_HANDS" TIMEOUT_MODE=target TIMEOUT_TARGET_USER_ID="ab-joiner-1" TIMEOUT_REPEAT_COUNT=2

echo "N-player ($PLAYER_COUNT) timer regression passed."
