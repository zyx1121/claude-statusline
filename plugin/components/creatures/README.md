# creatures

A line widget — a tiny world of Seer creatures pacing back and forth across the status line. Pure local animation, no network.

## What it shows

A multi-row (10 rows by default) stage drawn with quadrant blocks — each cell's 2×4 sub-pixel grid is folded to a 2×2 block from the U+2580–259F Block Elements range (two colours per cell), so it renders in any terminal, including ones that don't custom-draw the Legacy-Computing octant glyphs (e.g. Terminal.app). Each status-line refresh is one tick: creatures pace left and right, turn around when they hit an edge or each other (never overlapping), live for a while, then vanish and let others appear. A few share the strip at once. Species are drawn from the full dex (species 1–500), loaded lazily — each tick reads only the few creatures currently on screen. There is also a permanent resident (132 = Ditto by default, never expires) and, when `ground="grass"`, a solid green grass band the creatures stand on. The output may span any number of rows (unlike a segment, which returns a single string).

## Data sources

- `STATUSLINE_CONFIG/assets/` — the sprite store: `index.json` (dex index + sx/sy) and `<dex>.json` or `<dex>.json.gz` (per-species sprites, loaded lazily). The loader need not pass `--data`; it defaults here. (`octant.txt` is kept only for the web preview's pixel-decoder; the terminal renderer no longer reads it.)
- `--session <id>`: a per-session world, so each Claude Code session has its own creatures (the state file is named after the session id).
- No stdin `CC_*` fields, no network — all animation state comes from the local state file.

## Config

The loader turns each config scalar into a `--<key> <value>` flag.

| key | type | default | description |
|-----|------|---------|-------------|
| `ground` | string | `grass` | Ground strip style under the creatures. `grass` paints a solid green grass band for the creatures to stand on; any other value = no ground (creatures sit flush at the bottom). |
| `resident` | number | `132` | Dex number of the permanent resident creature, which never expires and keeps pacing. Default 132 (Ditto). |

## Requires

- `python3` (pure stdlib, no third-party packages).

## Safety notes

- `capabilities.network = []`, `exec = false` — no network access, no shelling out.
- Writes only to `$STATE_DIR` (`STATUSLINE_STATE`, outside the git repo): the per-session state file `.statusline-creatures.<safe-session>.state.json`. The session id is filtered through `[^A-Za-z0-9_-]` and truncated to 64 chars before being spliced into the filename, to prevent path traversal.
- Per-session state files idle for more than 3 days are pruned occasionally (~1% chance per tick).
- Sprite assets resolve via `STATUSLINE_CONFIG` (in-repo), falling back to `Path(__file__).parent` when run standalone; state resolves via `STATUSLINE_STATE`, falling back to `~/.claude`.

## Example output

A 10-row quadrant-block animation, each cell carrying a 24-bit foreground/background ANSI colour. A Ditto stands on the grass, other species occasionally wander by, and the scene shifts tick by tick. It's a visual animation that plain text can't faithfully represent — just run it:

```sh
STATUSLINE_STATE=/tmp/creatures STATUSLINE_CONFIG=$PWD \
  python3 render.py 120 --session demo --ground grass --resident 132
```
