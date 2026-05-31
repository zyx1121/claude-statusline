#!/usr/bin/env bash
# git — repo state: (branch) + dirty <elapsed> / ahead <N> / commits <N>. segment.
# Reads CC_PROJECT_DIR (projected stdin); shells out to git. Returns via $REPLY.
render__git() {   # $1 = config JSON (unused)
  [ -n "$CC_PROJECT_DIR" ] && [ -d "$CC_PROJECT_DIR/.git" ] || return 0

  local branch dirty ahead today

  branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" symbolic-ref --short HEAD 2>/dev/null)
  if [ -z "$branch" ]; then
    branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" rev-parse --short HEAD 2>/dev/null)
  fi

  # dirty <elapsed> — uncommitted changes + time since HEAD commit
  if [ -n "$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" status --porcelain 2>/dev/null)" ]; then
    local last_ts delta
    last_ts=$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" log -1 --format=%ct 2>/dev/null)
    if [ -n "$last_ts" ]; then
      delta=$(( $(date +%s) - last_ts ))
      [ "$delta" -lt 0 ] && delta=0
      if   [ "$delta" -lt 60 ];    then dirty="${delta}s"
      elif [ "$delta" -lt 3600 ];  then dirty="$((delta / 60))m"
      elif [ "$delta" -lt 86400 ]; then dirty="$((delta / 3600))h"
      else                              dirty="$((delta / 86400))d"
      fi
    else
      dirty="—"
    fi
  fi

  # ahead <N> — local commits not pushed to upstream
  local a
  a=$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" rev-list --count @{u}..HEAD 2>/dev/null)
  if [ -n "$a" ] && [ "$a" -gt 0 ]; then
    ahead="$a"
  fi

  # commits today — anything authored since local midnight
  today=$(GIT_OPTIONAL_LOCKS=0 git -C "$CC_PROJECT_DIR" log --since="00:00:00" --oneline 2>/dev/null | wc -l | tr -d ' ')

  local pieces=() piece
  if [ -n "$branch" ]; then
    printf -v piece "${MAGENTA}(%s)${RESET}" "$branch"
    pieces+=("$piece")
  fi
  if [ -n "$dirty" ]; then
    printf -v piece "${KEY}dirty${RESET} ${VAL}%s${RESET}" "$dirty"
    pieces+=("$piece")
  fi
  if [ -n "$ahead" ]; then
    printf -v piece "${KEY}ahead${RESET} ${VAL}%s${RESET}" "$ahead"
    pieces+=("$piece")
  fi
  if [ -n "$today" ] && [ "$today" -gt 0 ] 2>/dev/null; then
    printf -v piece "${KEY}commits${RESET} ${VAL}%s${RESET}" "$today"
    pieces+=("$piece")
  fi

  [ "${#pieces[@]}" -gt 0 ] || return 0
  REPLY=$(join_sep "${pieces[@]}")
}
