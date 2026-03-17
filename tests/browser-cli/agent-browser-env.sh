#!/usr/bin/env bash
# Detect system Chrome/Chromium and set AGENT_BROWSER_EXECUTABLE_PATH
# so agent-browser uses it instead of Playwright's bundled Chromium.
# Avoids the need for "playwright install chromium".
# Skip if AGENT_BROWSER_EXECUTABLE_PATH is already set and points to an executable.

if [[ -n "${AGENT_BROWSER_EXECUTABLE_PATH:-}" ]] && [[ -x "$AGENT_BROWSER_EXECUTABLE_PATH" ]]; then
  return 0 2>/dev/null || exit 0
fi

case "$(uname -s)" in
  Darwin)
    for p in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
             "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
      if [[ -x "$p" ]]; then
        export AGENT_BROWSER_EXECUTABLE_PATH="$p"
        break
      fi
    done
    ;;
  Linux)
    for p in /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser; do
      if [[ -x "$p" ]]; then
        export AGENT_BROWSER_EXECUTABLE_PATH="$p"
        break
      fi
    done
    ;;
  MINGW*|MSYS*|CYGWIN*)
    localappdata="${LOCALAPPDATA:-${HOME:-/tmp}/AppData/Local}"
    for p in "$localappdata/Google/Chrome/Application/chrome.exe"; do
      if [[ -x "$p" ]]; then
        export AGENT_BROWSER_EXECUTABLE_PATH="$p"
        break
      fi
    done
    ;;
  *)
    ;;
esac

if [[ -z "${AGENT_BROWSER_EXECUTABLE_PATH:-}" ]]; then
  echo "agent-browser-env: No system Chrome/Chromium found. Install Chrome or set AGENT_BROWSER_EXECUTABLE_PATH." >&2
  exit 1
fi
