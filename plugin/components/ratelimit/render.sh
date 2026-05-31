#!/usr/bin/env bash
# ratelimit — usage-limit % + reset countdown for a window. segment; config.window=5h|7d.
# Reads CC_FIVE_*/CC_WEEK_* (projected stdin). Returns via $REPLY.
render__ratelimit() {   # $1 = config JSON, e.g. {"window":"7d"}
  local win pct reset label i col
  win=$(printf '%s' "$1" | jq -r '.window // "5h"' 2>/dev/null)
  case "$win" in
    7d) label="7d"; pct="$CC_WEEK_PCT"; reset="$CC_WEEK_RESET";;
    *)  label="5h"; pct="$CC_FIVE_PCT"; reset="$CC_FIVE_RESET";;
  esac
  [ -n "$pct" ] || return 0
  printf -v i '%.0f' "$pct"
  col=$(pct_color "$i")
  if [ -n "$reset" ]; then
    printf -v REPLY "${KEY}%s${RESET} ${col}%d%%${RESET} ${DIM}%s${RESET}" "$label" "$i" "$(fmt_countdown "$reset")"
  else
    printf -v REPLY "${KEY}%s${RESET} ${col}%d%%${RESET}" "$label" "$i"
  fi
}
