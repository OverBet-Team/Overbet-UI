#!/usr/bin/env bash
set -uo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"

GATEWAY_LOG="$ROOT/tests/browser-cli/.gateway.log"
WEB_LOG="$ROOT/tests/browser-cli/.web.log"
WEB_PORT=3100
GATEWAY_PORT=4100

PLAYER_COUNT="${PLAYER_COUNT:-3}"
TARGET_HANDS="${TARGET_HANDS:-1}"
PREFLIGHT_ONLY="${PREFLIGHT_ONLY:-0}"
SCENARIO_NAME="${SCENARIO_NAME:-${PLAYER_COUNT}p-browser}"

TEST_TIMER_MODE="${TEST_TIMER_MODE:-short}"
TURN_TIMEOUT_MS="${TURN_TIMEOUT_MS:-5000}"
TIMEBANK_MS="${TIMEBANK_MS:-5000}"
AUTO_START_DELAY_SECONDS="${AUTO_START_DELAY_SECONDS:-1}"
ACTION_STYLE="${ACTION_STYLE:-safe}"
TIMEOUT_MODE="${TIMEOUT_MODE:-default}"
TIMEOUT_TARGET_USER_ID="${TIMEOUT_TARGET_USER_ID:-}"
TIMEOUT_REPEAT_COUNT="${TIMEOUT_REPEAT_COUNT:-1}"
EXPECT_TIMEOUT_CONTINUE="${EXPECT_TIMEOUT_CONTINUE:-0}"
EXPECT_TIMEOUT_END="${EXPECT_TIMEOUT_END:-0}"
REQUIRE_PREFLOP_TIMEOUT_TO_FLOP="${REQUIRE_PREFLOP_TIMEOUT_TO_FLOP:-0}"
POST_TIMEOUT_INVALID_CLICK_CHECK="${POST_TIMEOUT_INVALID_CLICK_CHECK:-1}"
BUY_IN_AMOUNT="${BUY_IN_AMOUNT:-1000}"

LIVENESS_POLLS="${LIVENESS_POLLS:-40}"
LIVENESS_WAIT_MS="${LIVENESS_WAIT_MS:-500}"
MAX_IDENTICAL_SIGNATURES="${MAX_IDENTICAL_SIGNATURES:-12}"
MAX_IDENTICAL_ERRORS="${MAX_IDENTICAL_ERRORS:-4}"
CONVERGENCE_POLLS="${CONVERGENCE_POLLS:-20}"
WINNER_POLLS="${WINNER_POLLS:-80}"
RESET_POLLS="${RESET_POLLS:-80}"
if [[ "$PLAYER_COUNT" -ge 7 ]]; then
  WINNER_POLLS="${WINNER_POLLS_7P:-120}"
  RESET_POLLS="${RESET_POLLS_7P:-120}"
fi

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="$ROOT/tests/browser-cli/artifacts/$RUN_ID"
BUG_LOG="$ROOT/tests/browser-cli/bug-log.jsonl"
GIT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
mkdir -p "$ROOT/tests/browser-cli" "$ARTIFACT_DIR"

if [[ "$PLAYER_COUNT" -lt 2 || "$PLAYER_COUNT" -gt 7 ]]; then
  echo "PLAYER_COUNT must be between 2 and 7"
  exit 1
fi

ROOM_SLUG=""
COMPLETED_HANDS=0
TIMEOUT_EXPECTED="false"
TIMEOUT_HITS=0
TIMEOUT_TARGET_HITS=0
PREFLOP_TIMEOUT_SEEN="false"
CURRENT_PHASE=""
CURRENT_BOARD="0"

declare -a SESSIONS
declare -a USER_IDS
declare -a DISPLAY_NAMES
SESSIONS=("host")
USER_IDS=("ab-host")
DISPLAY_NAMES=("AgentHost")
for i in $(seq 1 $((PLAYER_COUNT - 1))); do
  SESSIONS+=("joiner$i")
  USER_IDS+=("ab-joiner-$i")
  DISPLAY_NAMES+=("AgentJoiner$i")
done

host_session() { echo "${SESSIONS[0]}"; }
host_user_id() { echo "${USER_IDS[0]}"; }

session_for_user_id() {
  local target="$1"
  local i
  for i in "${!USER_IDS[@]}"; do
    if [[ "${USER_IDS[$i]}" == "$target" ]]; then
      echo "${SESSIONS[$i]}"
      return 0
    fi
  done
  return 1
}

session_url() {
  local session="$1"
  pnpm exec agent-browser --session "$session" get url 2>/dev/null | awk 'NF{last=$0} END{print last}'
}

start_game_state() {
  local session="$1"
  pnpm exec agent-browser --session "$session" eval "(() => {
    const read = (id) => {
      const el = document.querySelector('[data-testid=\"' + id + '\"]');
      if (!el) return { visible: false, enabled: false };
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && el.getClientRects().length > 0;
      return { visible, enabled: visible && !el.disabled };
    };
    const a = read('host-start-game-button');
    const b = read('host-start-resume-button');
    const c = read('floating-start-game-button');
    return JSON.stringify({
      startVisible: a.visible || b.visible || c.visible,
      startEnabled: a.enabled || b.enabled || c.enabled,
      lobbyView: !!document.querySelector('[data-testid=\"lobby-view\"]'),
      inGameView: !!document.querySelector('[data-testid=\"in-game-view\"]')
    });
  })()" | awk 'NF{last=$0} END{print last}'
}

sleep_ms() {
  local ms="$1"
  python3 - "$ms" <<'PY'
import sys, time
ms = int(sys.argv[1]) if sys.argv[1].isdigit() else 0
time.sleep(max(ms, 0) / 1000.0)
PY
}

read_ui_signature() {
  local session="$1"
  pnpm exec agent-browser --session "$session" eval "(() => {
    const phase = (document.querySelector('[data-testid=\"phase-label\"]')?.textContent || 'NONE').trim();
    const active = (document.querySelector('[data-testid=\"active-player-id\"]')?.textContent || '').trim();
    const board = Array.from(document.querySelectorAll('[data-testid^=\"board-card-\"]')).filter((n) => n.getAttribute('data-revealed') === 'true').length;
    const actionBar = !!document.querySelector('[data-testid=\"action-bar\"]');
    const inactive = !!document.querySelector('[data-testid=\"action-bar-inactive\"]');
    const error = (document.querySelector('[data-testid=\"ui-error-banner\"]')?.textContent || '').trim();
    const winner = !!document.querySelector('[data-testid=\"winner-toast\"]');
    const seated = !!document.querySelector('[data-testid=\"player-perspective\"]');
    return JSON.stringify({
      phaseLabel: phase,
      activePlayerId: active,
      revealedBoardCount: board,
      actionBarEnabled: actionBar && !inactive,
      errorBannerText: error,
      winnerVisible: winner,
      seated
    });
  })()" | awk 'NF{last=$0} END{print last}'
}

sig_field() {
  local sig="$1"
  local key="$2"
  python3 - "$sig" "$key" <<'PY'
import json, sys
sig = sys.argv[1]
key = sys.argv[2]
try:
    obj = json.loads(sig)
    if isinstance(obj, str):
        obj = json.loads(obj)
    if not isinstance(obj, dict):
        print("")
        raise SystemExit(0)
    value = obj.get(key, "")
    if isinstance(value, bool):
        print("true" if value else "false")
    else:
        print(value)
except Exception:
    print("")
PY
}

write_bug_log() {
  local step="$1"
  local symptom="$2"
  local classification="$3"
  local session="$4"
  local signature="$5"
  local phase active board error start_state start_visible start_enabled
  phase="$(sig_field "$signature" "phaseLabel")"
  active="$(sig_field "$signature" "activePlayerId")"
  board="$(sig_field "$signature" "revealedBoardCount")"
  error="$(sig_field "$signature" "errorBannerText")"
  start_state="$(start_game_state "$(host_session)" || true)"
  start_visible="$(sig_field "$start_state" "startVisible")"
  start_enabled="$(sig_field "$start_state" "startEnabled")"
  printf '{"ts":"%s","gitSha":"%s","scenario":"%s","playerCount":%s,"targetHands":%s,"completedHands":%s,"roomSlug":"%s","session":"%s","step":"%s","symptom":"%s","classification":"%s","timerMode":"%s","turnTimeoutMs":%s,"timeBankMs":%s,"autoStartDelaySeconds":%s,"timeoutExpected":"%s","startGameVisible":"%s","startGameEnabled":"%s","url":"%s","phase":"%s","activePlayer":"%s","revealedBoardCount":"%s","visibleErrorText":"%s","signature":%s,"artifactDir":"%s","gatewayLog":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$GIT_SHA" "$SCENARIO_NAME" "$PLAYER_COUNT" "$TARGET_HANDS" "$COMPLETED_HANDS" "$ROOM_SLUG" \
    "$session" "$step" "$symptom" "$classification" \
    "$TEST_TIMER_MODE" "$TURN_TIMEOUT_MS" "$TIMEBANK_MS" "$AUTO_START_DELAY_SECONDS" "$TIMEOUT_EXPECTED" "$start_visible" "$start_enabled" \
    "$(session_url "$session")" "$phase" "$active" "$board" "$error" "${signature:-\"\"}" "$ARTIFACT_DIR" "$GATEWAY_LOG" >> "$BUG_LOG"
}

cleanup() {
  local code=${1:-0}
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${GATEWAY_PID:-}" ]]; then kill "$GATEWAY_PID" >/dev/null 2>&1 || true; fi
  if [[ "$code" -ne 0 ]]; then
    local s
    for s in "${SESSIONS[@]}"; do
      pnpm exec agent-browser --session "$s" screenshot "$ARTIFACT_DIR/failure-$s.png" 2>/dev/null || true
      pnpm exec agent-browser --session "$s" snapshot > "$ARTIFACT_DIR/snapshot-$s.txt" 2>/dev/null || true
    done
    cp "$GATEWAY_LOG" "$ARTIFACT_DIR/gateway.log" 2>/dev/null || true
    cp "$WEB_LOG" "$ARTIFACT_DIR/web.log" 2>/dev/null || true
  fi
  local s
  for s in "${SESSIONS[@]}"; do
    pnpm exec agent-browser --session "$s" close >/dev/null 2>&1 || true
  done
}
trap 'ec=$?; cleanup $ec; exit $ec' EXIT

ensure_local_stack() {
  cd "$ROOT"
  rm -f "$GATEWAY_LOG" "$WEB_LOG"
  local port pid
  for port in "$GATEWAY_PORT" "$WEB_PORT"; do
    pid="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      sleep 2
    fi
  done
  TEST_TIMER_MODE="$TEST_TIMER_MODE" TURN_TIMEOUT_MS="$TURN_TIMEOUT_MS" TIMEBANK_MS="$TIMEBANK_MS" AUTO_START_DELAY_SECONDS="$AUTO_START_DELAY_SECONDS" PORT="$GATEWAY_PORT" pnpm --filter @overbet/gateway dev >"$GATEWAY_LOG" 2>&1 &
  GATEWAY_PID=$!
  sleep 2
  NEXT_PUBLIC_GATEWAY_URL="http://127.0.0.1:$GATEWAY_PORT" pnpm --filter web dev -p "$WEB_PORT" >"$WEB_LOG" 2>&1 &
  WEB_PID=$!
  for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:$GATEWAY_PORT/healthz" >/dev/null 2>&1 && curl -sf "http://127.0.0.1:$WEB_PORT" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Local stack failed health check"
  return 1
}

preflight_capacity() {
  local i session uid sig
  for i in "${!SESSIONS[@]}"; do
    session="${SESSIONS[$i]}"
    uid="${USER_IDS[$i]}"
    pnpm exec agent-browser --session "$session" open "http://127.0.0.1:$WEB_PORT"
    pnpm exec agent-browser --session "$session" eval "localStorage.setItem('overbet_user_id','$uid')"
    pnpm exec agent-browser --session "$session" reload
    sleep_ms 800
    sig="$(pnpm exec agent-browser --session "$session" eval "(() => document.title || '')()" | awk 'NF{last=$0} END{print last}')"
    if [[ -z "$sig" ]]; then
      write_bug_log "preflight-capacity" "session could not render page title" "harness" "$session" "{}"
      return 1
    fi
  done
  return 0
}

request_seat() {
  local session="$1"
  local display_name="$2"
  pnpm exec agent-browser --session "$session" find first "[data-testid^='seat-empty-']" click
  pnpm exec agent-browser --session "$session" find placeholder "Enter your name" fill "$display_name"
  pnpm exec agent-browser --session "$session" find first "input[inputmode='numeric']" fill "$BUY_IN_AMOUNT"
  pnpm exec agent-browser --session "$session" find role button click --name "Request Seat"
}

open_room_with_retry() {
  local session="$1"
  local url="$2"
  local uid="$3"
  local tries
  for tries in $(seq 1 3); do
    if pnpm exec agent-browser --session "$session" open "$url" 2>/dev/null; then
      pnpm exec agent-browser --session "$session" eval "localStorage.setItem('overbet_user_id','$uid')" 2>/dev/null || true
      pnpm exec agent-browser --session "$session" reload 2>/dev/null || true
      return 0
    fi
    sleep_ms 600
  done
  write_bug_log "join-room-open" "session failed to open room URL after retries" "harness" "$session" "{}"
  return 1
}

approve_all_pending() {
  local host="$1"
  sleep_ms 2000
  pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click
  pnpm exec agent-browser --session "$host" wait "[data-testid^='approve-seat-']"
  local loops max_loops approve_testid
  max_loops=$((PLAYER_COUNT * 4))
  for loops in $(seq 1 "$max_loops"); do
    approve_testid="$(pnpm exec agent-browser --session "$host" eval "(() => { const b = document.querySelector('[data-testid^=\"approve-seat-\"]'); return b ? b.getAttribute('data-testid') : '' })()" | tr -d '" \n' | tail -1)"
    if [[ -z "$approve_testid" ]]; then
      break
    fi
    if ! pnpm exec agent-browser --session "$host" find testid "$approve_testid" click 2>/dev/null; then
      pnpm exec agent-browser --session "$host" eval "(() => { const b = document.querySelector('[data-testid=\""$approve_testid"\"]'); if (b) b.click(); })()" >/dev/null || true
    fi
    sleep_ms 700
  done
  pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click
  sleep_ms 2500
}

ensure_approval_checkpoint() {
  local host="$1"
  local attempt pending_count seat_count lobby_count
  for attempt in $(seq 1 24); do
    pending_count="$(pnpm exec agent-browser --session "$host" eval "document.querySelectorAll('[data-testid^=\"approve-seat-\"]').length" 2>/dev/null | awk 'NF{last=$0} END{print last}')"
    seat_count="$(pnpm exec agent-browser --session "$host" eval "document.querySelectorAll('[data-testid^=\"seat-player-\"]').length" 2>/dev/null | awk 'NF{last=$0} END{print last}')"
    lobby_count="$(pnpm exec agent-browser --session "$host" eval "(() => (document.querySelector('[data-testid=\"lobby-player-count\"]')?.textContent || '').trim())()" 2>/dev/null | awk 'NF{last=$0} END{print last}')"

    local i sig seated phase all_seated
    all_seated=true
    for i in "${!SESSIONS[@]}"; do
      sig="$(read_ui_signature "${SESSIONS[$i]}")"
      seated="$(sig_field "$sig" "seated")"
      phase="$(sig_field "$sig" "phaseLabel")"
      if [[ "$phase" == "NONE" ]]; then
        all_seated=false
        break
      fi
      if [[ "$seated" != "true" ]]; then
        all_seated=false
        break
      fi
    done

    if [[ "${pending_count:-0}" == "0" ]] \
      && { [[ "$lobby_count" != *"Players ("* ]] || [[ "$lobby_count" == *"($PLAYER_COUNT)"* ]]; } \
      && [[ "$all_seated" == "true" ]]; then
      if [[ -n "${seat_count:-}" && "${seat_count:-0}" -gt 0 && "${seat_count:-0}" -lt "$PLAYER_COUNT" ]]; then
        sleep_ms 500
        continue
      fi
      return 0
    fi
    sleep_ms 500
  done

  write_bug_log "post-approval-checkpoint" "pending/player-count/seated validation failed after bounded retries" "harness" "$host" "$(read_ui_signature "$host" || true)"
  return 1
}

start_game() {
  local host="$1"
  local _ start_lobby_enabled start_panel_enabled floating_start_enabled
  for _ in $(seq 1 24); do
    start_lobby_enabled="$(pnpm exec agent-browser --session "$host" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-game-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
    if [[ "${start_lobby_enabled:-false}" == "true" ]]; then
      pnpm exec agent-browser --session "$host" find testid host-start-game-button click
      return 0
    fi
    floating_start_enabled="$(pnpm exec agent-browser --session "$host" eval "(() => { const b=document.querySelector('[data-testid=\"floating-start-game-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
    if [[ "${floating_start_enabled:-false}" == "true" ]]; then
      pnpm exec agent-browser --session "$host" find testid floating-start-game-button click
      return 0
    fi
    if pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click 2>/dev/null; then
      start_panel_enabled="$(pnpm exec agent-browser --session "$host" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-resume-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
      if [[ "${start_panel_enabled:-false}" == "true" ]]; then
        pnpm exec agent-browser --session "$host" find testid host-start-resume-button click
        return 0
      fi
      pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click 2>/dev/null || true
    fi
    sleep_ms 500
  done
  write_bug_log "start-hand" "neither host start control is enabled" "gateway" "$host" "$(read_ui_signature "$host" || true)"
  return 1
}

all_in_game_and_seated() {
  local s
  for s in "${SESSIONS[@]}"; do
    pnpm exec agent-browser --session "$s" wait "[data-testid='in-game-view']"
    pnpm exec agent-browser --session "$s" wait "[data-testid='player-perspective']"
  done
}

handle_rebuy_requests_if_needed() {
  local host needs_approval="false"
  host="$(host_session)"
  local s has_rebuy
  for s in "${SESSIONS[@]}"; do
    has_rebuy="$(pnpm exec agent-browser --session "$s" eval "(() => !!document.querySelector('[data-testid=\"rebuy-open-button\"]'))()" | awk 'NF{last=$0} END{print last}')"
    if [[ "$has_rebuy" == "true" ]]; then
      pnpm exec agent-browser --session "$s" find testid rebuy-open-button click 2>/dev/null || true
      sleep_ms 200
      if ! pnpm exec agent-browser --session "$s" find testid rebuy-submit-button click 2>/dev/null; then
        pnpm exec agent-browser --session "$s" eval "(() => { const b=document.querySelector('[data-testid=\"rebuy-submit-button\"]'); if (b && !b.disabled) b.click(); })()" >/dev/null 2>&1 || true
      fi
      needs_approval="true"
      sleep_ms 400
    fi
  done
  if [[ "$needs_approval" != "true" ]]; then
    return 0
  fi
  if ! pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click 2>/dev/null; then
    return 0
  fi
  sleep_ms 500
  local loops approve_testid
  for loops in $(seq 1 $((PLAYER_COUNT * 3))); do
    approve_testid="$(pnpm exec agent-browser --session "$host" eval "(() => { const b = document.querySelector('[data-testid^=\"approve-seat-\"]'); return b ? b.getAttribute('data-testid') : '' })()" | tr -d '" \n' | tail -1)"
    if [[ -z "$approve_testid" ]]; then
      break
    fi
    pnpm exec agent-browser --session "$host" find testid "$approve_testid" click 2>/dev/null || true
    sleep_ms 350
  done
  pnpm exec agent-browser --session "$host" find testid host-seat-requests-toggle click 2>/dev/null || true
  sleep_ms 700
}

assert_room_health() {
  local host="$1"
  local seat_count
  seat_count="$(pnpm exec agent-browser --session "$host" eval "document.querySelectorAll('[data-testid=\"player-perspective\"]').length" 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  local s url sig seated phase action_enabled
  for s in "${SESSIONS[@]}"; do
    url="$(session_url "$s")"
    if [[ "$url" != *"/room/$ROOM_SLUG"* ]]; then
      write_bug_log "room-health" "session lost room URL context" "harness" "$s" "$(read_ui_signature "$s" || true)"
      return 1
    fi
    sig="$(read_ui_signature "$s")"
    seated="$(sig_field "$sig" "seated")"
    phase="$(sig_field "$sig" "phaseLabel")"
    action_enabled="$(sig_field "$sig" "actionBarEnabled")"
    if [[ "$seated" != "true" ]]; then
      write_bug_log "room-health" "session no longer in seated perspective" "frontend" "$s" "$sig"
      return 1
    fi
    if [[ "$phase" == "LOBBY" || "$phase" == "CLEANUP" ]] && [[ "$action_enabled" == "true" ]]; then
      write_bug_log "room-health" "action bar enabled in invalid state" "frontend" "$s" "$sig"
      return 1
    fi
    local start_state start_visible start_enabled
    start_state="$(start_game_state "$s")"
    start_visible="$(sig_field "$start_state" "startVisible")"
    start_enabled="$(sig_field "$start_state" "startEnabled")"
    if [[ "$phase" != "LOBBY" ]] && [[ "$start_visible" == "true" || "$start_enabled" == "true" ]]; then
      write_bug_log "lifecycle-leak" "Start Game control visible/enabled in active room lifecycle" "gateway" "$s" "$sig"
      return 1
    fi
  done
  if [[ -n "$seat_count" ]] && [[ "$seat_count" != "$PLAYER_COUNT" ]]; then
    # Best-effort guard; if selector semantics change this may be empty/non-numeric.
    :
  fi
  return 0
}

attempt_action_for_active_player() {
  local active_user="$1"
  local action_index="$2"
  local target_session
  if ! target_session="$(session_for_user_id "$active_user")"; then
    return 1
  fi

  # Timeout matrix controls.
  if [[ "$TIMEOUT_MODE" != "none" ]]; then
    local should_timeout="false"
    case "$TIMEOUT_MODE" in
      preflop)
        if [[ "$CURRENT_PHASE" == "PRE_FLOP_BETTING" ]]; then
          should_timeout="true"
        fi
        ;;
      postflop)
        if [[ "$CURRENT_PHASE" != "PRE_FLOP_BETTING" && "${CURRENT_BOARD:-0}" -ge 3 ]]; then
          should_timeout="true"
        fi
        ;;
      target)
        if [[ -n "$TIMEOUT_TARGET_USER_ID" && "$active_user" == "$TIMEOUT_TARGET_USER_ID" && "$TIMEOUT_TARGET_HITS" -lt "$TIMEOUT_REPEAT_COUNT" ]]; then
          should_timeout="true"
          TIMEOUT_TARGET_HITS=$((TIMEOUT_TARGET_HITS + 1))
        fi
        ;;
      boundary)
        if (( TIMEOUT_HITS < 1 )); then
          # Timer boundary race: act very close to expiry, then let timeout resolve.
          sleep_ms $((TURN_TIMEOUT_MS - 300))
          pnpm exec agent-browser --session "$target_session" find testid action-check-call click 2>/dev/null || true
          should_timeout="true"
        fi
        ;;
      default)
        if (( TARGET_HANDS > 1 )) && (( action_index % 25 == 0 )); then
          should_timeout="true"
        fi
        ;;
      *)
        ;;
    esac
    if [[ "$should_timeout" == "true" ]]; then
      TIMEOUT_EXPECTED="true"
      TIMEOUT_HITS=$((TIMEOUT_HITS + 1))
      if [[ "$CURRENT_PHASE" == "PRE_FLOP_BETTING" ]]; then
        PREFLOP_TIMEOUT_SEEN="true"
      fi
      return 2
    fi
  else
    if (( TARGET_HANDS > 1 )) && (( action_index % 25 == 0 )); then
      TIMEOUT_EXPECTED="true"
      TIMEOUT_HITS=$((TIMEOUT_HITS + 1))
      if [[ "$CURRENT_PHASE" == "PRE_FLOP_BETTING" ]]; then
        PREFLOP_TIMEOUT_SEEN="true"
      fi
      return 2
    fi
  fi

  # Aggressive mode prefers all-in to end hands quickly.
  if [[ "$ACTION_STYLE" == "aggressive" ]]; then
    if pnpm exec agent-browser --session "$target_session" find testid action-all-in click 2>/dev/null; then
      return 0
    fi
  fi

  # For single-hand smoke tiers, prefer faster hand resolution.
  if (( TARGET_HANDS == 1 )); then
    if pnpm exec agent-browser --session "$target_session" find testid action-all-in click 2>/dev/null; then
      return 0
    fi
  fi

  # Safe action policy: check/call first, fold fallback, occasional raise.
  if (( TARGET_HANDS == 1 )) && (( action_index % 9 == 0 )); then
    if pnpm exec agent-browser --session "$target_session" find testid action-raise click 2>/dev/null; then
      if [[ "$(pnpm exec agent-browser --session "$target_session" eval "(() => { const m = document.querySelector('[data-testid=\"raise-modal\"]'); if (!m) return false; const buttons = Array.from(m.querySelectorAll('button')); const confirm = buttons.find((b) => (b.textContent || '').includes('Raise to')); if (!confirm) return false; confirm.click(); return true; })()" | awk 'NF{last=$0} END{print last}')" == *"true"* ]]; then
        return 0
      fi
    fi
  fi

  if [[ "$ACTION_STYLE" == "force-fold" ]]; then
    if pnpm exec agent-browser --session "$target_session" find testid action-fold click 2>/dev/null; then
      return 0
    fi
    if pnpm exec agent-browser --session "$target_session" find testid action-check-call click 2>/dev/null; then
      return 0
    fi
  else
    if pnpm exec agent-browser --session "$target_session" find testid action-check-call click 2>/dev/null; then
      return 0
    fi
    if (( TARGET_HANDS == 1 )); then
      if pnpm exec agent-browser --session "$target_session" find testid action-all-in click 2>/dev/null; then
        return 0
      fi
    fi
    if pnpm exec agent-browser --session "$target_session" find testid action-fold click 2>/dev/null; then
      return 0
    fi
  fi
  if [[ "$(pnpm exec agent-browser --session "$target_session" eval "(() => {
    const check = document.querySelector('[data-testid=\"action-check-call\"]');
    if (check) { check.click(); return 'check'; }
    if (${TARGET_HANDS} === 1) {
      const allIn = document.querySelector('[data-testid=\"action-all-in\"]');
      if (allIn) { allIn.click(); return 'allin'; }
    }
    const fold = document.querySelector('[data-testid=\"action-fold\"]');
    if (fold) { fold.click(); return 'fold'; }
    return '';
  })()" | awk 'NF{last=$0} END{print last}')" != "" ]]; then
    return 0
  fi
  return 1
}

attempt_any_visible_action() {
  local action_index="$1"
  local s
  for s in "${SESSIONS[@]}"; do
    local can_act
    can_act="$(pnpm exec agent-browser --session "$s" eval "(() => !!document.querySelector('[data-testid=\"action-bar\"]') && !document.querySelector('[data-testid=\"action-bar-inactive\"]'))()" | awk 'NF{last=$0} END{print last}')"
    if [[ "$can_act" != *"true"* ]]; then
      continue
    fi
    if (( TARGET_HANDS == 1 )); then
      if pnpm exec agent-browser --session "$s" find testid action-all-in click 2>/dev/null; then
        return 0
      fi
    fi
    if [[ "$ACTION_STYLE" == "aggressive" ]]; then
      if pnpm exec agent-browser --session "$s" find testid action-all-in click 2>/dev/null; then
        return 0
      fi
    fi
    if [[ "$ACTION_STYLE" == "force-fold" ]]; then
      if pnpm exec agent-browser --session "$s" find testid action-fold click 2>/dev/null; then
        return 0
      fi
      if pnpm exec agent-browser --session "$s" find testid action-check-call click 2>/dev/null; then
        return 0
      fi
    else
      if pnpm exec agent-browser --session "$s" find testid action-check-call click 2>/dev/null; then
        return 0
      fi
      if (( TARGET_HANDS == 1 )); then
        if pnpm exec agent-browser --session "$s" find testid action-all-in click 2>/dev/null; then
          return 0
        fi
      fi
      if pnpm exec agent-browser --session "$s" find testid action-fold click 2>/dev/null; then
        return 0
      fi
    fi
  done
  return 1
}

assert_post_timeout_stale_clicks_rejected() {
  local timed_out_user="$1"
  local timed_out_session
  if [[ "$POST_TIMEOUT_INVALID_CLICK_CHECK" != "1" ]]; then
    return 0
  fi
  if ! timed_out_session="$(session_for_user_id "$timed_out_user")"; then
    return 0
  fi
  local stale_sig action_enabled
  stale_sig="$(read_ui_signature "$timed_out_session")"
  action_enabled="$(sig_field "$stale_sig" "actionBarEnabled")"
  if [[ "$action_enabled" == "true" ]]; then
    write_bug_log "post-timeout-stale-actionbar" "timed-out player still has active action bar" "frontend" "$timed_out_session" "$stale_sig"
    return 1
  fi

  local before_sig before_active before_phase before_board
  before_sig="$(read_ui_signature "$(host_session)")"
  before_active="$(sig_field "$before_sig" "activePlayerId")"
  before_phase="$(sig_field "$before_sig" "phaseLabel")"
  before_board="$(sig_field "$before_sig" "revealedBoardCount")"

  pnpm exec agent-browser --session "$timed_out_session" find testid action-fold click 2>/dev/null || true
  pnpm exec agent-browser --session "$timed_out_session" find testid action-check-call click 2>/dev/null || true
  if pnpm exec agent-browser --session "$timed_out_session" find testid action-raise click 2>/dev/null; then
    pnpm exec agent-browser --session "$timed_out_session" eval "(() => { const m=document.querySelector('[data-testid=\"raise-modal\"]'); if (!m) return; const close=Array.from(m.querySelectorAll('button')).find(b => (b.textContent||'').toLowerCase().includes('cancel')); if (close) close.click(); })()" >/dev/null 2>&1 || true
  fi

  sleep_ms 350
  local after_sig after_active after_phase after_board
  after_sig="$(read_ui_signature "$(host_session)")"
  after_active="$(sig_field "$after_sig" "activePlayerId")"
  after_phase="$(sig_field "$after_sig" "phaseLabel")"
  after_board="$(sig_field "$after_sig" "revealedBoardCount")"

  if [[ "$after_active" == "$timed_out_user" && "$after_phase" == "$before_phase" && "$after_board" == "$before_board" ]]; then
    write_bug_log "post-timeout-invalid-click" "timed-out player stale clicks appear accepted or looping turn ownership" "gateway" "$timed_out_session" "$after_sig"
    return 1
  fi
  return 0
}

run_continuous_hands() {
  if (( TARGET_HANDS == 1 )); then
    run_single_hand_smoke
    return $?
  fi

  local watch_session="${SESSIONS[$((PLAYER_COUNT - 1))]}"
  local last_sig last_error same_sig_count same_error_count
  local board_progressed=false
  local timeout_progress_observed=false
  local action_observed=false
  local winner_seen=false
  local action_index=0
  local hand_poll prev_phase prev_active after_sig after_phase after_active
  local divergence_streak=0

  for _hand in $(seq 1 "$TARGET_HANDS"); do
    local hand_started_at_ms
    hand_started_at_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
    last_sig="$(read_ui_signature "$watch_session")"
    last_error="$(sig_field "$last_sig" "errorBannerText")"
    same_sig_count=0
    same_error_count=0
    local -a winner_seen_flags
    for _i in "${!SESSIONS[@]}"; do
      winner_seen_flags+=("0")
    done

    # Winner window for current hand.
    local winner_all=false
    for hand_poll in $(seq 1 "$WINNER_POLLS"); do
      local now_ms hand_elapsed hand_timeout_ms
      now_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
      hand_elapsed=$((now_ms - hand_started_at_ms))
      hand_timeout_ms=$(( TARGET_HANDS == 1 ? 240000 : 900000 ))
      if (( hand_elapsed > hand_timeout_ms )); then
        write_bug_log "hand-timeout" "single hand exceeded timeout budget" "harness" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
        return 1
      fi
      assert_room_health "$(host_session)" || return 1

      local sig_watch curr_error curr_board curr_phase curr_active host_sig_loop
      sig_watch="$(read_ui_signature "$watch_session")"
      host_sig_loop="$(read_ui_signature "$(host_session)")"
      curr_error="$(sig_field "$sig_watch" "errorBannerText")"
      curr_board="$(sig_field "$sig_watch" "revealedBoardCount")"
      curr_phase="$(sig_field "$host_sig_loop" "phaseLabel")"
      curr_active="$(sig_field "$host_sig_loop" "activePlayerId")"
      CURRENT_PHASE="$curr_phase"
      CURRENT_BOARD="$curr_board"

      if [[ "${curr_board:-0}" -ge 3 ]]; then
        board_progressed=true
      fi
      if (( TARGET_HANDS == 1 )) && [[ "$curr_phase" == "CLEANUP" ]]; then
        local winner_name_hits=0 ws winner_name
        for ws in "${SESSIONS[@]}"; do
          winner_name="$(pnpm exec agent-browser --session "$ws" eval "(() => (document.querySelector('[data-testid=\"winner-hand-name\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
          if [[ -n "${winner_name:-}" ]]; then
            winner_name_hits=$((winner_name_hits + 1))
          fi
        done
        if (( winner_name_hits > 0 )); then
          winner_all=true
          winner_seen=true
          break
        fi
      fi
      if [[ "$curr_error" == *"Insufficient deck for DEAL_FLOP"* ]]; then
        write_bug_log "deck-error" "Insufficient deck for DEAL_FLOP observed" "engine" "$watch_session" "$sig_watch"
        return 1
      fi

      if [[ "$sig_watch" == "$last_sig" ]]; then
        same_sig_count=$((same_sig_count + 1))
      else
        same_sig_count=0
        last_sig="$sig_watch"
      fi
      if [[ -n "$curr_error" && "$curr_error" == "$last_error" ]]; then
        same_error_count=$((same_error_count + 1))
      else
        same_error_count=0
        last_error="$curr_error"
      fi
      if [[ "$same_sig_count" -gt "$MAX_IDENTICAL_SIGNATURES" ]] || [[ "$same_error_count" -gt "$MAX_IDENTICAL_ERRORS" ]]; then
        write_bug_log "liveness-loop" "repeated signature/error threshold exceeded" "frontend" "$watch_session" "$sig_watch"
        return 1
      fi

      # Action drive + timeout path preservation only during betting phases.
      if [[ "$curr_phase" == *"BETTING" ]]; then
        prev_phase="$curr_phase"
        prev_active="$curr_active"
        if attempt_action_for_active_player "$curr_active" "$action_index"; then
          action_observed=true
          sleep_ms 700
        else
          local rc=$?
          if [[ "$rc" -eq 2 ]]; then
            sleep_ms $((TURN_TIMEOUT_MS + TIMEBANK_MS + 1200))
            after_sig="$(read_ui_signature "$watch_session")"
            after_phase="$(sig_field "$after_sig" "phaseLabel")"
            after_active="$(sig_field "$after_sig" "activePlayerId")"
            if [[ "$after_phase" != "$prev_phase" || "$after_active" != "$prev_active" ]]; then
              timeout_progress_observed=true
            fi
            assert_post_timeout_stale_clicks_rejected "$prev_active" || return 1
          else
            if attempt_any_visible_action "$action_index"; then
              action_observed=true
              sleep_ms 700
            else
              sleep_ms "$LIVENESS_WAIT_MS"
            fi
          fi
        fi
        action_index=$((action_index + 1))
      else
        sleep_ms "$LIVENESS_WAIT_MS"
      fi

      # Convergence and winner checks (periodic for responsiveness).
      if (( hand_poll % 3 == 0 )); then
        local converged=true ref_sig ref_phase ref_board ref_active s sig phase board active
        ref_sig="$host_sig_loop"
        ref_phase="$(sig_field "$ref_sig" "phaseLabel")"
        ref_board="$(sig_field "$ref_sig" "revealedBoardCount")"
        ref_active="$(sig_field "$ref_sig" "activePlayerId")"
        for s in "${SESSIONS[@]:1}"; do
          sig="$(read_ui_signature "$s")"
          phase="$(sig_field "$sig" "phaseLabel")"
          board="$(sig_field "$sig" "revealedBoardCount")"
          active="$(sig_field "$sig" "activePlayerId")"
          if [[ "$phase" != "$ref_phase" || "$board" != "$ref_board" || "$active" != "$ref_active" ]]; then
            converged=false
            break
          fi
        done
        if [[ "$converged" == "true" ]]; then
          divergence_streak=0
        else
          divergence_streak=$((divergence_streak + 1))
          if [[ "$divergence_streak" -gt "$CONVERGENCE_POLLS" ]]; then
            write_bug_log "cross-client-convergence" "clients diverged on phase/board/active player" "gateway" "$(host_session)" "$ref_sig"
            return 1
          fi
        fi
      fi

      local idx ws sig_ws wv winner_name all_seen
      for idx in "${!SESSIONS[@]}"; do
        if [[ "${winner_seen_flags[$idx]}" == "1" ]]; then
          continue
        fi
        ws="${SESSIONS[$idx]}"
        sig_ws="$(read_ui_signature "$ws")"
        wv="$(sig_field "$sig_ws" "winnerVisible")"
        if [[ "$wv" == "true" ]]; then
          winner_name="$(pnpm exec agent-browser --session "$ws" eval "(() => (document.querySelector('[data-testid=\"winner-hand-name\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
          if [[ -n "${winner_name:-}" ]]; then
            winner_seen_flags[$idx]="1"
          fi
        fi
      done
      all_seen=true
      for idx in "${!SESSIONS[@]}"; do
        if [[ "${winner_seen_flags[$idx]}" != "1" ]]; then
          all_seen=false
          break
        fi
      done
      if [[ "$all_seen" == "true" ]]; then
        winner_all=true
        winner_seen=true
        break
      fi
    done

    if [[ "$winner_all" != "true" ]]; then
      write_bug_log "winner-showdown" "winner/showdown did not appear within window" "frontend" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
      return 1
    fi

    # For single-hand smoke runs, winner/showdown convergence is sufficient.
    if (( TARGET_HANDS == 1 )); then
      COMPLETED_HANDS=$((COMPLETED_HANDS + 1))
      continue
    fi

    # Reset window for current hand.
    local reset_ok=false
    for hand_poll in $(seq 1 "$RESET_POLLS"); do
      local host_reset_sig host_phase host_board host_winner host_err s sig winner err
      host_reset_sig="$(read_ui_signature "$(host_session)")"
      host_phase="$(sig_field "$host_reset_sig" "phaseLabel")"
      host_board="$(sig_field "$host_reset_sig" "revealedBoardCount")"
      host_winner="$(sig_field "$host_reset_sig" "winnerVisible")"
      host_err="$(sig_field "$host_reset_sig" "errorBannerText")"
      reset_ok=true
      if [[ "$host_phase" == "CLEANUP" || "$host_phase" == "SHOWDOWN" || "${host_board:-0}" != "0" || "$host_winner" != "false" || -n "$host_err" ]]; then
        reset_ok=false
      fi
      for s in "${SESSIONS[@]}"; do
        sig="$(read_ui_signature "$s")"
        winner="$(sig_field "$sig" "winnerVisible")"
        err="$(sig_field "$sig" "errorBannerText")"
        if [[ "$winner" != "false" || -n "$err" ]]; then
          reset_ok=false
          break
        fi
      done
      if [[ "$reset_ok" == "true" ]]; then
        break
      fi
      sleep_ms "$LIVENESS_WAIT_MS"
    done
    if [[ "$reset_ok" != "true" ]]; then
      write_bug_log "next-hand-reset" "next hand did not reset cleanly with convergence" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
      return 1
    fi
    handle_rebuy_requests_if_needed || return 1
    COMPLETED_HANDS=$((COMPLETED_HANDS + 1))
  done

  if [[ "$action_observed" != "true" ]]; then
    write_bug_log "action-policy" "no real UI action was observed during run" "harness" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if (( TARGET_HANDS > 1 )) && [[ "$timeout_progress_observed" != "true" ]]; then
    write_bug_log "timeout-path" "no timeout/default-action progression observed" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if (( TIMEOUT_HITS > 0 )) && [[ "$timeout_progress_observed" != "true" ]]; then
    write_bug_log "timeout-semantic" "timeout was induced but no progression observed" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if [[ "$board_progressed" != "true" ]]; then
    write_bug_log "board-progression" "board never revealed as expected" "engine" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if [[ "$REQUIRE_PREFLOP_TIMEOUT_TO_FLOP" == "1" && "$PREFLOP_TIMEOUT_SEEN" == "true" && "$board_progressed" != "true" ]]; then
    write_bug_log "preflop-timeout-flop" "preflop timeout occurred but flop did not reveal" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if [[ "$winner_seen" != "true" ]]; then
    write_bug_log "winner-showdown" "winner/showdown never observed" "frontend" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if [[ "$EXPECT_TIMEOUT_CONTINUE" == "1" && "$timeout_progress_observed" != "true" ]]; then
    write_bug_log "timeout-continue-check" "timeout expected to continue hand but progression was not observed" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  if [[ "$EXPECT_TIMEOUT_END" == "1" && "$winner_seen" != "true" ]]; then
    write_bug_log "timeout-end-check" "timeout expected to end hand but winner/showdown not observed" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  local final_start_state final_start_visible final_start_enabled
  final_start_state="$(start_game_state "$(host_session)")"
  final_start_visible="$(sig_field "$final_start_state" "startVisible")"
  final_start_enabled="$(sig_field "$final_start_state" "startEnabled")"
  if [[ "$final_start_visible" == "true" || "$final_start_enabled" == "true" ]]; then
    write_bug_log "lifecycle-leak-end" "Start Game control visible/enabled after active lifecycle timeout flow" "gateway" "$(host_session)" "$(read_ui_signature "$(host_session)" || true)"
    return 1
  fi
  return 0
}

run_single_hand_smoke() {
  local host
  host="$(host_session)"
  local winner_seen=false
  local action_observed=false
  local timeout_progress_observed=false
  local tick=0
  local convergence_mismatch_streak=0
  local started_at_ms
  started_at_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

  while true; do
    tick=$((tick + 1))
    local now_ms elapsed
    now_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
    elapsed=$((now_ms - started_at_ms))
    if (( elapsed > 240000 )); then
      write_bug_log "hand-timeout" "single hand exceeded timeout budget" "harness" "$host" "$(read_ui_signature "$host" || true)"
      return 1
    fi

    assert_room_health "$host" || return 1

    local host_sig phase active board error winner_visible
    host_sig="$(read_ui_signature "$host")"
    phase="$(sig_field "$host_sig" "phaseLabel")"
    active="$(sig_field "$host_sig" "activePlayerId")"
    board="$(sig_field "$host_sig" "revealedBoardCount")"
    error="$(sig_field "$host_sig" "errorBannerText")"
    winner_visible="$(sig_field "$host_sig" "winnerVisible")"
    CURRENT_PHASE="$phase"
    CURRENT_BOARD="$board"

    if [[ "$error" == *"Insufficient deck for DEAL_FLOP"* ]]; then
      write_bug_log "deck-error" "Insufficient deck for DEAL_FLOP observed" "engine" "$host" "$host_sig"
      return 1
    fi
    if [[ "$winner_visible" == "true" ]]; then
      winner_seen=true
    fi
    if [[ "$phase" == "CLEANUP" && "$winner_seen" == "true" ]]; then
      COMPLETED_HANDS=1
      local sg start_visible start_enabled
      sg="$(start_game_state "$host")"
      start_visible="$(sig_field "$sg" "startVisible")"
      start_enabled="$(sig_field "$sg" "startEnabled")"
      if [[ "$start_visible" == "true" || "$start_enabled" == "true" ]]; then
        write_bug_log "lifecycle-leak-end" "Start Game control visible/enabled after single-hand timeout flow" "gateway" "$host" "$host_sig"
        return 1
      fi
      if [[ "$REQUIRE_PREFLOP_TIMEOUT_TO_FLOP" == "1" && "$PREFLOP_TIMEOUT_SEEN" == "true" && "${board:-0}" -lt 3 ]]; then
        write_bug_log "preflop-timeout-flop" "preflop timeout occurred but flop did not reveal in smoke run" "gateway" "$host" "$host_sig"
        return 1
      fi
      if [[ "${board:-0}" -ge 3 ]]; then
        :
      fi
      return 0
    fi

    # Host-driven action with lightweight fallback to any visible actor.
    if [[ "$phase" == *"BETTING" ]]; then
      if attempt_action_for_active_player "$active" "$tick"; then
        action_observed=true
        sleep_ms 650
      else
        local rc=$?
        if [[ "$rc" -eq 2 ]]; then
          sleep_ms $((TURN_TIMEOUT_MS + TIMEBANK_MS + 1000))
          timeout_progress_observed=true
          assert_post_timeout_stale_clicks_rejected "$active" || return 1
        else
          if attempt_any_visible_action "$tick"; then
            action_observed=true
            sleep_ms 650
          else
            sleep_ms "$LIVENESS_WAIT_MS"
          fi
        fi
      fi
    else
      sleep_ms "$LIVENESS_WAIT_MS"
    fi

    # Bounded convergence checkpoint, not per-tick across all sessions.
    if (( tick % 8 == 0 )); then
      local ref_phase ref_board s sig p b
      ref_phase="$(sig_field "$host_sig" "phaseLabel")"
      ref_board="$(sig_field "$host_sig" "revealedBoardCount")"
      for s in "${SESSIONS[@]:1}"; do
        sig="$(read_ui_signature "$s")"
        p="$(sig_field "$sig" "phaseLabel")"
        b="$(sig_field "$sig" "revealedBoardCount")"
        if [[ "$p" != "$ref_phase" || "$b" != "$ref_board" ]]; then
          convergence_mismatch_streak=$((convergence_mismatch_streak + 1))
          if (( convergence_mismatch_streak > 6 )); then
            write_bug_log "cross-client-convergence" "clients diverged on phase/board at bounded checkpoints" "gateway" "$host" "$host_sig"
            return 1
          fi
          break
        fi
      done
      if [[ "$s" == "${SESSIONS[$((PLAYER_COUNT - 1))]}" ]]; then
        convergence_mismatch_streak=0
      fi
    fi
  done
}

main() {
  ensure_local_stack || {
    write_bug_log "stack-startup" "failed to start local stack" "harness" "$(host_session)" "{}"
    return 1
  }

  if [[ "$PLAYER_COUNT" -eq 7 ]]; then
    preflight_capacity || return 1
  fi
  if [[ "$PREFLIGHT_ONLY" == "1" ]]; then
    echo "Agent-browser preflight passed for $PLAYER_COUNT sessions."
    return 0
  fi

  local host
  host="$(host_session)"

  # Host creates room.
  pnpm exec agent-browser --session "$host" open "http://127.0.0.1:$WEB_PORT"
  pnpm exec agent-browser --session "$host" eval "localStorage.setItem('overbet_user_id','$(host_user_id)')"
  pnpm exec agent-browser --session "$host" reload
  pnpm exec agent-browser --session "$host" find role button click --name "Start New Game"
  for _ in $(seq 1 40); do
    if [[ "$(session_url "$host")" == *"/room/"* ]]; then
      break
    fi
    # Retry click if still on lobby/home.
    pnpm exec agent-browser --session "$host" find role button click --name "Start New Game" 2>/dev/null || true
    sleep_ms 500
  done
  local room_url
  room_url="$(pnpm exec agent-browser --session "$host" get url | awk 'NF{last=$0} END{print last}')"
  ROOM_SLUG="$(printf "%s" "$room_url" | awk -F'/' '{print $NF}')"
  if [[ -z "$ROOM_SLUG" ]]; then
    write_bug_log "capture-room-slug" "missing room slug" "harness" "$host" "$(read_ui_signature "$host" || true)"
    return 1
  fi

  # Joiners load room.
  local i session uid
  for i in $(seq 1 $((PLAYER_COUNT - 1))); do
    session="${SESSIONS[$i]}"
    uid="${USER_IDS[$i]}"
    open_room_with_retry "$session" "http://127.0.0.1:$WEB_PORT/room/$ROOM_SLUG" "$uid" || return 1
  done

  # Seat requests for all players (host included).
  for i in "${!SESSIONS[@]}"; do
    request_seat "${SESSIONS[$i]}" "${DISPLAY_NAMES[$i]}" || {
      write_bug_log "seat-request" "failed to submit seat request" "harness" "${SESSIONS[$i]}" "$(read_ui_signature "${SESSIONS[$i]}" || true)"
      return 1
    }
  done

  approve_all_pending "$host" || return 1
  ensure_approval_checkpoint "$host" || return 1
  start_game "$host" || return 1
  all_in_game_and_seated || return 1
  run_continuous_hands || return 1
  if (( COMPLETED_HANDS < TARGET_HANDS )); then
    write_bug_log "hand-completion" "completed hands below target after successful loop" "harness" "$host" "$(read_ui_signature "$host" || true)"
    return 1
  fi

  echo "Agent-browser ${PLAYER_COUNT}-player run passed (room=$ROOM_SLUG hands=$COMPLETED_HANDS target=$TARGET_HANDS)"
}

main "$@"
