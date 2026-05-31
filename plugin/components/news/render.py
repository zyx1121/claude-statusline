#!/usr/bin/env python3
"""statusline-news — a right-scrolling news ticker line for the status line.

Two modes:
  render  (default)  statusline-news.py <cols> --session <id>
      Read the cached headlines, build a per-session running order (seeded by
      session id + cache hour, so it's stable within the hour but differs per
      session and refreshes hourly), and emit ONE line: a CJK-width-aware window
      that scrolls right-to-left one cell per tick. Never blocks on the network — if
      the cache is from an earlier clock hour it fires a detached --fetch and
      renders the current cache meanwhile.
  --fetch            statusline-news.py --fetch
      Pull the configured Google News feeds, normalize titles, dedupe, and write
      the cache. Meant to run ~hourly (triggered by the render path).

Pure stdlib. News source = Google News RSS (keyless); a personal status-line
ticker is the personal feed-reader use its feed <copyright> permits.
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# State/cache live in the loader-provided per-component dir (outside the git repo);
# config (topics) lives in the component dir. Falls back to legacy paths standalone.
STATE_DIR = Path(os.environ.get("STATUSLINE_STATE") or (Path.home() / ".claude"))
CACHE = STATE_DIR / ".statusline-news.cache.json"
LOCK = STATE_DIR / ".statusline-news.lock"
SESSION_TTL_DAYS = 3
SEP = " · "
INK = "\033[38;2;168;178;194m"   # cool light grey — the ticker text colour
FETCH_COOLDOWN = 120          # don't re-spawn a fetch within this many seconds
MAX_HEADLINES = 200

# News source — Google News RSS, en-US. Swap hl/gl/ceid for another locale.
UA = "Mozilla/5.0 (statusline-news; personal feed reader)"
LOCALE = "hl=en-US&gl=US&ceid=US:en"

# Topics are picked in topics.default (one per line; `top` = top stories,
# anything else = a Google News search keyword). Edit that file to choose topics.
TOPICS_FILE = Path(os.environ.get("STATUSLINE_CONFIG") or Path(__file__).resolve().parent) / "topics.default"
DEFAULT_TOPICS = ["top", "world", "technology", "business"]


def _topics() -> list[str]:
    try:
        lines = TOPICS_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return DEFAULT_TOPICS
    topics = [ln.strip() for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
    return topics or DEFAULT_TOPICS


def _feeds(topics: list[str]) -> list[str]:
    urls = []
    for t in topics:
        if t.lower() == "top":
            urls.append(f"https://news.google.com/rss?{LOCALE}")
        else:
            urls.append(f"https://news.google.com/rss/search?q={urllib.parse.quote(f'{t} when:1d')}&{LOCALE}")
    return urls


# ─── shared ──────────────────────────────────────────────────────────────────

def _hour() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H")


def _cw(ch: str) -> int:
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _load_dict(path: Path) -> dict:
    """Read a JSON object, tolerating a torn/corrupt/non-dict file (→ {})."""
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):        # ValueError covers JSONDecodeError + UnicodeDecodeError
        return {}
    return d if isinstance(d, dict) else {}


# ─── fetch ─────────────────────────────────────────────────────────────────

def _clean_title(t: str) -> str:
    t = (t or "").replace("　", " ").strip()
    # Google News appends " - <source>"; drop the last such segment.
    if " - " in t:
        head, _, tail = t.rpartition(" - ")
        if head and len(tail) <= 30:
            t = head.strip()
    return " ".join(t.split())


def fetch() -> int:
    topics = _topics()
    seen, headlines = set(), []
    for url in _feeds(topics):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            data = urllib.request.urlopen(req, timeout=10).read()
            root = ET.fromstring(data)
        except Exception:
            continue
        for it in root.findall(".//item"):
            title = _clean_title(it.findtext("title") or "")
            if len(title) < 6:
                continue
            key = title.lower()
            if key not in seen:
                seen.add(key)
                headlines.append(title)
    if not headlines:
        return 1
    # atomic write (tmp + replace) so a render tick never reads a half-written cache
    tmp = CACHE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(
        {"fetched_at": datetime.now().isoformat(timespec="seconds"),
         "hour": _hour(), "topics": topics, "headlines": headlines[:MAX_HEADLINES]},
        ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, CACHE)
    return 0


def _maybe_refresh(cache: dict):
    """Fire a detached fetch when the cache is stale (new hour or topics changed)."""
    if cache and cache.get("hour") == _hour() and cache.get("topics") == _topics():
        return
    try:
        if LOCK.exists() and time.time() - LOCK.stat().st_mtime < FETCH_COOLDOWN:
            return
        LOCK.write_text(str(time.time()))
    except OSError:
        return
    try:
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "--fetch"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, start_new_session=True)
    except Exception:
        pass


# ─── render ────────────────────────────────────────────────────────────────

def _window(items, total, start, cols) -> str:
    """`cols` display-cells of the ring of (char,width) items, starting at cell `start`."""
    s = start % total
    acc = idx = 0
    for i, (_, w) in enumerate(items):
        if acc + w > s:
            idx, intra = i, s - acc
            break
        acc += w
    out, used, n = [], 0, len(items)
    if intra > 0:                       # started on the 2nd half of a wide glyph
        out.append(" "); used += 1; idx = (idx + 1) % n
    while used < cols:
        ch, w = items[idx]
        if used + w <= cols:
            out.append(ch); used += w
        else:
            out.append(" "); used += 1  # wide glyph would overrun the edge
        idx = (idx + 1) % n
    return "".join(out)


def render(cols: int, session: str | None) -> str:
    blank = INK + " " * cols + "\033[0m"
    cache = _load_dict(CACHE)
    _maybe_refresh(cache)

    headlines = cache.get("headlines")
    if not isinstance(headlines, list) or not headlines:
        return blank

    # per-session running order: stable within the hour, different per session
    rng = random.Random(f"{session or 'x'}|{cache.get('hour', '')}")
    order = [str(h) for h in headlines]
    rng.shuffle(order)
    ring = (SEP.join(order) + SEP)
    items = [(ch, _cw(ch)) for ch in ring]
    total = sum(w for _, w in items) or 1

    # advance per-session offset; right-to-left scroll → window start moves forward
    spath = STATE_DIR / f".statusline-news.{_safe(session)}.state.json"
    st = _load_dict(spath)
    try:
        offset = int(st.get("offset", 0)) + 1
    except (TypeError, ValueError):
        offset = 1
    try:
        spath.write_text(json.dumps({"offset": offset}), encoding="utf-8")
    except OSError:
        pass
    if rng.random() < 0.01:
        _prune()

    win = _window(items, total, offset, cols)
    return f"{INK}{win}\033[0m"


def _safe(session: str | None) -> str:
    import re
    return (re.sub(r"[^A-Za-z0-9_-]", "", session or "")[:64]) or "x"


def _prune():
    cutoff = time.time() - SESSION_TTL_DAYS * 86400
    for f in STATE_DIR.glob(".statusline-news.*.state.json"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
        except OSError:
            pass


def main() -> int:
    args = sys.argv[1:]
    if "--fetch" in args:
        return fetch()
    cols, session = 80, None
    i = 0
    while i < len(args):
        if args[i] == "--session":
            session = args[i + 1] if i + 1 < len(args) else None
            i += 2
        else:
            try:
                cols = int(args[i])
            except ValueError:
                pass
            i += 1
    sys.stdout.write(render(max(1, cols), session))
    return 0


if __name__ == "__main__":
    sys.exit(main())
