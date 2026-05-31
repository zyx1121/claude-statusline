# ctx

## What it shows

The current context-window usage as a percentage (`ctx 16%`), shown as an inline segment. The value is rounded to the nearest integer and turns red at ≥80% so you can see when you're approaching the limit at a glance. If no usage value is available, the segment renders nothing.

## Data sources

- The Claude Code stdin JSON only — `context_window.used_percentage`. No network, no cache.

## Config

None.

## Requires

- `bash` (it's an in-process segment; zero fork)

## Safety notes

- Reads a single projected stdin field (`context_window.used_percentage`) and nothing else.
- No network, no filesystem writes, no secrets.

## Example output

```
ctx 16%
```
