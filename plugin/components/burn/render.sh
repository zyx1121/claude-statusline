#!/usr/bin/env bash
# burn — how fast the 5h usage budget is climbing (%/h). segment; returns via $REPLY.
# Reads CC_FIVE_PCT + CC_SID (projected stdin) and a per-session state file under $STATE.
# Rate is sampled over windows of ≥60s; only shows once the burn rate is > 0.
render__burn() {   # $1 = config JSON (unused)
  [ -n "$CC_FIVE_PCT" ] && [ -n "$CC_SID" ] || return 0
  local BF bnow bp brate bt0 bp0 br0 bdt
  BF="${STATE}/burn.${CC_SID}"
  bnow=$(date +%s); bp=$(printf '%.1f' "$CC_FIVE_PCT"); brate=0
  if [ -f "$BF" ]; then
    read -r bt0 bp0 br0 < "$BF" 2>/dev/null
    bdt=$(( bnow - ${bt0:-$bnow} ))
    if [ "$bdt" -ge 60 ]; then
      br0=$(awk -v a="$bp" -v b="${bp0:-$bp}" -v d="$bdt" 'BEGIN{v=(a-b)/d*3600; if(v<0)v=0; printf "%.0f", v}')
      printf '%s %s %s\n' "$bnow" "$bp" "$br0" > "$BF"
    fi
    brate=${br0:-0}
  else
    printf '%s %s 0\n' "$bnow" "$bp" > "$BF"
  fi
  if [ "${brate:-0}" -gt 0 ] 2>/dev/null; then
    printf -v REPLY "${KEY}burn${RESET} ${VAL}%s%%/h${RESET}" "$brate"
  fi
}
