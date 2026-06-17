#!/usr/bin/env python3
"""statusline-creatures — a tiny Seer-creature world that walks across the status line.

Each status-line refresh is one tick. Creatures are objects in a single state
file: they pace left/right, turn around at the edges and at each other (never
overlapping), live for a while, then vanish and let others appear. Several can
share the strip at once. Species are drawn from the full Seer dex (种类 1-500),
loaded lazily — only the few creatures currently on screen are read per tick.

Rendered at full 2×4 sub-pixel resolution with octant blocks (Unicode 16 Legacy
Computing, U+1CD00…) by default — one glyph per cell carrying two colours (fg/bg),
its eight sub-pixels each an eighth of the cell. This needs a terminal that
custom-draws those glyphs (Ghostty, kitty, WezTerm, recent iTerm2/foot). Pass
--blocks quadrant to instead fold each cell to a 2×2 U+2580–259F Block Element —
half the vertical detail, but renders in any monospace font (e.g. Terminal.app).
Pure stdlib.

Usage: render.py <cols> [--session ID] [--ground STYLE] [--resident DEX[,DEX...]] [--blocks octant|quadrant] [--state PATH] [--data DIR]
Paths default to the loader-provided STATUSLINE_STATE (state) and STATUSLINE_CONFIG/assets (sprites).
"""
from __future__ import annotations

import gzip
import json
import os
import random
import re
import sys
import time
from pathlib import Path

# Sprite assets live in the component dir (in-repo); state lives in the loader-provided
# per-component dir (outside the git repo). Both fall back to legacy paths standalone.
CONFIG_DIR = Path(os.environ.get("STATUSLINE_CONFIG") or Path(__file__).resolve().parent)
DEFAULT_DATA = CONFIG_DIR / "assets"
STATE_DIR = Path(os.environ.get("STATUSLINE_STATE") or (Path.home() / ".claude"))
DEFAULT_STATE = STATE_DIR / ".statusline-creatures.state.json"
SESSION_TTL_DAYS = 3          # prune per-session state files idle longer than this


def state_path_for(session: str | None) -> Path:
    """Per-session world so each Claude Code session has its own creatures."""
    if not session:
        return DEFAULT_STATE
    safe = re.sub(r"[^A-Za-z0-9_-]", "", session)[:64] or "x"
    return STATE_DIR / f".statusline-creatures.{safe}.state.json"


def prune_sessions():
    cutoff = time.time() - SESSION_TTL_DAYS * 86400
    for f in STATE_DIR.glob(".statusline-creatures.*.state.json"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
        except OSError:
            pass

RENDER_ROWS = 10              # fixed canvas height in cells (matches the sprite converter's cap)
GRASS_PX = 4                  # height of the grass strip the creatures stand on
# A single calm green grass band (TIP highlight, MID blade body, DARK soil line).
# No time-of-day cycling and no gaps — the creatures always stand on solid green.
GRASS_PALETTE = ((122, 198, 98), (74, 156, 70), (46, 110, 54))
TTL_MIN, TTL_MAX = 35, 130
SPAWN_PROB = 0.18
MOVE_PROB = 0.7
TURN_PROB = 0.06
BLINK_TAIL = 5
SOLID_THRESH = 36
SHINY_PROB = 0.03             # chance a freshly spawned (non-resident) creature is shiny
MORPH_PROB = 0.0              # disabled — resident Ditto keeps its own sprite (no mimicry)
UNMORPH_PROB = 0.03           # (unused while MORPH_PROB = 0) chance/tick it reverts to itself


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def load_sprite_file(path_noext: Path):
    """Load <name>.json, or gzipped <name>.json.gz (animated pokemon store)."""
    p = path_noext.with_name(path_noext.name + ".json")
    if p.is_file():
        return load_json(p, None)
    gz = path_noext.with_name(path_noext.name + ".json.gz")
    if gz.is_file():
        try:
            with gzip.open(gz, "rt", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    return None


class World:
    """Holds the dex index; loads individual sprites on demand."""

    def __init__(self, data_dir: Path):
        self.dir = data_dir
        idx = load_json(data_dir / "index.json", {"sx": 2, "sy": 4, "creatures": []})
        self.sx, self.sy = idx.get("sx", 2), idx.get("sy", 4)
        self.species = [c["k"] for c in idx.get("creatures", [])]
        self._cache: dict[int, dict | None] = {}

    def sprite(self, k: int):
        if k not in self._cache:
            self._cache[k] = load_sprite_file(self.dir / str(k))
        return self._cache[k]

    def cellw(self, k: int) -> int:
        sp = self.sprite(k)
        return (sp["w"] + self.sx - 1) // self.sx if sp else 1


def _eff(c) -> int:
    """Effective species — a morphed resident Ditto borrows its neighbour's sprite."""
    return c.get("morph") or c["sp"]


def overlaps(x, w_cells, others, world, skip=None) -> bool:
    hi = x + w_cells
    for o in others:
        if o is skip:
            continue
        o_lo = o["x"]
        o_hi = o_lo + world.cellw(_eff(o))
        if x < o_hi and o_lo < hi:
            return True
    return False


def tick(state, world, cols, rng, residents=None):
    creatures = state.get("creatures", [])
    state["tick"] = state.get("tick", 0) + 1
    cap = max(1, min(3, cols // 45))

    # permanent residents (e.g. Ditto, Psyduck) — always present, never expire, keep
    # pacing. One per listed dex; spawn any that aren't on screen yet at a free spot.
    on_screen = {c["sp"] for c in creatures if c.get("resident")}
    for rdex in (residents or []):
        if rdex in on_screen or not world.sprite(rdex):
            continue
        w = world.cellw(rdex)
        if w > cols:
            continue
        for _ in range(8):
            x = rng.randint(0, cols - w)
            if not overlaps(x, w, creatures, world):
                creatures.append({"sp": rdex, "x": x, "dir": rng.choice((-1, 1)),
                                  "age": 0, "ttl": 1 << 30, "resident": True})
                on_screen.add(rdex)
                break

    # a resident Ditto mimics a neighbour now and then (its signature trick)
    res = next((c for c in creatures if c.get("resident") and c["sp"] == 132), None)
    if res is not None:
        others = [c for c in creatures if not c.get("resident")]
        if "morph" not in res and others and rng.random() < MORPH_PROB:
            res["morph"] = rng.choice(others)["sp"]
        elif "morph" in res and (not others or rng.random() < UNMORPH_PROB):
            del res["morph"]

    if len(creatures) < cap and rng.random() < SPAWN_PROB and world.species:
        k = rng.choice(world.species)
        sp = world.sprite(k)
        if sp:
            w = world.cellw(k)
            if w <= cols:
                # appear at a random free spot facing a random way (not just the edges)
                for _ in range(6):
                    x = rng.randint(0, cols - w)
                    if not overlaps(x, w, creatures, world):
                        creatures.append({"sp": k, "x": x, "dir": rng.choice((-1, 1)),
                                          "age": 0, "ttl": rng.randint(TTL_MIN, TTL_MAX),
                                          "shiny": rng.random() < SHINY_PROB})
                        break

    for c in creatures:
        c["age"] += 1
        if rng.random() < TURN_PROB:
            c["dir"] *= -1
        if rng.random() < MOVE_PROB:
            w = world.cellw(_eff(c))
            nx = c["x"] + c["dir"]
            if nx < 0 or nx + w > cols or overlaps(nx, w, creatures, world, skip=c):
                c["dir"] *= -1
            else:
                c["x"] = nx

    state["creatures"] = [c for c in creatures if c.get("resident") or c["age"] < c["ttl"]]
    return state


def _paint_grass(canvas, H, W):
    """A solid green grass band the creatures stand on — uniform, no gaps: a
    lighter blade-tip highlight on top, a mid-green body, and a darker soil line
    at the bottom. Every cell is painted so the status bar never shows through."""
    TIP, MID, DARK = GRASS_PALETTE
    top = H - GRASS_PX
    for x in range(W):
        for r in range(GRASS_PX):
            y = top + r
            canvas[y][x] = TIP if r == 0 else DARK if r == GRASS_PX - 1 else MID


def build_canvas(state, world, cols, ground=None):
    """Composite live creatures onto a sub-pixel canvas (sx×sy per cell, bottom-aligned)."""
    sx, sy = world.sx, world.sy
    H, W = RENDER_ROWS * sy, cols * sx
    canvas = [[None] * W for _ in range(H)]
    grass = ground == "grass"
    floor = H - GRASS_PX if grass else H     # creatures stand on top of the grass strip
    tick = state.get("tick", 0)
    for c in sorted(state.get("creatures", []), key=lambda c: c["x"]):
        sp = world.sprite(_eff(c))
        if not sp:
            continue
        left = c["ttl"] - c["age"]
        if left <= BLINK_TAIL and (tick + c["x"]) % 2 == 0:
            continue
        w, h = sp["w"], sp["h"]
        frames = sp.get("frames")    # animated sprites cycle one frame per tick
        rows = frames[tick % len(frames)] if frames else sp.get("rows")
        if rows is None:
            continue
        flip = c["dir"] > 0          # default-facing sprite → mirror when walking right
        shiny = c.get("shiny")
        x0, y0 = c["x"] * sx, floor - h
        for yy in range(h):
            if not 0 <= y0 + yy < H:
                continue
            crow, srow = canvas[y0 + yy], rows[yy]
            for xx in range(w):
                v = srow[w - 1 - xx] if flip else srow[xx]
                if v < 0:
                    continue
                cx = x0 + xx
                if 0 <= cx < W:
                    crow[cx] = ((v & 255, (v >> 8) & 255, v >> 16) if shiny   # shiny: swap R↔B
                                else (v >> 16, (v >> 8) & 255, v & 255))
        if shiny and (tick + c["x"]) % 4 < 2:        # twinkle a sparkle by the head
            canvas[max(0, y0 - 1)][min(W - 1, x0 + w)] = (255, 250, 210)
    if grass:
        _paint_grass(canvas, H, W)   # solid green band below; creatures stand on it
    return canvas


def _avg(colors):
    n = len(colors)
    return [sum(c[i] for c in colors) // n for i in range(3)]


def _dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def fold_cell(sub):
    """sub = sub-pixels in bit order (bit i = 1<<i) → (pattern, fg, bg|None)."""
    opaque = [(i, c) for i, c in enumerate(sub) if c is not None]
    if not opaque:
        return 0, None, None
    if len(opaque) < len(sub):
        return sum(1 << i for i, _ in opaque), _avg([c for _, c in opaque]), None
    cols = sub
    bi, bj, bd = 0, 1, -1
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            d = _dist(cols[i], cols[j])
            if d > bd:
                bi, bj, bd = i, j, d
    if bd < SOLID_THRESH:
        return (1 << len(cols)) - 1, _avg(cols), None
    si, sj = cols[bi], cols[bj]
    pat, ga, gb = 0, [], []
    for k, c in enumerate(cols):
        if _dist(c, si) <= _dist(c, sj):
            pat |= 1 << k
            ga.append(c)
        else:
            gb.append(c)
    return pat, _avg(ga), (_avg(gb) if gb else None)


# 2×2 quadrant block elements (U+2580–259F), indexed by a 4-bit pattern:
# bit0=upper-left, bit1=upper-right, bit2=lower-left, bit3=lower-right. This is
# the Block Elements range every monospace font ships, so it renders anywhere —
# unlike the 2×4 octant glyphs (Legacy Computing, plane 1) that need the terminal
# to custom-draw them.
QUADRANT = " ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█"


def _merge2(a, b):
    """Average two vertically-stacked sub-pixels into one quadrant sub-pixel."""
    if a is None:
        return b
    if b is None:
        return a
    return ((a[0] + b[0]) // 2, (a[1] + b[1]) // 2, (a[2] + b[2]) // 2)


def fold_quadrant(sub):
    """Fold a 2×4 (sx×sy, row-major) sub-pixel cell to a 2×2 quadrant — pair
    rows (0,1) and (2,3), then reuse fold_cell's two-colour split (≤4 points)."""
    quad = [_merge2(sub[0], sub[2]),   # upper-left  ← (r0,c0)+(r1,c0)
            _merge2(sub[1], sub[3]),   # upper-right ← (r0,c1)+(r1,c1)
            _merge2(sub[4], sub[6]),   # lower-left  ← (r2,c0)+(r3,c0)
            _merge2(sub[5], sub[7])]   # lower-right ← (r2,c1)+(r3,c1)
    return fold_cell(quad)


# 2×4 octant blocks: 256 glyphs indexed by the 8-bit sub-pixel pattern (bit i ↔
# row i>>1, col i&1 — exactly the order fold_cell emits). Most live in Unicode 16's
# Legacy Computing Supplement (U+1CD00…, plane 1), so the terminal must custom-draw
# them; the table is shared verbatim with the web pixel-decoder (assets/octant.txt).
# Loaded lazily and cached so the quadrant path pays no IO.
_OCTANT = []


def load_octant(data_dir: Path):
    """Return the 256-char octant glyph table, or None if missing/malformed
    (caller then falls back to the quadrant blocks)."""
    if _OCTANT:
        return _OCTANT[0]
    try:
        line = (data_dir / "octant.txt").read_text(encoding="utf-8").splitlines()[0]
    except (OSError, IndexError):
        return None
    if len(line) != 256:
        return None
    _OCTANT.append(line)
    return line


def render(state, world, cols, ground=None, blocks="octant"):
    if not world.species:
        return ""
    sx, sy = world.sx, world.sy
    canvas = build_canvas(state, world, cols, ground)
    R = len(canvas) // sy
    # octant needs both the 256-glyph table and a 2×4 cell; else fall back to quadrant.
    octant = load_octant(world.dir) if blocks == "octant" and (sx, sy) == (2, 4) else None
    out = []
    for cr in range(R):
        brows = [canvas[cr * sy + r] for r in range(sy)]
        line = []
        for cc in range(cols):
            x = cc * sx
            sub = [brows[r][x + c] for r in range(sy) for c in range(sx)]
            if octant is not None:
                pat, fg, bg = fold_cell(sub)
                glyph = octant[pat]
            else:
                pat, fg, bg = fold_quadrant(sub)
                glyph = QUADRANT[pat]
            if pat == 0:
                line.append("\033[0m ")
            elif bg is None:
                line.append(f"\033[49;38;2;{fg[0]};{fg[1]};{fg[2]}m{glyph}")
            else:
                line.append(f"\033[38;2;{fg[0]};{fg[1]};{fg[2]};48;2;{bg[0]};{bg[1]};{bg[2]}m{glyph}")
        line.append("\033[0m")
        out.append("".join(line))
    return "\n".join(out)


def main() -> int:
    args = sys.argv[1:]
    data_dir, state_path, cols, session, ground, residents, blocks = DEFAULT_DATA, None, 80, None, None, [], "octant"
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--state":
            state_path = Path(args[i + 1]); i += 2
        elif a == "--data":
            data_dir = Path(args[i + 1]); i += 2
        elif a == "--session":
            session = args[i + 1] or None; i += 2
        elif a == "--ground":
            ground = args[i + 1] if i + 1 < len(args) else None; i += 2
        elif a == "--resident":
            # comma-separated dex numbers → one permanent resident each (e.g. "132,54")
            if i + 1 < len(args):
                residents = [int(p) for p in args[i + 1].split(",") if p.strip().isdigit()]
            i += 2
        elif a == "--blocks":
            # "octant" (default, full 2×4 detail; needs a custom-draw terminal) or
            # "quadrant" (2×2 fold; renders in any monospace font).
            blocks = args[i + 1] if i + 1 < len(args) else "octant"; i += 2
        else:
            try:
                cols = int(a)
            except ValueError:
                pass
            i += 1
    if state_path is None:
        state_path = state_path_for(session)

    world = World(data_dir)
    state = load_json(state_path, {"tick": 0, "creatures": []})
    rng = random.Random()
    if rng.random() < 0.01:                       # occasional cleanup of idle sessions
        prune_sessions()

    state = tick(state, world, max(1, cols), rng, residents)
    try:
        state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass

    sys.stdout.write(render(state, world, max(1, cols), ground, blocks))
    return 0


if __name__ == "__main__":
    sys.exit(main())
