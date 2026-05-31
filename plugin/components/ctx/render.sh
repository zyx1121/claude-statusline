#!/usr/bin/env bash
# ctx — context-window usage %. segment; reads CC_CTX_PCT, returns via $REPLY.
render__ctx() {   # $1 = config JSON (unused)
  [ -n "$CC_CTX_PCT" ] || return 0
  local i col
  printf -v i '%.0f' "$CC_CTX_PCT"
  col=$(pct_color "$i")
  printf -v REPLY "${KEY}ctx${RESET} ${col}%d%%${RESET}" "$i"
}
