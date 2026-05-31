#!/usr/bin/env bash
# pr — PR# for the current branch, review-state colour-coded. segment; reads
# CC_PR_NUM/CC_PR_STATE (projected stdin). Returns via $REPLY.
render__pr() {   # $1 = config JSON (unused)
  [ -n "$CC_PR_NUM" ] || return 0
  local ic c
  case "$CC_PR_STATE" in
    approved)          ic="✓"; c="$BOLD_GREEN";;
    changes_requested) ic="✗"; c="$BOLD_RED";;
    pending)           ic="·"; c="$YELLOW";;
    draft)             ic="◌"; c="$DIM";;
    *)                 ic="";  c="$BASE";;
  esac
  if [ -n "$ic" ]; then
    printf -v REPLY "${KEY}PR#%s${RESET} ${c}%s${RESET}" "$CC_PR_NUM" "$ic"
  else
    printf -v REPLY "${KEY}PR#%s${RESET}" "$CC_PR_NUM"
  fi
}
