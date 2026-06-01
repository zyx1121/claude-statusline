#!/usr/bin/env bash
# capture-demo.sh — record N frames of the FULL composed status line (a showcase
# profile rendered through the real loader) into plugin/spec/demo.frames.json, so
# the marketplace home page can show a big animated terminal of components
# composed together (news ticker + creatures + segment rows + stock ticker).
#
# Runs the loader in an isolated $HOME so it never touches the user's state or the
# private B-class cache refresher (~/.claude/statusline-cache.sh). Network is used
# once up front to warm the news/stock caches (en-US news, TWSE stocks). Pure
# representative mock stdin drives the segments.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # plugin/
RUNTIME="${HERE}/runtime"
COMP="${HERE}/components"
COLS=96
FRAMES=16
SID="demo"
OUT="${HERE}/spec/demo.frames.json"

tmp="$(mktemp -d)"
export HOME="$tmp"          # isolate loader STATE; skips the user's statusline-cache.sh
ST="$HOME/.claude/.statusline-state"
mkdir -p "$ST/news" "$ST/stock-ticker"

# Showcase profile: news (en) top · creatures (Ditto + Psyduck) mid · session row ·
# repo row · stock bottom. No pve/utils (those are private user-layer components).
prof="$tmp/demo.json"
cat > "$prof" <<'JSON'
{ "$schema": "statusline/profile@1", "name": "demo", "rule": true, "components": [
  {"id":"news","slot":"top","order":10,"config":{"lang":"en-US","topics":"top,world,technology"}},
  {"id":"creatures","slot":"middle","order":10,"config":{"ground":"grass","resident":"132,54"}},
  {"id":"model","slot":"row1","order":10},
  {"id":"ctx","slot":"row1","order":20},
  {"id":"ratelimit","slot":"row1","order":30,"config":{"window":"5h"}},
  {"id":"ratelimit","slot":"row1","order":31,"config":{"window":"7d"}},
  {"id":"cost","slot":"row1","order":40},
  {"id":"git","slot":"row2","order":10},
  {"id":"pr","slot":"row2","order":20},
  {"id":"stock-ticker","slot":"bottom","order":10}
]}
JSON

# Warm the network widgets into the isolated state (en news + TWSE stocks).
STATUSLINE_STATE="$ST/news" STATUSLINE_CONFIG="$COMP/news" \
  python3 "$COMP/news/render.py" --fetch --lang en-US --topics "top,world,technology" >/dev/null 2>&1
STATUSLINE_STATE="$ST/stock-ticker" STATUSLINE_CONFIG="$COMP/stock-ticker" \
  python3 "$COMP/stock-ticker/render.py" --fetch >/dev/null 2>&1

# Representative mock stdin — epoch resets_at (clean countdown), a real git repo, a PR.
now=$(date +%s)
cat > "$tmp/stdin.json" <<JSON
{"model":{"display_name":"Opus 4.8 (1M context)"},"session_id":"$SID",
 "context_window":{"used_percentage":42},
 "rate_limits":{"five_hour":{"used_percentage":22,"resets_at":$((now+8200))},
                "seven_day":{"used_percentage":38,"resets_at":$((now+360000))}},
 "cost":{"total_cost_usd":12.40},
 "pr":{"number":7,"review_state":"approved"},
 "workspace":{"project_dir":"$(cd "$HERE/.." && pwd)"}}
JSON

run() {
  COLUMNS="$COLS" STATUSLINE_PLUGIN_ROOT="$HERE" STATUSLINE_PROFILE="$prof" \
    bash "$RUNTIME/loader.sh" < "$tmp/stdin.json" 2>/dev/null
}

for _ in 1 2 3 4 5; do run >/dev/null; done          # warm per-session widget state
for i in $(seq 1 "$FRAMES"); do run > "$tmp/f.$i"; done

python3 - "$tmp" "$FRAMES" "$COLS" "$OUT" <<'PY'
import json, sys
tmp, n, cols, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
frames = []
for i in range(1, n + 1):
    s = open(f"{tmp}/f.{i}", encoding="utf-8").read().rstrip("\n")
    if s.strip():
        frames.append(s)
json.dump({"cols": cols, "frames": frames}, open(out, "w"), ensure_ascii=False)
print(f"wrote {out}: {len(frames)} frames, {len(set(frames))} distinct, "
      f"{len(frames[0].splitlines()) if frames else 0} lines/frame")
PY
rm -rf "$tmp"
