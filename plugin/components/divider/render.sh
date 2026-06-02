#!/usr/bin/env bash
# divider — line widget: a full-width horizontal rule. Replaces the old host-drawn
# profile.rule — place it in any line slot (top/middle/bottom) where you want a
# separator. $1 = terminal columns (the host passes it as the first positional arg).
cols="${1:-80}"
case "$cols" in '' | *[!0-9]*) cols=80 ;; esac
printf '\033[38;2;64;72;88m'
printf '─%.0s' $(seq 1 "$cols")
printf '\033[0m'
