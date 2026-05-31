#!/usr/bin/env bash
# statusline/loader.sh — profile-driven status line host.
#
# Reads the CC JSON on stdin, projects it into CC_* env, then walks the active
# profile's components in (slot, order) and assembles the multi-line block:
#
#   TOP widget lines …        (e.g. news ticker)
#   ── rule ──                (host-drawn, if profile.rule)
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

# B-class slow-source cache refresher (pve etc.): detached when stale; segments read $CACHE.
CACHE="${HOME}/.claude/.statusline-cache"
REFRESH="${HOME}/.claude/statusline-cache.sh"
if [ -f "$REFRESH" ]; then
  cache_age=999999
  [ -f "$CACHE" ] && cache_age=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || echo 0) ))
  [ "$cache_age" -ge 30 ] && ( bash "$REFRESH" >/dev/null 2>&1 & )
  # shellcheck disable=SC1090
  [ -f "$CACHE" ] && . "$CACHE"     # exports pve_run / pve_total for the pve segment
fi

# Resolve active profile: env override → user default → bundled example.
PROFILE="${STATUSLINE_PROFILE:-${PROFILES}/default.json}"
[ -f "$PROFILE" ] || PROFILE="${PLUGIN_ROOT}/profiles/full.json"

# Walk components, bucket outputs by slot.
declare -a ROW1 ROW2 TOP MIDDLE BOTTOM
while IFS=$'\t' read -r id slot order cfg; do
  [ -n "$id" ] || continue
  case "$slot" in
    row1)   out=$(render_segment "$id" "$cfg"); [ -n "$out" ] && ROW1+=("$out");;
    row2)   out=$(render_segment "$id" "$cfg"); [ -n "$out" ] && ROW2+=("$out");;
    top)    out=$(render_widget  "$id" "$cfg" "$COLS" "$SID"); [ -n "$out" ] && TOP+=("$out");;
    middle) out=$(render_widget  "$id" "$cfg" "$COLS" "$SID"); [ -n "$out" ] && MIDDLE+=("$out");;
    bottom) out=$(render_widget  "$id" "$cfg" "$COLS" "$SID"); [ -n "$out" ] && BOTTOM+=("$out");;
  esac
done < <(profile_iter "$PROFILE")

rule_on=$(jq -r '.rule // false' "$PROFILE" 2>/dev/null)

# Assemble — fixed slot order, arbitrary lines per slot. segment rows go through %b
# (to interpret the literal-ESC separator); widget bytes print verbatim with %s.
for w in "${TOP[@]}";    do printf '%s\n' "$w"; done
[ "$rule_on" = "true" ] && printf "${RULE_COLOR}%s${RESET}\n" "$(printf '─%.0s' $(seq 1 "$COLS"))"
for w in "${MIDDLE[@]}"; do printf '%s\n' "$w"; done
printf '%b\n' "$(join_sep "${ROW1[@]}")"
printf '%b'   "$(join_sep "${ROW2[@]}")"
for w in "${BOTTOM[@]}"; do printf '\n%s' "$w"; done

# Side-effects (non-visual): run each named side-effect script if found (user layer
# first, then plugin built-ins). Detached; CC_* are already exported so they inherit.
for se in $(jq -r '.side_effects // [] | .[]' "$PROFILE" 2>/dev/null); do
  for d in "${USER_DIR}/side-effects" "${PLUGIN_ROOT}/side-effects"; do
    [ -f "${d}/${se}.sh" ] && { bash "${d}/${se}.sh" >/dev/null 2>&1 & break; }
  done
done
