#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Rebuild the creatures component's sprite store from PokeAPI's Black/White
animated GIFs.

Provenance & licence
--------------------
Source: https://github.com/PokeAPI/sprites — sprites/pokemon/versions/
generation-v/black-white/animated/<dex>.gif . These are the Pokémon Black & White
(Nintendo DS, Gen 5) in-game animated battle sprites — genuine native pixel art
with tiny hard-edged palettes (6–24 colours each). The repo dedicates its files
under CC0 1.0 (LICENCE.txt); the underlying artwork remains © The Pokémon Company,
so this is fan/encyclopedic use like any Pokémon sprite source.

Why this script exists
----------------------
The previous sprite store was built from the same family of GIFs but downscaled
with an anti-aliasing resampler, which exploded each sprite to 1000–3500 colours
and muddied the pixels once folded into octant/quadrant cells. The fix is purely
in the conversion: crop to the union bounding box, then downscale with
NEAREST-neighbour so the native palette survives. Result: 6–24 colours/sprite,
crisp hard edges, ~80% smaller store.

Coverage = Gen 1–5 (native) plus Gen 7–8 (Smogon BW-style community sprites
mirrored by PokeAPI). Gen 6 (650–721) and Gen 9 (906+) have no 2D sprite in any
game — the mainline went 3D from X/Y onward — so they are absent by nature, not
by omission.

Output: assets/<dex>.json.gz = {"w","h","frames":[[packed-RGB-int rows]]} where
each pixel is (r<<16)|(g<<8)|b and -1 means transparent; plus assets/index.json.
Re-run to refresh the store; network + Pillow required (dev-time only — the
component itself ships the generated assets and never hits the network).
"""
from __future__ import annotations

import gzip
import io
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageSequence

ASSETS = Path(__file__).resolve().parent.parent / "components" / "creatures" / "assets"
RAW = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{}.gif"

MAXH = 36         # canvas is 10 cells x 4 sub-rows = 40; the grass strip takes 4 -> sprite <= 36 tall
NFRAMES = 8       # frames kept per sprite (one shown per status-line tick)
WORKERS = 16


def union_bbox(frames):
    box = None
    for f in frames:
        b = f.getbbox()
        if b is None:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
    return box


def sample(frames, n):
    """Evenly subsample a long idle loop down to n keyframes (endpoints included)."""
    if len(frames) <= n:
        return frames
    return [frames[round(i * (len(frames) - 1) / (n - 1))] for i in range(n)]


def build(dex: int):
    raw = urllib.request.urlopen(RAW.format(dex), timeout=30).read()
    im = Image.open(io.BytesIO(raw))
    frames = [f.convert("RGBA") for f in ImageSequence.Iterator(im)]
    box = union_bbox(frames)
    if box is None:
        raise ValueError("all-transparent sprite")
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    if h > MAXH:                                   # nearest-neighbour keeps the hard pixel edges
        nw = max(1, round(w * MAXH / h))
        frames = [f.resize((nw, MAXH), Image.NEAREST) for f in frames]
    box2 = union_bbox(frames)                      # resize can leave empty rows/cols — recrop
    frames = [f.crop(box2) for f in frames]
    frames = sample(frames, NFRAMES)
    w, h = frames[0].size
    out_frames = []
    for f in frames:
        px = f.load()
        rows = []
        for y in range(h):
            row = []
            for x in range(w):
                r, g, b, a = px[x, y]
                row.append(-1 if a == 0 else (r << 16) | (g << 8) | b)
            rows.append(row)
        out_frames.append(rows)
    return {"w": w, "h": h, "frames": out_frames}


def main() -> int:
    index = json.loads((ASSETS / "index.json").read_text())
    dex_list = [c["k"] for c in index["creatures"]]

    built, failed = [], []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(build, d): d for d in dex_list}
        for fu in as_completed(futs):
            d = futs[fu]
            try:
                sp = fu.result()
            except Exception as e:                 # noqa: BLE001 — report and skip, never abort the batch
                failed.append((d, str(e)))
                continue
            with gzip.open(ASSETS / f"{d}.json.gz", "wt") as fh:
                json.dump(sp, fh, separators=(",", ":"))
            built.append(d)

    built.sort()
    (ASSETS / "index.json").write_text(json.dumps(
        {"sx": index["sx"], "sy": index["sy"], "creatures": [{"k": k} for k in built]},
        separators=(",", ":")))
    print(f"built {len(built)}/{len(dex_list)}, failed {len(failed)}")
    if failed:
        print("failures:", failed[:20])
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
