#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"
BUG_LOG="$ROOT/tests/browser-cli/bug-log.jsonl"
SOAK_HANDS="${SOAK_HANDS:-3}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="$ROOT/tests/browser-cli/artifacts/soak-$RUN_ID"
mkdir -p "$ARTIFACT_DIR"

TEST_TIMER_MODE="${TEST_TIMER_MODE:-short}"
TURN_TIMEOUT_MS="${TURN_TIMEOUT_MS:-5000}"
TIMEBANK_MS="${TIMEBANK_MS:-5000}"
AUTO_START_DELAY_SECONDS="${AUTO_START_DELAY_SECONDS:-2}"
GIT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"

run_tier2_once() {
  local idx="$1"
  local cycle_artifacts="$ARTIFACT_DIR/hand-$idx"
  mkdir -p "$cycle_artifacts"

  if pnpm --dir "$ROOT" test:browser:agent:3p >"$cycle_artifacts/output.log" 2>&1; then
    return 0
  fi

  # Attempt to harvest last room slug from output.
  local room_slug
  room_slug="$(awk '/room=/{print $0}' "$cycle_artifacts/output.log" | awk -F'room=' 'NF{print $2}' | awk '{print $1}' | tail -1)"
  room_slug="${room_slug:-unknown}"
  printf '{"ts":"%s","gitSha":"%s","scenario":"3p-soak","roomSlug":"%s","session":"host","step":"soak-cycle-%s","symptom":"tier2 script failed within soak cycle","classification":"gateway","timerMode":"%s","turnTimeoutMs":%s,"timeBankMs":%s,"autoStartDelaySeconds":%s,"artifactDir":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$GIT_SHA" "$room_slug" "$idx" "$TEST_TIMER_MODE" "$TURN_TIMEOUT_MS" "$TIMEBANK_MS" "$AUTO_START_DELAY_SECONDS" "$cycle_artifacts" >> "$BUG_LOG"
  return 1
}

passed=0
for i in $(seq 1 "$SOAK_HANDS"); do
  if run_tier2_once "$i"; then
    passed=$((passed + 1))
  else
    echo "Soak failed on cycle $i/$SOAK_HANDS. See $ARTIFACT_DIR/hand-$i/output.log"
    exit 1
  fi
done

echo "Agent-browser soak passed: $passed/$SOAK_HANDS Tier-2 cycles green."
