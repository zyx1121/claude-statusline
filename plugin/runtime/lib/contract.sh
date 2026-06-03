#!/usr/bin/env bash
# statusline/lib/contract.sh — host↔component invocation contract, sourced by the loader.
#
# Two component kinds (component.json .type):
#   segment — defines a shell fn `render__<id>` in render.sh; host SOURCEs it and calls
#             it IN-PROCESS (zero fork). Reads CC_* env (projected stdin) + cfg JSON ($1),
#             returns its string via $REPLY ("" => hidden).
#   line    — a standalone script; host FORKS it as `<runtime> render <cols>
#             --session <sid> [cfg flags]`, stdout is the line(s). Honours render.ttl.
#
# Components are resolved across a two-layer search path: the user layer
# ($USER_COMPONENTS, personal + installed) first, then plugin built-ins
# ($PLUGIN_COMPONENTS). State/cache live outside any git tree under $STATE.

# extract_stdin_fields — one jq pass projecting the CC stdin JSON into CC_* env.
# Emits `export CC_X='...'` lines (jq @sh quotes values safely); loader evals them.
# This IS the stdin-projection security boundary: components see only these fields.
extract_stdin_fields() {   # stdin = CC JSON
  jq -r '
    "export CC_MODEL=\(.model.display_name // "" | @sh)",
    "export CC_CTX_PCT=\(.context_window.used_percentage // "" | @sh)",
    "export CC_FIVE_PCT=\(.rate_limits.five_hour.used_percentage // "" | @sh)",
    "export CC_FIVE_RESET=\(.rate_limits.five_hour.resets_at // "" | @sh)",
    "export CC_WEEK_PCT=\(.rate_limits.seven_day.used_percentage // "" | @sh)",
    "export CC_WEEK_RESET=\(.rate_limits.seven_day.resets_at // "" | @sh)",
    "export CC_COST=\(.cost.total_cost_usd // "" | @sh)",
    "export CC_PR_NUM=\(.pr.number // "" | @sh)",
    "export CC_PR_STATE=\(.pr.review_state // "" | @sh)",
    "export CC_SID=\(.session_id // "" | @sh)",
    "export CC_PROJECT_DIR=\((.workspace.project_dir // .workspace.current_dir // .cwd) // "" | @sh)"
  ' 2>/dev/null
}

# profile_iter — flatten a profile's components[] into TSV rows, sorted by order.
# Emits: id \t slot \t order \t cfg(compact JSON) \t align(left|right) \t ttl(0=unset).
# Loader buckets by slot, segments into a left/right group by align, and passes ttl to the
# renderer as a per-instance output-cache override (see render_segment/render_widget).
profile_iter() {   # $1 = profile.json
  jq -r '.components | sort_by(.order // 0)[] |
    [.id, .slot, ((.order // 0) | tostring), ((.config // {}) | tojson), (.align // "left"), ((.ttl // 0) | tostring)] | @tsv' "$1" 2>/dev/null
}

# cfg_to_flags — turn a config object into `--key value` CLI flags (scalars only).
# Arrays/objects are ignored; widgets that need list config read their config file.
cfg_to_flags() {   # $1 = cfg JSON
  case "$1" in ""|"null"|"{}") return 0;; esac
  printf '%s' "$1" | jq -r '
    to_entries[]
    | (.value | type) as $t
    | select($t == "string" or $t == "number" or $t == "boolean")
    | "--\(.key) \(.value)"' 2>/dev/null | tr '\n' ' '
}

# find_component — first existing component dir across the search path (user → plugin).
find_component() {   # $1=id → prints dir path; empty if not found anywhere
  if   [ -d "${USER_COMPONENTS}/$1" ];   then printf '%s' "${USER_COMPONENTS}/$1"
  elif [ -d "${PLUGIN_COMPONENTS}/$1" ]; then printf '%s' "${PLUGIN_COMPONENTS}/$1"
  fi
}

# --- output-cache primitives (shared by render_segment + render_widget) -----------------
# _mtime — file mtime as epoch seconds, portable across BSD (macOS) and GNU (Linux). The
# mtime flag differs by platform, and a `stat -f %m || stat -c %Y` fallback is NOT safe:
# on GNU coreutils `stat -f %m` means --file-system and prints a filesystem-info block to
# STDOUT *and* exits non-zero, so the two outputs concatenate and the guard zeroes it →
# cache silently never hits on Linux. Instead pick the right invocation once from $OSTYPE
# (a bash builtin, no fork); the numeric guard stays as a backstop. Verified on macOS (BSD
# stat) and PVE Linux (GNU coreutils 9.7).
case "$OSTYPE" in darwin*) _STAT_MTIME='stat -f %m';; *) _STAT_MTIME='stat -c %Y';; esac
_mtime() {   # $1=path → epoch seconds, 0 if missing/unreadable/non-numeric
  local m; m=$($_STAT_MTIME "$1" 2>/dev/null)
  case "$m" in ''|*[!0-9]*) m=0;; esac
  printf '%s' "$m"
}

# _cache_read — print the cached line and return 0 on a fresh hit (file non-empty AND
# younger than ttl), else return 1. Uses the `$(<file)` builtin — no `cat` fork.
_cache_read() {   # $1=rc $2=ttl
  [ -s "$1" ] || return 1
  [ "$(( $(date +%s) - $(_mtime "$1") ))" -lt "$2" ] || return 1
  printf '%s' "$(<"$1")"
}

# _cache_write — atomically store non-empty content via tmp+rename. tmp+rename keeps a
# concurrent reader (overlapping renders of one session share the file) from seeing a
# torn/empty write; skipping empties keeps a transient failure from being frozen for ttl.
_cache_write() {   # $1=rc $2=content
  [ -n "$2" ] || return 0
  local tmp="$1.$$.tmp"
  printf '%s' "$2" > "$tmp" 2>/dev/null && mv -f "$tmp" "$1" 2>/dev/null
}

# render_segment — source the component's render.sh (once) and call its fn in-process.
# ttl>1 (profile per-instance override) reuses an output-cache for ttl seconds instead of
# recomputing — same scheme as render_widget, meant for segments that fork pricey externals
# (git/gh/osascript). ttl<=1 stays zero-fork: the cache path is skipped entirely so cheap
# string-only segments pay no file IO. Cache key includes order so repeated ids (e.g. two
# ratelimit instances) don't clobber each other's cache.
render_segment() {   # $1=id $2=cfg $3=ttl $4=sid $5=order
  local ttl="${3:-0}" rc=""
  if [ "$ttl" -gt 1 ] 2>/dev/null; then
    local sdir="${STATE}/$1"; mkdir -p "$sdir" 2>/dev/null
    rc="${sdir}/.render.${4}.${5}"
    _cache_read "$rc" "$ttl" && return
  fi
  local fn="render__$1" dir
  if ! declare -F "$fn" >/dev/null 2>&1; then
    dir=$(find_component "$1")
    # shellcheck disable=SC1090
    [ -n "$dir" ] && [ -f "${dir}/render.sh" ] && source "${dir}/render.sh"
  fi
  REPLY=""
  declare -F "$fn" >/dev/null 2>&1 && "$fn" "$2"
  [ -n "$rc" ] && _cache_write "$rc" "$REPLY"
  printf '%s' "$REPLY"
}

# render_widget — fork the component's render entry; honour render.ttl output-cache
# (ttl=1 default => fork every tick for smoothest scroll; ttl>1 => reuse cached line).
# A profile per-instance ttl ($5) overrides the manifest default; cache key includes
# order ($6) so repeated ids don't clobber each other.
render_widget() {   # $1=id $2=cfg $3=cols $4=sid $5=ttl_override $6=order
  local dir; dir=$(find_component "$1")
  [ -n "$dir" ] || return 0           # not installed anywhere → stay silent
  local mf="${dir}/component.json"
  [ -f "$mf" ] || return 0
  local entry runtime ttl
  entry=$(jq -r '.render.entry // "render.py"' "$mf" 2>/dev/null)
  runtime=$(jq -r '.runtime // "python3"' "$mf" 2>/dev/null)
  ttl="${5:-0}"; [ "$ttl" -gt 0 ] 2>/dev/null || ttl=$(jq -r '.render.ttl // 1' "$mf" 2>/dev/null)
  local sdir="${STATE}/$1"; mkdir -p "$sdir" 2>/dev/null
  local rc="${sdir}/.render.${4}.${6}"
  if [ "${ttl:-1}" -gt 1 ] 2>/dev/null; then
    _cache_read "$rc" "$ttl" && return
  fi
  local flags out; flags=$(cfg_to_flags "$2")
  # shellcheck disable=SC2086
  out=$(STATUSLINE_STATE="$sdir" STATUSLINE_CONFIG="$dir" "$runtime" "${dir}/${entry}" "$3" --session "$4" $flags 2>/dev/null)
  [ "${ttl:-1}" -gt 1 ] 2>/dev/null && _cache_write "$rc" "$out"
  printf '%s' "$out"
}
