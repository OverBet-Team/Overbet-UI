#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ayan/Desktop/Manus Poker"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"

GATEWAY_LOG="$ROOT/tests/browser-cli/.gateway.log"
WEB_LOG="$ROOT/tests/browser-cli/.web.log"
WEB_PORT=3100
GATEWAY_PORT=4100
TEST_TIMER_MODE="${TEST_TIMER_MODE:-short}"
TURN_TIMEOUT_MS="${TURN_TIMEOUT_MS:-5000}"
TIMEBANK_MS="${TIMEBANK_MS:-5000}"
AUTO_START_DELAY_SECONDS="${AUTO_START_DELAY_SECONDS:-2}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="$ROOT/tests/browser-cli/artifacts/$RUN_ID"
BUG_LOG="$ROOT/tests/browser-cli/bug-log.jsonl"
GIT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
mkdir -p "$ROOT/tests/browser-cli" "$ARTIFACT_DIR"

SESSION_HOST="host"
SESSION_JOINER1="joiner1"
SESSION_JOINER2="joiner2"
ROOM_SLUG=""

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
    v = obj.get(key, "")
    if isinstance(v, bool):
        print("true" if v else "false")
    else:
        print(v)
except Exception:
    print("")
PY
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

write_bug_log() {
  local scenario="$1"
  local session="$2"
  local step="$3"
  local symptom="$4"
  local classification="$5"
  local signature="$6"
  local host_url joiner1_url joiner2_url start_state start_visible start_enabled
  host_url="$(pnpm exec agent-browser --session "$SESSION_HOST" get url 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  joiner1_url="$(pnpm exec agent-browser --session "$SESSION_JOINER1" get url 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  joiner2_url="$(pnpm exec agent-browser --session "$SESSION_JOINER2" get url 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  start_state="$(start_game_state "$SESSION_HOST" 2>/dev/null || true)"
  start_visible="$(sig_field "$start_state" "startVisible")"
  start_enabled="$(sig_field "$start_state" "startEnabled")"
  printf '{"ts":"%s","gitSha":"%s","scenario":"%s","roomSlug":"%s","session":"%s","step":"%s","symptom":"%s","classification":"%s","timerMode":"%s","turnTimeoutMs":%s,"timeBankMs":%s,"autoStartDelaySeconds":%s,"timeoutExpected":"false","startGameVisible":"%s","startGameEnabled":"%s","hostUrl":"%s","joiner1Url":"%s","joiner2Url":"%s","signature":%s,"artifactDir":"%s","gatewayLog":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$GIT_SHA" "$scenario" "$ROOM_SLUG" "$session" "$step" "$symptom" "$classification" \
    "$TEST_TIMER_MODE" "$TURN_TIMEOUT_MS" "$TIMEBANK_MS" "$AUTO_START_DELAY_SECONDS" "${start_visible:-false}" "${start_enabled:-false}" "$host_url" "$joiner1_url" "$joiner2_url" "${signature:-\"\"}" \
    "$ARTIFACT_DIR" "$GATEWAY_LOG" >> "$BUG_LOG"
}

cleanup() {
  local code=${1:-0}
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${GATEWAY_PID:-}" ]]; then kill "$GATEWAY_PID" >/dev/null 2>&1 || true; fi
  if [[ "$code" -ne 0 ]]; then
    pnpm exec agent-browser --session "$SESSION_HOST" screenshot "$ARTIFACT_DIR/failure-host.png" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER1" screenshot "$ARTIFACT_DIR/failure-joiner1.png" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER2" screenshot "$ARTIFACT_DIR/failure-joiner2.png" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_HOST" snapshot > "$ARTIFACT_DIR/snapshot-host.txt" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER1" snapshot > "$ARTIFACT_DIR/snapshot-joiner1.txt" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER2" snapshot > "$ARTIFACT_DIR/snapshot-joiner2.txt" 2>/dev/null || true
    cp "$GATEWAY_LOG" "$ARTIFACT_DIR/gateway.log" 2>/dev/null || true
    cp "$WEB_LOG" "$ARTIFACT_DIR/web.log" 2>/dev/null || true
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" close >/dev/null 2>&1 || true
  pnpm exec agent-browser --session "$SESSION_JOINER1" close >/dev/null 2>&1 || true
  pnpm exec agent-browser --session "$SESSION_JOINER2" close >/dev/null 2>&1 || true
}
trap 'ec=$?; cleanup $ec; exit $ec' EXIT

cd "$ROOT"
rm -f "$GATEWAY_LOG" "$WEB_LOG"
for port in $GATEWAY_PORT $WEB_PORT; do
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
    break
  fi
  sleep 1
done

# Host creates room.
pnpm exec agent-browser --session "$SESSION_HOST" open "http://127.0.0.1:$WEB_PORT"
pnpm exec agent-browser --session "$SESSION_HOST" eval "localStorage.setItem('overbet_user_id','ab-host')"
pnpm exec agent-browser --session "$SESSION_HOST" reload
pnpm exec agent-browser --session "$SESSION_HOST" find role button click --name "Start New Game"
pnpm exec agent-browser --session "$SESSION_HOST" wait --url "**/room/**"
ROOM_URL="$(pnpm exec agent-browser --session "$SESSION_HOST" get url | awk 'NF {last=$0} END {print last}')"
ROOM_SLUG="$(printf "%s" "$ROOM_URL" | awk -F'/' '{print $NF}')"
if [[ -z "$ROOM_SLUG" ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "capture-room-slug" "missing room slug" "harness" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

# Seat requests for all 3.
pnpm exec agent-browser --session "$SESSION_HOST" find first "[data-testid^='seat-empty-']" click
pnpm exec agent-browser --session "$SESSION_HOST" find placeholder "Enter your name" fill "AgentHost"
pnpm exec agent-browser --session "$SESSION_HOST" find role button click --name "Request Seat"

pnpm exec agent-browser --session "$SESSION_JOINER1" open "http://127.0.0.1:$WEB_PORT/room/$ROOM_SLUG"
pnpm exec agent-browser --session "$SESSION_JOINER1" eval "localStorage.setItem('overbet_user_id','ab-joiner-1')"
pnpm exec agent-browser --session "$SESSION_JOINER1" reload
pnpm exec agent-browser --session "$SESSION_JOINER1" find first "[data-testid^='seat-empty-']" click
pnpm exec agent-browser --session "$SESSION_JOINER1" find placeholder "Enter your name" fill "AgentJoiner1"
pnpm exec agent-browser --session "$SESSION_JOINER1" find role button click --name "Request Seat"

pnpm exec agent-browser --session "$SESSION_JOINER2" open "http://127.0.0.1:$WEB_PORT/room/$ROOM_SLUG"
pnpm exec agent-browser --session "$SESSION_JOINER2" eval "localStorage.setItem('overbet_user_id','ab-joiner-2')"
pnpm exec agent-browser --session "$SESSION_JOINER2" reload
pnpm exec agent-browser --session "$SESSION_JOINER2" find first "[data-testid^='seat-empty-']" click
pnpm exec agent-browser --session "$SESSION_JOINER2" find placeholder "Enter your name" fill "AgentJoiner2"
pnpm exec agent-browser --session "$SESSION_JOINER2" find role button click --name "Request Seat"

# Host approves all pending requests.
pnpm exec agent-browser --session "$SESSION_HOST" wait 2000
pnpm exec agent-browser --session "$SESSION_HOST" find testid host-seat-requests-toggle click
pnpm exec agent-browser --session "$SESSION_HOST" wait "[data-testid^='approve-seat-']"
for _ in $(seq 1 6); do
  APPROVE_TESTID="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b = document.querySelector('[data-testid^=\"approve-seat-\"]'); return b ? b.getAttribute('data-testid') : '' })()" | tr -d '" \n' | tail -1)"
  if [[ -z "$APPROVE_TESTID" ]]; then
    break
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" find testid "$APPROVE_TESTID" click
  pnpm exec agent-browser --session "$SESSION_HOST" wait 900
done
pnpm exec agent-browser --session "$SESSION_HOST" find testid host-seat-requests-toggle click
pnpm exec agent-browser --session "$SESSION_HOST" wait 3000

# Approval checkpoint.
pending_count="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "document.querySelectorAll('[data-testid^=\"approve-seat-\"]').length" | awk 'NF{last=$0} END{print last}')"
seat_count="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "document.querySelectorAll('[data-testid^=\"seat-player-\"]').length" | awk 'NF{last=$0} END{print last}')"
start_enabled="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-game-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
lobby_player_count="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => (document.querySelector('[data-testid=\"lobby-player-count\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
host_sig="$(read_ui_signature "$SESSION_HOST" || true)"
joiner1_sig="$(read_ui_signature "$SESSION_JOINER1" || true)"
joiner2_sig="$(read_ui_signature "$SESSION_JOINER2" || true)"
host_seated="$(sig_field "$host_sig" "seated")"
joiner1_seated="$(sig_field "$joiner1_sig" "seated")"
joiner2_seated="$(sig_field "$joiner2_sig" "seated")"
if [[ "${pending_count:-0}" != "0" ]] || { [[ "${seat_count:-0}" -lt 3 ]] && [[ "${host_seated:-false}" != "true" || "${joiner1_seated:-false}" != "true" || "${joiner2_seated:-false}" != "true" ]]; } || { [[ "${lobby_player_count:-}" == *"Players ("* ]] && [[ "${lobby_player_count:-}" != *"(3)"* ]]; }; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "post-approval-checkpoint" "pending/seat/player-count validation failed" "gateway" "$host_sig"
  exit 1
fi

start_lobby_enabled="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-game-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
if [[ "${start_lobby_enabled:-false}" == "true" ]]; then
  pnpm exec agent-browser --session "$SESSION_HOST" find testid host-start-game-button click
else
  pnpm exec agent-browser --session "$SESSION_HOST" find testid host-seat-requests-toggle click
  start_panel_enabled="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-resume-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
  if [[ "${start_panel_enabled:-false}" == "true" ]]; then
    pnpm exec agent-browser --session "$SESSION_HOST" find testid host-start-resume-button click
  else
    fallback_sig="$(read_ui_signature "$SESSION_HOST" || true)"
    write_bug_log "3p-convergence" "$SESSION_HOST" "start-hand" "neither host-start-game-button nor host-start-resume-button enabled" "gateway" "$fallback_sig"
    exit 1
  fi
fi

# All sessions should transition to in-game and seated/player perspective.
pnpm exec agent-browser --session "$SESSION_HOST" wait "[data-testid='in-game-view']"
pnpm exec agent-browser --session "$SESSION_JOINER1" wait "[data-testid='in-game-view']"
pnpm exec agent-browser --session "$SESSION_JOINER2" wait "[data-testid='in-game-view']"
pnpm exec agent-browser --session "$SESSION_HOST" wait "[data-testid='player-perspective']"
pnpm exec agent-browser --session "$SESSION_JOINER1" wait "[data-testid='player-perspective']"
pnpm exec agent-browser --session "$SESSION_JOINER2" wait "[data-testid='player-perspective']"

# At least one explicit UI action.
if pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-check-call click 2>/dev/null; then
  :
elif pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-fold click 2>/dev/null; then
  :
elif pnpm exec agent-browser --session "$SESSION_HOST" find testid action-check-call click 2>/dev/null; then
  :
else
  write_bug_log "3p-convergence" "$SESSION_JOINER1" "explicit-action" "could not execute any explicit player action" "harness" "$(read_ui_signature "$SESSION_JOINER1" || true)"
  exit 1
fi

# Liveness and timeout/default-action progression check.
initial_sig="$(read_ui_signature "$SESSION_JOINER2")"
initial_phase="$(sig_field "$initial_sig" "phaseLabel")"
initial_board="$(sig_field "$initial_sig" "revealedBoardCount")"
initial_active="$(sig_field "$initial_sig" "activePlayerId")"
same_count=0
same_error_count=0
last_sig="$initial_sig"
last_error="$(sig_field "$initial_sig" "errorBannerText")"
progressed="false"

for _ in $(seq 1 40); do
  pnpm exec agent-browser --session "$SESSION_JOINER2" wait 500 >/dev/null
  curr_sig="$(read_ui_signature "$SESSION_JOINER2")"
  curr_phase="$(sig_field "$curr_sig" "phaseLabel")"
  curr_board="$(sig_field "$curr_sig" "revealedBoardCount")"
  curr_active="$(sig_field "$curr_sig" "activePlayerId")"
  curr_error="$(sig_field "$curr_sig" "errorBannerText")"

  if [[ "$curr_phase" != "$initial_phase" ]] || [[ "${curr_board:-0}" -gt "${initial_board:-0}" ]] || [[ "$curr_active" != "$initial_active" ]]; then
    progressed="true"
    break
  fi

  if [[ "$curr_sig" == "$last_sig" ]]; then
    same_count=$((same_count + 1))
  else
    same_count=0
    last_sig="$curr_sig"
  fi

  if [[ -n "$curr_error" ]] && [[ "$curr_error" == "$last_error" ]]; then
    same_error_count=$((same_error_count + 1))
  else
    same_error_count=0
    last_error="$curr_error"
  fi

  if [[ "$same_count" -gt 12 ]] || [[ "$same_error_count" -gt 4 ]]; then
    write_bug_log "3p-convergence" "$SESSION_JOINER2" "liveness-loop" "stalled signature or repeated error" "frontend" "$curr_sig"
    exit 1
  fi
done

if [[ "$progressed" != "true" ]]; then
  write_bug_log "3p-convergence" "$SESSION_JOINER2" "timeout-progression" "no meaningful UI progression within bounded window" "gateway" "$(read_ui_signature "$SESSION_JOINER2" || true)"
  exit 1
fi

# Convergence check across all clients.
converged="false"
for _ in $(seq 1 20); do
  sig_h="$(read_ui_signature "$SESSION_HOST")"
  sig_1="$(read_ui_signature "$SESSION_JOINER1")"
  sig_2="$(read_ui_signature "$SESSION_JOINER2")"
  ph_h="$(sig_field "$sig_h" "phaseLabel")"
  ph_1="$(sig_field "$sig_1" "phaseLabel")"
  ph_2="$(sig_field "$sig_2" "phaseLabel")"
  br_h="$(sig_field "$sig_h" "revealedBoardCount")"
  br_1="$(sig_field "$sig_1" "revealedBoardCount")"
  br_2="$(sig_field "$sig_2" "revealedBoardCount")"
  ac_h="$(sig_field "$sig_h" "activePlayerId")"
  ac_1="$(sig_field "$sig_1" "activePlayerId")"
  ac_2="$(sig_field "$sig_2" "activePlayerId")"
  if [[ "$ph_h" == "$ph_1" ]] && [[ "$ph_h" == "$ph_2" ]] && [[ "$br_h" == "$br_1" ]] && [[ "$br_h" == "$br_2" ]] && [[ "$ac_h" == "$ac_1" ]] && [[ "$ac_h" == "$ac_2" ]]; then
    converged="true"
    break
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" wait 500 >/dev/null
done
if [[ "$converged" != "true" ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "cross-client-convergence" "clients diverged on phase/board/active player" "gateway" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

# Board reveal should progress at least once (drive actions toward flop if needed).
flop_reached="false"
for _ in $(seq 1 24); do
  host_sig_loop="$(read_ui_signature "$SESSION_HOST")"
  board_now="$(sig_field "$host_sig_loop" "revealedBoardCount")"
  active_now="$(sig_field "$host_sig_loop" "activePlayerId")"
  if [[ "${board_now:-0}" -ge 3 ]]; then
    flop_reached="true"
    break
  fi

  case "$active_now" in
    "ab-host")
      if ! pnpm exec agent-browser --session "$SESSION_HOST" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_HOST" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    "ab-joiner-1")
      if ! pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    "ab-joiner-2")
      if ! pnpm exec agent-browser --session "$SESSION_JOINER2" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_JOINER2" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    *)
      ;;
  esac
  pnpm exec agent-browser --session "$SESSION_HOST" wait 1000 >/dev/null
done

final_board="$(sig_field "$(read_ui_signature "$SESSION_HOST")" "revealedBoardCount")"
if [[ "$flop_reached" != "true" ]] && [[ "${final_board:-0}" -lt 3 ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "board-reveal" "board did not reach flop reveal threshold" "engine" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

# Winner/showdown assertions: drive hand to completion and require winner UI convergence.
winner_visible_all="false"
for _ in $(seq 1 80); do
  sig_h="$(read_ui_signature "$SESSION_HOST")"
  sig_1="$(read_ui_signature "$SESSION_JOINER1")"
  sig_2="$(read_ui_signature "$SESSION_JOINER2")"
  w_h="$(sig_field "$sig_h" "winnerVisible")"
  w_1="$(sig_field "$sig_1" "winnerVisible")"
  w_2="$(sig_field "$sig_2" "winnerVisible")"
  if [[ "$w_h" == "true" && "$w_1" == "true" && "$w_2" == "true" ]]; then
    winner_visible_all="true"
    break
  fi

  active_now="$(sig_field "$sig_h" "activePlayerId")"
  case "$active_now" in
    "ab-host")
      if ! pnpm exec agent-browser --session "$SESSION_HOST" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_HOST" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    "ab-joiner-1")
      if ! pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_JOINER1" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    "ab-joiner-2")
      if ! pnpm exec agent-browser --session "$SESSION_JOINER2" find testid action-check-call click 2>/dev/null; then
        pnpm exec agent-browser --session "$SESSION_JOINER2" find testid action-fold click 2>/dev/null || true
      fi
      ;;
    *)
      ;;
  esac
  pnpm exec agent-browser --session "$SESSION_HOST" wait 800 >/dev/null
done

if [[ "$winner_visible_all" != "true" ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "winner-showdown" "winner-toast did not converge across clients" "frontend" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

winner_name_host="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => (document.querySelector('[data-testid=\"winner-hand-name\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
winner_name_joiner1="$(pnpm exec agent-browser --session "$SESSION_JOINER1" eval "(() => (document.querySelector('[data-testid=\"winner-hand-name\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
winner_name_joiner2="$(pnpm exec agent-browser --session "$SESSION_JOINER2" eval "(() => (document.querySelector('[data-testid=\"winner-hand-name\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
if [[ -z "${winner_name_host:-}" || -z "${winner_name_joiner1:-}" || -z "${winner_name_joiner2:-}" ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "winner-hand-name" "winner-hand-name missing on one or more clients" "frontend" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

# Next-hand assertions: ensure reset/progression after showdown.
next_hand_reset="false"
for _ in $(seq 1 80); do
  sig_h="$(read_ui_signature "$SESSION_HOST")"
  sig_1="$(read_ui_signature "$SESSION_JOINER1")"
  sig_2="$(read_ui_signature "$SESSION_JOINER2")"
  ph_h="$(sig_field "$sig_h" "phaseLabel")"
  ph_1="$(sig_field "$sig_1" "phaseLabel")"
  ph_2="$(sig_field "$sig_2" "phaseLabel")"
  br_h="$(sig_field "$sig_h" "revealedBoardCount")"
  br_1="$(sig_field "$sig_1" "revealedBoardCount")"
  br_2="$(sig_field "$sig_2" "revealedBoardCount")"
  w_h="$(sig_field "$sig_h" "winnerVisible")"
  w_1="$(sig_field "$sig_1" "winnerVisible")"
  w_2="$(sig_field "$sig_2" "winnerVisible")"
  err_h="$(sig_field "$sig_h" "errorBannerText")"
  err_1="$(sig_field "$sig_1" "errorBannerText")"
  err_2="$(sig_field "$sig_2" "errorBannerText")"
  act_h="$(sig_field "$sig_h" "activePlayerId")"
  act_1="$(sig_field "$sig_1" "activePlayerId")"
  act_2="$(sig_field "$sig_2" "activePlayerId")"

  if [[ "$ph_h" == "$ph_1" && "$ph_h" == "$ph_2" ]] && \
     [[ "${br_h:-0}" == "0" && "${br_1:-0}" == "0" && "${br_2:-0}" == "0" ]] && \
     [[ "$w_h" == "false" && "$w_1" == "false" && "$w_2" == "false" ]] && \
     [[ -n "$act_h" && "$act_h" == "$act_1" && "$act_h" == "$act_2" ]] && \
     [[ -z "$err_h" && -z "$err_1" && -z "$err_2" ]]; then
    next_hand_reset="true"
    break
  fi

  pnpm exec agent-browser --session "$SESSION_HOST" wait 500 >/dev/null
done

if [[ "$next_hand_reset" != "true" ]]; then
  write_bug_log "3p-convergence" "$SESSION_HOST" "next-hand-reset" "next hand did not reset cleanly with convergence" "gateway" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

echo "Agent-browser 3-player convergence passed (room=$ROOM_SLUG board=$final_board winner=$winner_name_host reset=$next_hand_reset)"
