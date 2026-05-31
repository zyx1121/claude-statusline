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
# Emits: id \t slot \t order \t cfg(compact JSON). Loader buckets by slot.
profile_iter() {   # $1 = profile.json
  jq -r '.components | sort_by(.order // 0)[] |
    [.id, .slot, ((.order // 0) | tostring), ((.config // {}) | tojson)] | @tsv' "$1" 2>/dev/null
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

# render_segment — source the component's render.sh (once) and call its fn in-process.
render_segment() {   # $1=id $2=cfg
  local fn="render__$1" dir
  if ! declare -F "$fn" >/dev/null 2>&1; then
    dir=$(find_component "$1")
    # shellcheck disable=SC1090
    [ -n "$dir" ] && [ -f "${dir}/render.sh" ] && source "${dir}/render.sh"
  fi
  REPLY=""
  declare -F "$fn" >/dev/null 2>&1 && "$fn" "$2"
  printf '%s' "$REPLY"
}

# render_widget — fork the component's render entry; honour render.ttl output-cache
# (ttl=1 default => fork every tick for smoothest scroll; ttl>1 => reuse cached line).
render_widget() {   # $1=id $2=cfg $3=cols $4=sid
  local dir; dir=$(find_component "$1")
  [ -n "$dir" ] || return 0           # not installed anywhere → stay silent
  local mf="${dir}/component.json"
  [ -f "$mf" ] || return 0
  local entry runtime ttl
  entry=$(jq -r '.render.entry // "render.py"' "$mf" 2>/dev/null)
  runtime=$(jq -r '.runtime // "python3"' "$mf" 2>/dev/null)
  ttl=$(jq -r '.render.ttl // 1' "$mf" 2>/dev/null)
  local sdir="${STATE}/$1"; mkdir -p "$sdir" 2>/dev/null
  local rc="${sdir}/.render.${4}"
  if [ "${ttl:-1}" -gt 1 ] 2>/dev/null && [ -f "$rc" ]; then
    local age=$(( $(date +%s) - $(stat -f %m "$rc" 2>/dev/null || echo 0) ))
    [ "$age" -lt "$ttl" ] && { cat "$rc"; return; }
  fi
  local flags out; flags=$(cfg_to_flags "$2")
  # shellcheck disable=SC2086
  out=$(STATUSLINE_STATE="$sdir" STATUSLINE_CONFIG="$dir" "$runtime" "${dir}/${entry}" "$3" --session "$4" $flags 2>/dev/null)
  [ "${ttl:-1}" -gt 1 ] 2>/dev/null && printf '%s' "$out" > "$rc"
  printf '%s' "$out"
}
