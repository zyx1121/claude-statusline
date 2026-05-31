# news — news ticker (line widget)

A single-line news ticker that scrolls right-to-left, pinned to the top of the status line (`slot: top`).

## What it shows

One CJK-width-aware ring of Google News headlines that advances one cell to the left every tick (right-to-left scroll). Headlines are shuffled into a per-session running order seeded by `_safe(session)` plus the cache's clock hour: stable within the hour, different per session, and reshuffled hourly. The text is rendered in a cool light grey (`\033[38;2;168;178;194m`). When there is no cached data, it emits a full blank line (to preserve the layout height).

## Data sources

- Google News RSS (keyless), `hl=en-US&gl=US&ceid=US:en`.
- `--fetch` mode pulls each configured topic feed (`top` = top stories, anything else = a `<keyword> when:1d` search), normalizes titles (drops the trailing ` - <source>`), dedupes, and writes the cache atomically.
- Render mode only reads the cache; when the cache's clock hour or topics no longer match, it fires a detached `--fetch` and draws from the existing cache first — it never blocks on the network.
- Fetch is triggered by the render path itself (`self_managed`, roughly hourly); `fetch.ttl` is 3600.

## Config

- `topics` (array) — the topic list, default `["top", "world", "technology", "business"]`.
- Config file `topics.default`: one topic per line, lines starting with `#` are comments. `top` = Google News top stories, any other string is used as a Google News search keyword.
- The loader points `STATUSLINE_CONFIG` at this component directory, and `render.py` reads `topics.default` from there.

## Requires

- `python3` (pure stdlib, no third-party packages).
- Outbound network: `news.google.com`.

## Safety notes

- All cache / lock / per-session state files are written under `STATUSLINE_STATE` (the per-component state directory provided by the loader, located outside the git repo); standalone runs fall back to `~/.claude`.
- Fetch is guarded by a `LOCK` + `FETCH_COOLDOWN` (120s) to prevent duplicate spawns.
- Stale per-session state files (`.statusline-news.*.state.json`) are occasionally pruned at `SESSION_TTL_DAYS` (3 days).
- The cache is written via tmp + `os.replace` (atomic), so a render tick never reads a half-written cache.
- It reads no stdin fields (`stdin_fields: []`); it only accepts `<cols>` and `--session <sid>`.

## Example output

```
US debt ceiling deal clears Senate · Oil prices close higher · AI chip demand stays strong · ...
```

(In practice it's a single-line window in cool grey, scrolling left with each tick.)
