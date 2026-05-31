#!/usr/bin/env python3
"""statusline-ticker — a left-scrolling Taiwan-stock ticker line for the status bar.

Mirror image of statusline-news: news scrolls right-to-left up top, this scrolls
left-to-right along the bottom. Two modes:

  render  (default)  statusline-ticker.py <cols> --session <id>
      Read the cached quotes, build a colour-tagged ring (Taiwan convention:
      red = up, green = down), and emit ONE CJK-width-aware line scrolling
      left-to-right one cell per tick. Never blocks on the network — when the
      cache is stale it fires a detached --fetch and renders the current cache.
  --fetch            statusline-ticker.py --fetch
      Pull quotes from TWSE (one multi-symbol call) and write the cache.

Pure stdlib. Source: TWSE mis getStockInfo (keyless).
"""
from __future__ import annotations

import json
import os
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

# State/cache live in the loader-provided per-component dir (outside the git repo);
# config (symbols) lives in the component dir. Falls back to legacy paths standalone.
STATE_DIR = Path(os.environ.get("STATUSLINE_STATE") or (Path.home() / ".claude"))
CACHE = STATE_DIR / ".statusline-ticker.cache.json"
LOCK = STATE_DIR / ".statusline-ticker.lock"
SYMBOLS_FILE = Path(os.environ.get("STATUSLINE_CONFIG") or Path(__file__).resolve().parent) / "symbols.default"
DEFAULT_SYMBOLS = ["t00", "0050", "2353", "2382", "3231"]

SEP = " · "
FETCH_COOLDOWN = 60           # seconds between detached fetch spawns
CACHE_TTL = 60                # re-fetch once the cache is older than this
SESSION_TTL_DAYS = 3
UA = "Mozilla/5.0 (statusline-ticker; personal ticker)"

RED = "\033[0;31m"            # TW: up
GREEN = "\033[0;32m"          # TW: down
GREY = "\033[38;2;128;140;158m"
RESET = "\033[0m"


def _cw(ch: str) -> int:
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _load_dict(path: Path) -> dict:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return d if isinstance(d, dict) else {}


def _symbols() -> list[str]:
    try:
        lines = SYMBOLS_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return DEFAULT_SYMBOLS
    syms = [ln.strip() for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
    return syms or DEFAULT_SYMBOLS


# ─── fetch ───────────────────────────────────────────────────────────────────

def _ex_ch(sym: str) -> str:
    if sym == "t00":
        return "tse_t00.tw"
    if sym.startswith("otc:"):
        return f"otc_{sym[4:]}.tw"
    return f"tse_{sym}.tw"


def _f(v):
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def fetch() -> int:
    syms = _symbols()
    ex = "|".join(_ex_ch(s) for s in syms)
    url = (f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp"
           f"?ex_ch={ex}&json=1&delay=0")
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": UA, "Referer": "https://mis.twse.com.tw/stock/"})
        data = json.loads(urllib.request.urlopen(req, timeout=10).read())
    except Exception:
        return 1
    quotes = {m.get("c"): m for m in data.get("msgArray", [])}

    stocks = []
    for s in syms:
        code = "t00" if s == "t00" else s.split(":")[-1]
        m = quotes.get(code)
        if not m:
            continue
        z = _f(m.get("z")) or _f(m.get("o")) or _f(m.get("y"))   # last / open / prev close
        y = _f(m.get("y"))
        if z is None or y is None:
            continue
        pct = (z - y) / y * 100
        price = f"{z:,.0f}" if z >= 1000 else f"{z:,.2f}"
        name = (m.get("n") or "").strip()
        stocks.append({
            "label": "TWII" if s == "t00" else (name or code),
            "price": price,
            "pct": round(pct, 1),
        })
    if not stocks:
        return 1
    tmp = CACHE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps({"fetched_at": time.time(), "stocks": stocks},
                              ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, CACHE)
    return 0


def _maybe_refresh(cache: dict):
    fresh = cache and (time.time() - float(cache.get("fetched_at", 0)) < CACHE_TTL)
    if fresh:
        return
    try:
        if LOCK.exists() and time.time() - LOCK.stat().st_mtime < FETCH_COOLDOWN:
            return
        LOCK.write_text(str(time.time()))
    except OSError:
        return
    try:
        import subprocess
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "--fetch"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, start_new_session=True)
    except Exception:
        pass


# ─── render ──────────────────────────────────────────────────────────────────

def _cells(stocks: list) -> list:
    """Flatten the quotes into a colour-tagged ring of (char, width, colour) cells."""
    cells = []
    for st in stocks:
        try:
            pct = float(st.get("pct", 0))
        except (TypeError, ValueError):
            pct = 0.0
        col = GREEN if pct < 0 else RED          # TW: red up, green down
        unit = f"{st.get('label','')} {st.get('price','')} {pct:+.1f}%"
        for ch in unit:
            cells.append((ch, _cw(ch), col))
        for ch in SEP:
            cells.append((ch, _cw(ch), GREY))
    return cells


def _window(cells, total, start, cols) -> str:
    s = start % total
    acc = idx = intra = 0
    for i, (_, w, _) in enumerate(cells):
        if acc + w > s:
            idx, intra = i, s - acc
            break
        acc += w
    out, used, n, last = [], 0, len(cells), None
    if intra > 0:                          # landed mid wide-glyph
        out.append(" "); used += 1; idx = (idx + 1) % n
    while used < cols:
        ch, w, col = cells[idx]
        if used + w <= cols:
            if col != last:
                out.append(col); last = col
            out.append(ch); used += w
        else:
            out.append(" "); used += 1     # wide glyph would overrun the edge
        idx = (idx + 1) % n
    return "".join(out) + RESET


def _safe(session) -> str:
    import re
    return (re.sub(r"[^A-Za-z0-9_-]", "", session or "")[:64]) or "x"


def _prune():
    cutoff = time.time() - SESSION_TTL_DAYS * 86400
    for f in STATE_DIR.glob(".statusline-ticker.*.state.json"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
        except OSError:
            pass


def render(cols: int, session) -> str:
    blank = " " * cols
    cache = _load_dict(CACHE)
    _maybe_refresh(cache)
    stocks = cache.get("stocks")
    if not isinstance(stocks, list) or not stocks:
        return blank

    cells = _cells(stocks)
    total = sum(w for _, w, _ in cells) or 1

    # left-to-right scroll → window start moves backward one cell per tick
    spath = STATE_DIR / f".statusline-ticker.{_safe(session)}.state.json"
    st = _load_dict(spath)
    try:
        offset = int(st.get("offset", 0)) - 1
    except (TypeError, ValueError):
        offset = -1
    try:
        spath.write_text(json.dumps({"offset": offset}), encoding="utf-8")
    except OSError:
        pass
    if offset % 97 == 0:
        _prune()
    return _window(cells, total, offset, cols)


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
