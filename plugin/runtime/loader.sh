#!/usr/bin/env bash
# statusline/loader.sh — profile-driven status line host.
#
# Reads the CC JSON on stdin, projects it into CC_* env, then walks the active
# profile's components in (slot, order) and assembles the multi-line block:
#
#   TOP widget lines …        (e.g. news ticker, or a divider)
#   MIDDLE widget lines …     (e.g. creatures stage — may be many lines)
#   ROW1 segments joined ' · '
#   ROW2 segments joined ' · '
#   BOTTOM widget lines …     (e.g. stock ticker)
#
# segment slots = row1|row2 (in-process bash fns, zero fork); widget slots =
# top|middle|bottom (forked scripts, arbitrary lines each). See lib/contract.sh.

input=$(cat)

# Plugin root: the shim exports STATUSLINE_PLUGIN_ROOT (resolved to the latest
# installed version); fall back to this script's own location for dev/standalone runs.
PLUGIN_ROOT="${STATUSLINE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LIB="${PLUGIN_ROOT}/runtime/lib"
# Component search path: user layer first (personal + installed), then plugin built-ins.
USER_DIR="${HOME}/.claude/statusline"
USER_COMPONENTS="${USER_DIR}/components"
PLUGIN_COMPONENTS="${PLUGIN_ROOT}/components"
PROFILES="${USER_DIR}/profiles"
STATE="${HOME}/.claude/.statusline-state"; mkdir -p "$STATE" 2>/dev/null
# shellcheck disable=SC1090
source "${LIB}/core.sh"
source "${LIB}/contract.sh"

COLS=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}

# Project stdin JSON → CC_* env (the only fields any component sees).
eval "$(extract_stdin_fields <<<"$input")"
SID="$CC_SID"

# Resolve active profile: env override → user default → bundled example.
PROFILE="${STATUSLINE_PROFILE:-${PROFILES}/default.json}"
[ -f "$PROFILE" ] || PROFILE="${PLUGIN_ROOT}/profiles/full.json"

# Opportunistic GC: render-cache files are keyed per (session, order), so ended sessions
# and changed profiles leave orphans under $STATE that nothing else evicts. Throttle to
# ~once/hour via a marker (free per tick), then drop cache files untouched for a day.
gc="${STATE}/.gc"
if [ ! -f "$gc" ] || [ "$(( $(date +%s) - $(_mtime "$gc") ))" -gt 3600 ]; then
  : > "$gc"
  find "$STATE" -name '.render.*' -mtime +1 -delete 2>/dev/null
fi

# Walk components, bucket outputs by slot. Segments split into left/right by align.
declare -a ROW1_L ROW1_R ROW2_L ROW2_R TOP MIDDLE BOTTOM
while IFS=$'\t' read -r id slot order cfg align ttl; do
  [ -n "$id" ] || continue
  case "$slot" in
    row1)   out=$(render_segment "$id" "$cfg" "$ttl" "$SID" "$order"); [ -n "$out" ] && { [ "$align" = right ] && ROW1_R+=("$out") || ROW1_L+=("$out"); };;
    row2)   out=$(render_segment "$id" "$cfg" "$ttl" "$SID" "$order"); [ -n "$out" ] && { [ "$align" = right ] && ROW2_R+=("$out") || ROW2_L+=("$out"); };;
    top)    out=$(render_widget  "$id" "$cfg" "$COLS" "$SID" "$ttl" "$order"); [ -n "$out" ] && TOP+=("$out");;
    middle) out=$(render_widget  "$id" "$cfg" "$COLS" "$SID" "$ttl" "$order"); [ -n "$out" ] && MIDDLE+=("$out");;
    bottom) out=$(render_widget  "$id" "$cfg" "$COLS" "$SID" "$ttl" "$order"); [ -n "$out" ] && BOTTOM+=("$out");;
  esac
done < <(profile_iter "$PROFILE")

# Assemble — fixed slot order, arbitrary lines per slot. Segment rows compose a left
# group + a right group (align), padded apart to fill COLS; widget bytes print with %s.
for w in "${TOP[@]}";    do printf '%s\n' "$w"; done
for w in "${MIDDLE[@]}"; do printf '%s\n' "$w"; done
emit_row "$(join_sep "${ROW1_L[@]}")" "$(join_sep "${ROW1_R[@]}")"; printf '\n'
emit_row "$(join_sep "${ROW2_L[@]}")" "$(join_sep "${ROW2_R[@]}")"
for w in "${BOTTOM[@]}"; do printf '\n%s' "$w"; done
