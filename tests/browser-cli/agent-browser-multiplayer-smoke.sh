#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$ROOT/tests/browser-cli/agent-browser-env.sh"

GATEWAY_LOG="$ROOT/tests/browser-cli/.gateway.log"
WEB_LOG="$ROOT/tests/browser-cli/.web.log"
WEB_PORT=3100
GATEWAY_PORT=4100
TEST_TIMER_MODE="${TEST_TIMER_MODE:-short}"
TURN_TIMEOUT_MS="${TURN_TIMEOUT_MS:-5000}"
TIMEBANK_MS="${TIMEBANK_MS:-5000}"
AUTO_START_DELAY_SECONDS="${AUTO_START_DELAY_SECONDS:-2}"
BUY_IN_AMOUNT="${BUY_IN_AMOUNT:-1000}"
CAPTURE_SUCCESS_ARTIFACTS="${CAPTURE_SUCCESS_ARTIFACTS:-1}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="$ROOT/tests/browser-cli/artifacts/$RUN_ID"
BUG_LOG="$ROOT/tests/browser-cli/bug-log.jsonl"
GIT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
mkdir -p "$ROOT/tests/browser-cli" "$ARTIFACT_DIR"

SESSION_HOST="host"
SESSION_JOINER="joiner"
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
    value = obj.get(key, "")
    if isinstance(value, bool):
        print("true" if value else "false")
    else:
        print(value)
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
  local host_url joiner_url start_state start_visible start_enabled
  host_url="$(pnpm exec agent-browser --session "$SESSION_HOST" get url 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  joiner_url="$(pnpm exec agent-browser --session "$SESSION_JOINER" get url 2>/dev/null | awk 'NF{last=$0} END{print last}')"
  start_state="$(start_game_state "$SESSION_HOST" 2>/dev/null || true)"
  start_visible="$(sig_field "$start_state" "startVisible")"
  start_enabled="$(sig_field "$start_state" "startEnabled")"
  printf '{"ts":"%s","gitSha":"%s","scenario":"%s","roomSlug":"%s","session":"%s","step":"%s","symptom":"%s","classification":"%s","timerMode":"%s","turnTimeoutMs":%s,"timeBankMs":%s,"autoStartDelaySeconds":%s,"timeoutExpected":"false","startGameVisible":"%s","startGameEnabled":"%s","hostUrl":"%s","joinerUrl":"%s","signature":%s,"artifactDir":"%s","gatewayLog":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$GIT_SHA" "$scenario" "$ROOM_SLUG" "$session" "$step" "$symptom" "$classification" \
    "$TEST_TIMER_MODE" "$TURN_TIMEOUT_MS" "$TIMEBANK_MS" "$AUTO_START_DELAY_SECONDS" "${start_visible:-false}" "${start_enabled:-false}" "$host_url" "$joiner_url" "${signature:-\"\"}" \
    "$ARTIFACT_DIR" "$GATEWAY_LOG" >> "$BUG_LOG"
}

request_seat() {
  local session="$1"
  local display_name="$2"
  pnpm exec agent-browser --session "$session" find first "[data-testid^='seat-empty-']" click
  pnpm exec agent-browser --session "$session" find placeholder "Enter your name" fill "$display_name"
  pnpm exec agent-browser --session "$session" find first "input[inputmode='numeric']" fill "$BUY_IN_AMOUNT"
  pnpm exec agent-browser --session "$session" find role button click --name "Request Seat"
}

capture_success_artifacts() {
  if [[ "$CAPTURE_SUCCESS_ARTIFACTS" != "1" ]]; then
    return 0
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" screenshot "$ARTIFACT_DIR/success-host.png" >/dev/null
  pnpm exec agent-browser --session "$SESSION_JOINER" screenshot "$ARTIFACT_DIR/success-joiner.png" >/dev/null
  pnpm exec agent-browser --session "$SESSION_HOST" snapshot > "$ARTIFACT_DIR/snapshot-host.txt"
  pnpm exec agent-browser --session "$SESSION_JOINER" snapshot > "$ARTIFACT_DIR/snapshot-joiner.txt"
  printf 'room=%s\nhost=%s\njoiner=%s\nbuyIn=%s\n' \
    "$ROOM_SLUG" \
    "$(read_ui_signature "$SESSION_HOST" || true)" \
    "$(read_ui_signature "$SESSION_JOINER" || true)" \
    "$BUY_IN_AMOUNT" > "$ARTIFACT_DIR/success-summary.txt"
}

cleanup() {
  local code=${1:-0}
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${GATEWAY_PID:-}" ]]; then kill "$GATEWAY_PID" >/dev/null 2>&1 || true; fi
  if [[ "$code" -ne 0 ]]; then
    pnpm exec agent-browser --session "$SESSION_HOST" screenshot "$ARTIFACT_DIR/failure-host.png" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER" screenshot "$ARTIFACT_DIR/failure-joiner.png" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_HOST" snapshot > "$ARTIFACT_DIR/snapshot-host.txt" 2>/dev/null || true
    pnpm exec agent-browser --session "$SESSION_JOINER" snapshot > "$ARTIFACT_DIR/snapshot-joiner.txt" 2>/dev/null || true
  fi
  cp "$GATEWAY_LOG" "$ARTIFACT_DIR/gateway.log" 2>/dev/null || true
  cp "$WEB_LOG" "$ARTIFACT_DIR/web.log" 2>/dev/null || true
  pnpm exec agent-browser --session "$SESSION_HOST" close >/dev/null 2>&1 || true
  pnpm exec agent-browser --session "$SESSION_JOINER" close >/dev/null 2>&1 || true
}
trap 'ec=$?; cleanup $ec; exit $ec' EXIT

cd "$ROOT"
rm -f "$GATEWAY_LOG" "$WEB_LOG"
for port in $GATEWAY_PORT $WEB_PORT; do
  pid=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
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

pnpm exec agent-browser --session "$SESSION_HOST" open "http://127.0.0.1:$WEB_PORT"
pnpm exec agent-browser --session "$SESSION_HOST" eval "localStorage.setItem('overbet_user_id','ab-host')"
pnpm exec agent-browser --session "$SESSION_HOST" reload
pnpm exec agent-browser --session "$SESSION_HOST" find role button click --name "Start New Game"
pnpm exec agent-browser --session "$SESSION_HOST" wait --url "**/room/**"

ROOM_URL="$(pnpm exec agent-browser --session "$SESSION_HOST" get url | awk 'NF {last=$0} END {print last}')"
ROOM_SLUG="$(printf "%s" "$ROOM_URL" | awk -F'/' '{print $NF}')"
if [[ -z "$ROOM_SLUG" ]]; then
  echo "Failed to capture room slug from host URL: $ROOM_URL"
  write_bug_log "2p-smoke" "$SESSION_HOST" "capture-room-slug" "missing room slug" "harness" "$(read_ui_signature "$SESSION_HOST" || true)"
  exit 1
fi

request_seat "$SESSION_HOST" "AgentHost"

pnpm exec agent-browser --session "$SESSION_JOINER" open "http://127.0.0.1:$WEB_PORT/room/$ROOM_SLUG"
pnpm exec agent-browser --session "$SESSION_JOINER" eval "localStorage.setItem('overbet_user_id','ab-joiner')"
pnpm exec agent-browser --session "$SESSION_JOINER" reload
request_seat "$SESSION_JOINER" "AgentJoiner"

pnpm exec agent-browser --session "$SESSION_HOST" wait 2000
pnpm exec agent-browser --session "$SESSION_HOST" find testid host-seat-requests-toggle click
pnpm exec agent-browser --session "$SESSION_HOST" wait "[data-testid^='approve-seat-']"
for _ in $(seq 1 3); do
  APPROVE_TESTID="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b = document.querySelector('[data-testid^=\"approve-seat-\"]'); return b ? b.getAttribute('data-testid') : '' })()" | tr -d '" \n' | tail -1)"
  if [[ -z "$APPROVE_TESTID" ]]; then
    break
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" find testid "$APPROVE_TESTID" click
  pnpm exec agent-browser --session "$SESSION_HOST" wait 1200
done
for _ in $(seq 1 2); do
  APPROVE_TESTID="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b = document.querySelector('[data-testid^=\"approve-seat-\"]'); return b ? b.getAttribute('data-testid') : '' })()" | tr -d '" \n' | tail -1)"
  if [[ -z "$APPROVE_TESTID" ]]; then
    break
  fi
  pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b = document.querySelector('[data-testid=\"'"$APPROVE_TESTID"'\"]'); if (b) b.click(); })()"
  pnpm exec agent-browser --session "$SESSION_HOST" wait 1200
done
pnpm exec agent-browser --session "$SESSION_HOST" find testid host-seat-requests-toggle click
pnpm exec agent-browser --session "$SESSION_HOST" wait 3000

pending_count="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "document.querySelectorAll('[data-testid^=\"approve-seat-\"]').length" | awk 'NF{last=$0} END{print last}')"
seat_count="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "document.querySelectorAll('[data-testid^=\"seat-player-\"]').length" | awk 'NF{last=$0} END{print last}')"
start_enabled="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => { const b=document.querySelector('[data-testid=\"host-start-game-button\"]'); return !!b && !b.disabled; })()" | awk 'NF{last=$0} END{print last}')"
lobby_player_count_text="$(pnpm exec agent-browser --session "$SESSION_HOST" eval "(() => (document.querySelector('[data-testid=\"lobby-player-count\"]')?.textContent || '').trim())()" | awk 'NF{last=$0} END{print last}')"
host_sig="$(read_ui_signature "$SESSION_HOST" || true)"
joiner_sig="$(read_ui_signature "$SESSION_JOINER" || true)"
host_seated="$(sig_field "$host_sig" "seated")"
joiner_seated="$(sig_field "$joiner_sig" "seated")"
if [[ "${pending_count:-0}" != "0" ]] || { [[ "${seat_count:-0}" -lt 2 ]] && [[ "${host_seated:-false}" != "true" || "${joiner_seated:-false}" != "true" ]]; } || ( [[ "${lobby_player_count_text:-}" == *"Players ("* ]] && [[ "${lobby_player_count_text}" != *"(2)"* ]] ); then
  write_bug_log "2p-smoke" "$SESSION_HOST" "post-approval-checkpoint" "pending=$pending_count seat_count=$seat_count host_seated=$host_seated joiner_seated=$joiner_seated start_enabled=$start_enabled lobby_count=$lobby_player_count_text" "gateway" "$host_sig"
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
    echo "[BUG] 2-player smoke: no enabled host start control (room=$ROOM_SLUG)"
    write_bug_log "2p-smoke" "$SESSION_HOST" "start-hand" "neither host-start-game-button nor host-start-resume-button enabled" "gateway" "$fallback_sig"
    exit 1
  fi
fi

pnpm exec agent-browser --session "$SESSION_JOINER" wait "[data-testid='in-game-view']"
host_sig_final="$(read_ui_signature "$SESSION_HOST")"
joiner_sig_final="$(read_ui_signature "$SESSION_JOINER")"
host_phase="$(sig_field "$host_sig_final" "phaseLabel")"
joiner_phase="$(sig_field "$joiner_sig_final" "phaseLabel")"
host_seated="$(sig_field "$host_sig_final" "seated")"
joiner_seated="$(sig_field "$joiner_sig_final" "seated")"
host_action_enabled="$(sig_field "$host_sig_final" "actionBarEnabled")"
joiner_action_enabled="$(sig_field "$joiner_sig_final" "actionBarEnabled")"
host_error="$(sig_field "$host_sig_final" "errorBannerText")"
joiner_error="$(sig_field "$joiner_sig_final" "errorBannerText")"

if [[ "$host_seated" != "true" || "$joiner_seated" != "true" ]]; then
  write_bug_log "2p-smoke" "$SESSION_JOINER" "post-start-seated-check" "in-game view visible but seated/player-perspective missing" "frontend" "$joiner_sig_final"
  exit 1
fi
if [[ -n "$host_error" || -n "$joiner_error" ]]; then
  write_bug_log "2p-smoke" "$SESSION_JOINER" "post-start-error-check" "error banner present after start flow" "frontend" "$joiner_sig_final"
  exit 1
fi

if [[ "$host_phase" != "$joiner_phase" ]]; then
  for _ in $(seq 1 10); do
    pnpm exec agent-browser --session "$SESSION_HOST" wait 500 >/dev/null
    host_sig_final="$(read_ui_signature "$SESSION_HOST")"
    joiner_sig_final="$(read_ui_signature "$SESSION_JOINER")"
    host_phase="$(sig_field "$host_sig_final" "phaseLabel")"
    joiner_phase="$(sig_field "$joiner_sig_final" "phaseLabel")"
    if [[ "$host_phase" == "$joiner_phase" ]]; then
      break
    fi
  done
fi
host_action_enabled="$(sig_field "$host_sig_final" "actionBarEnabled")"
joiner_action_enabled="$(sig_field "$joiner_sig_final" "actionBarEnabled")"

if [[ "$host_phase" == "LOBBY" && "$host_action_enabled" == "true" ]]; then
  write_bug_log "2p-smoke" "$SESSION_HOST" "lobby-seated-nuance" "host in LOBBY with active action bar" "frontend" "$host_sig_final"
  exit 1
fi
if [[ "$joiner_phase" == "LOBBY" && "$joiner_action_enabled" == "true" ]]; then
  write_bug_log "2p-smoke" "$SESSION_JOINER" "lobby-seated-nuance" "joiner in LOBBY with active action bar" "frontend" "$joiner_sig_final"
  exit 1
fi

capture_success_artifacts

if [[ "$host_phase" == "LOBBY" || "$joiner_phase" == "LOBBY" ]]; then
  echo "Agent-browser multiplayer smoke passed for room $ROOM_SLUG (lobby+seated state observed with inactive action bar)"
else
  echo "Agent-browser multiplayer smoke passed for room $ROOM_SLUG (phase=$joiner_phase hostPhase=$host_phase)"
fi
