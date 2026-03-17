#!/usr/bin/env bash
# 2p-allin-rebuy-timeout-next-hand: Primary timer logic gate.
# Hand 1: aggressive play (all-in) to end quickly; joiner may bust and rebuy.
# Hand 2: joiner intentionally times out; default action must resolve, phase must advance,
# Start Game must NOT reappear, post-timeout stale clicks must be rejected.
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
cd "$ROOT"

SCENARIO_NAME="2p-allin-rebuy-timeout-next-hand"
PLAYER_COUNT=2
TARGET_HANDS=2
ACTION_STYLE=aggressive
TIMEOUT_MODE=target
TIMEOUT_TARGET_USER_ID="ab-joiner-1"
TIMEOUT_REPEAT_COUNT=1
POST_TIMEOUT_INVALID_CLICK_CHECK=1

export SCENARIO_NAME PLAYER_COUNT TARGET_HANDS ACTION_STYLE
export TIMEOUT_MODE TIMEOUT_TARGET_USER_ID TIMEOUT_REPEAT_COUNT POST_TIMEOUT_INVALID_CLICK_CHECK

exec bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
