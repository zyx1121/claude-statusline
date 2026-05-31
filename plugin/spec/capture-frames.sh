#!/usr/bin/env bash
# capture-frames.sh — record N successive render frames for each LINE widget into
# the component dir as frames.json (a JSON array of raw-ANSI strings, fg+bg codes
# intact). The web cycles these ~1/s so the marketplace animates exactly like the
# terminal. Each render tick advances the widget's per-session state, so running it
# N times against one fresh state dir yields N successive frames. Segments are
# static (no frames file).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # plugin/
COMP="${HERE}/components"
COLS=72
FRAMES=16

for dir in "$COMP"/*/; do
  id=$(basename "$dir")
  mf="${dir}component.json"
  [ -f "$mf" ] || continue
  [ "$(jq -r '.type' "$mf")" = "line" ] || continue
  entry=$(jq -r '.render.entry // "render.py"' "$mf")
  runtime=$(jq -r '.runtime // "python3"' "$mf")
  flags=()
  case "$id" in creatures) flags=(--ground grass --resident 132);; esac

  st=$(mktemp -d)
  for _ in 1 2 3 4; do
    STATUSLINE_STATE="$st" STATUSLINE_CONFIG="$dir" "$runtime" "${dir}${entry}" "$COLS" --session cap "${flags[@]}" >/dev/null 2>&1
  done
  python3 - "$st" "$dir" "$entry" "$runtime" "$COLS" "$FRAMES" "${flags[@]}" <<'PY'
import json, os, subprocess, sys
st, dirp, entry, runtime, cols, n, *flags = sys.argv[1:]
frames, env = [], {**os.environ, "STATUSLINE_STATE": st, "STATUSLINE_CONFIG": dirp}
for _ in range(int(n)):
    out = subprocess.run([runtime, dirp + entry, cols, "--session", "cap", *flags],
                         capture_output=True, text=True, env=env).stdout
    if out.strip():
        frames.append(out.rstrip("\n"))
open(dirp + "frames.json", "w", encoding="utf-8").write(json.dumps(frames, ensure_ascii=False))
print(f"  {os.path.basename(dirp.rstrip('/'))}: {len(frames)} frames, "
      f"{len(set(frames))} distinct")
PY
  rm -rf "$st"
done
