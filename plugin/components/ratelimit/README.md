# ratelimit

## What it shows

A usage-limit gauge for one window — the 5-hour session limit or the 7-day weekly limit — as a percentage plus a reset countdown (`5h 22% 2h30m`). The percentage turns red at ≥80%. Add it twice in a profile (with different `window` config) to show both windows side by side.

## Data sources

- The Claude Code stdin JSON only — `rate_limits.five_hour` / `rate_limits.seven_day` (`used_percentage` + `resets_at`). No network, no cache.

## Config

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `window` | string (`5h` \| `7d`) | `5h` | Which rate-limit window to display. |

## Requires

- `bash` (in-process segment; zero fork)

## Safety notes

- Reads only the projected `rate_limits.*` stdin fields.
- No network, no filesystem writes, no secrets.

## Example output

```
5h 22% 2h30m
7d 38% 4d
```
