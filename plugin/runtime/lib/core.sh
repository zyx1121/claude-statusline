#!/usr/bin/env bash
# statusline/lib/core.sh — shared palette + render helpers, sourced once by the loader.
# Components rely on these names (KEY/VAL/RESET, pct_color, fmt_countdown). Keep stable.

shopt -s extglob   # vwidth's SGR-strip glob needs it

# ANSI helpers
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD_RED='\033[1;31m'
BOLD_YELLOW='\033[1;33m'
BOLD_GREEN='\033[1;32m'
BOLD_BLUE='\033[1;34m'
BOLD_CYAN='\033[1;36m'
BOLD_MAGENTA='\033[1;35m'
# Palette — cool-grey base text, warm accent for the numbers/values
BASE='\033[38;2;128;140;158m'
ACCENT='\033[38;2;234;199;130m'
BASE_RAW=$(printf '%b' "$BASE")
ACCENT_RAW=$(printf '%b' "$ACCENT")
SEP="${BASE} · ${RESET}"
KEY="${BASE}"
VAL="${ACCENT}"
RULE_COLOR='\033[38;2;64;72;88m'   # thin divider rule

# Helper: value colour — accent normally, hard red at ≥80%
pct_color() {
  local pct=$1
  if [ "$pct" -ge 80 ] 2>/dev/null; then
    printf '%b' "$BOLD_RED"
  else
    printf '%b' "$ACCENT"
  fi
}

# Helper: compact countdown to a future epoch — 1h20m / 42m / now
fmt_countdown() {
  local d=$(( $1 - $(date +%s) ))
  if   [ "$d" -le 0 ];     then printf 'now'
  elif [ "$d" -lt 3600 ];  then printf '%dm' "$(( d / 60 ))"
  elif [ "$d" -lt 86400 ]; then printf '%dh%dm' "$(( d / 3600 ))" "$(( (d % 3600) / 60 ))"
  else                          printf '%dd' "$(( d / 86400 ))"
  fi
}

# Helper: join args with the standard separator (returns via stdout, no trailing newline)
join_sep() {
  local out="" p
  for p in "$@"; do
    if [ -z "$out" ]; then out="$p"; else out="${out}${SEP}${p}"; fi
  done
  printf '%s' "$out"
}

# Helper: visible width of an ANSI string — normalize escapes then strip SGR. CJK is
# counted as 1 (a fair approximation for right-aligning the mostly-ASCII segment rows).
vwidth() {
  local s; printf -v s '%b' "$1"
  s=${s//$'\e'\[*([0-9;])m/}
  printf '%s' "${#s}"
}

# Helper: compose one segment row from a left group + a right group, padded apart to
# fill $COLS. An empty right group prints the left group as-is (legacy left-align).
emit_row() {   # $1=left (joined), $2=right (joined)
  local l r lw rw gap
  printf -v l '%b' "$1"
  printf -v r '%b' "$2"
  if [ -z "$r" ]; then printf '%s' "$l"; return; fi
  lw=$(vwidth "$1"); rw=$(vwidth "$2")
  if [ -z "$l" ]; then gap=$(( COLS - rw )); else gap=$(( COLS - lw - rw )); fi
  [ "$gap" -lt 1 ] && gap=1
  printf '%s%*s%s' "$l" "$gap" "" "$r"
}
