# burn

## What it shows

The **climb rate** of the 5h usage budget (`%/h`) — i.e. how fast this session is burning through its 5-hour allowance. The output looks like `burn 12%/h`: `burn` renders in the KEY color and the number in the VAL color. It only appears once the computed burn rate is `> 0`; when the budget isn't moving (or the session has just started), the whole segment is hidden.

## Data sources

- `CC_FIVE_PCT` — the `used_percentage` of the 5h window (projected stdin, from `rate_limits.five_hour`).
- `CC_SID` — the session id, used to keep each session's sampling state separate.
- Per-session state file `$STATE/burn.$CC_SID`, holding three fields: `<epoch> <pct> <rate>`. On every render it compares the current `pct` against the last sampled `pct`, divides by the elapsed seconds, and converts to a per-hour rate. The file is only rewritten and the rate recomputed when at least 60s have passed since the last sample (ticks shorter than 60s reuse the previously computed rate, to avoid noise). Negative values are clamped to 0.

## Config

None. This segment takes no config.

## Requires

- `awk` (for the rate conversion).
- The loader-scope variable `$STATE` — the per-machine state root (outside the git repo; set by the loader to `~/.claude/.statusline-state`).

## Safety notes

- The state file lives under `$STATE`, **not** inside the git-synced runtime tree; the filename is keyed by `CC_SID`, so sessions never contaminate each other.
- It only reads `CC_FIVE_PCT` / `CC_SID` from projected stdin — it never sees the raw CC JSON.
- Pure arithmetic plus file read/write: no network, no external processes (other than `awk`).

## Example output

```
burn 12%/h
```
