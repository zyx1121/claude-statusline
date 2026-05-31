#!/usr/bin/env bash
# nowplaying — current track from Apple Music / Spotify. segment; returns via $REPLY.
# pgrep gate first so osascript (AppleEvents/TCC) never runs / prompts when no player is up.
render__nowplaying() {   # $1 = config JSON (unused)
  local app="" np
  pgrep -x Spotify >/dev/null 2>&1 && app="Spotify"
  [ -z "$app" ] && pgrep -x Music >/dev/null 2>&1 && app="Music"
  [ -n "$app" ] || return 0
  # A literal app name lets the scripting dictionary compile and avoids launching a
  # stopped app (a variable name can't be statically resolved by osascript).
  np=$(osascript \
    -e "tell application \"$app\"" \
    -e 'if player state is playing then return (name of current track) & " — " & (artist of current track)' \
    -e 'end tell' \
    -e 'return ""' 2>/dev/null)
  [ -n "$np" ] || return 0
  np=$(printf '%s' "$np" | cut -c1-44)
  printf -v REPLY "${MAGENTA}♪${RESET} ${KEY}%s${RESET}" "$np"
}
