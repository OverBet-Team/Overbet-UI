#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
PLAYER_COUNT="${PLAYER_COUNT:-7}"
SOAK_HANDS="${SOAK_HANDS:-30}"
SCENARIO_NAME="${SCENARIO_NAME:-${PLAYER_COUNT}p-soak}"

if [[ "$PLAYER_COUNT" -lt 2 || "$PLAYER_COUNT" -gt 7 ]]; then
  echo "PLAYER_COUNT must be between 2 and 7"
  exit 1
fi

PLAYER_COUNT="$PLAYER_COUNT" TARGET_HANDS="$SOAK_HANDS" SCENARIO_NAME="$SCENARIO_NAME" \
  bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
