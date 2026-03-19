#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"

# Legacy 3-player smoke entrypoint, now routed through the shared N-player harness.
# Defaults preserve smoke semantics (normal action drive, no timeout-specific requirement).
SCENARIO_NAME="${SCENARIO_NAME:-3p-convergence-smoke}"
TARGET_HANDS="${TARGET_HANDS:-2}"
TIMEOUT_MODE="${TIMEOUT_MODE:-default}"
EXPECT_TIMEOUT_CONTINUE="${EXPECT_TIMEOUT_CONTINUE:-0}"
EXPECT_TIMEOUT_END="${EXPECT_TIMEOUT_END:-0}"

env \
  SCENARIO_NAME="$SCENARIO_NAME" \
  PLAYER_COUNT=3 \
  TARGET_HANDS="$TARGET_HANDS" \
  TIMEOUT_MODE="$TIMEOUT_MODE" \
  EXPECT_TIMEOUT_CONTINUE="$EXPECT_TIMEOUT_CONTINUE" \
  EXPECT_TIMEOUT_END="$EXPECT_TIMEOUT_END" \
  bash "$ROOT/tests/browser-cli/agent-browser-nplayer-run.sh"
