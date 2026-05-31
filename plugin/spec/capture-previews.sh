#!/usr/bin/env bash
# capture-previews.sh — write a real-ANSI preview.txt into each built-in component
# dir, so the marketplace web can render what the component actually looks like.
#
# Run from anywhere; resolves the plugin root relative to this file. Segments are
# driven in-process with mock CC_* env (output via $REPLY, materialised with %b);
# line widgets are forked with representative cols/session/config and their stdout
# captured verbatim (already real ESC). A component author runs the same idea to
# ship a preview with a third-party component.
# NB: no `set -u` — component render fns run under the loader (which doesn't set it)
# and legitimately reference conditionally-unset locals (e.g. git's $ahead).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # plugin/
RUNTIME="${HERE}/runtime"
COMP="${HERE}/components"
COLS=78
SID="preview"
source "${RUNTIME}/lib/core.sh"
source "${RUNTIME}/lib/contract.sh"

# realistic projected-stdin env for segments
export CC_MODEL="Opus 4.8 (1M context)"
export CC_CTX_PCT="42"
export CC_FIVE_PCT="22"; export CC_FIVE_RESET="$(( $(date +%s) + 8200 ))"
export CC_WEEK_PCT="38"; export CC_WEEK_RESET="$(( $(date +%s) + 360000 ))"
export CC_COST="12.40"
export CC_PR_NUM="7"; export CC_PR_STATE="approved"
export CC_SID="$SID"
export CC_PROJECT_DIR="$(cd "$HERE/.." && pwd)"   # the claude-statusline repo (a real git repo)
STATE="$(mktemp -d)"; export STATE
USER_COMPONENTS="/nonexistent"; PLUGIN_COMPONENTS="$COMP"

seg() {   # $1=id $2=cfg-json
  REPLY=""
  local fn="render__$1"
  declare -F "$fn" >/dev/null 2>&1 || source "${COMP}/$1/render.sh"
  "$fn" "${2:-{}}"
  printf '%b' "$REPLY"          # materialise \033 → real ESC
}

write() { printf '%s' "$2" > "${COMP}/$1/preview.txt"; printf '  %-14s %sB\n' "$1" "$(wc -c <"${COMP}/$1/preview.txt"|tr -d ' ')"; }

echo "segments:"
write model      "$(seg model)"
write ctx        "$(seg ctx)"
write ratelimit  "$(seg ratelimit '{"window":"5h"}')"
write cost       "$(seg cost)"
write git        "$(seg git)"
write pr         "$(seg pr)"
write nowplaying "$(printf '%b♪%b %bSunset Lover — Honne%b' "$MAGENTA" "$RESET" "$KEY" "$RESET")"  # no live player in CI → representative
write burn       "$(printf '%bburn%b %b3%%/h%b' "$KEY" "$RESET" "$VAL" "$RESET")"                  # needs warmed state → representative

echo "line widgets:"
# news + stock-ticker: fetch once (network), then capture a scroll frame
sd="${STATE}/news";   mkdir -p "$sd"; STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/news"        python3 "${COMP}/news/render.py" --fetch >/dev/null 2>&1
write news        "$(STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/news"        python3 "${COMP}/news/render.py" "$COLS" --session "$SID" 2>/dev/null)"
sd="${STATE}/stk";    mkdir -p "$sd"; STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/stock-ticker" python3 "${COMP}/stock-ticker/render.py" --fetch >/dev/null 2>&1
write stock-ticker "$(STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/stock-ticker" python3 "${COMP}/stock-ticker/render.py" "$COLS" --session "$SID" 2>/dev/null)"
# creatures: warm one tick so a resident pokémon (132 ditto) appears, capture the next frame
sd="${STATE}/crt";    mkdir -p "$sd"
for i in 1 2 3 4 5; do STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/creatures" python3 "${COMP}/creatures/render.py" "$COLS" --session "$SID" --ground grass --resident 132 >/dev/null 2>&1; done
write creatures   "$(STATUSLINE_STATE="$sd" STATUSLINE_CONFIG="${COMP}/creatures" python3 "${COMP}/creatures/render.py" "$COLS" --session "$SID" --ground grass --resident 132 2>/dev/null)"

rm -rf "$STATE"
echo "done."
