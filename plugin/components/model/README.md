# model

## What it shows

The display name of the model currently in use (`model.display_name`), rendered in cyan. Placed first in row1 (order=10).

## Data sources

- `CC_MODEL` — projected by the loader from `model.display_name` in the stdin JSON. An empty string means there is no model info, in which case the segment outputs nothing.

## Config

None. The `config` object in `component.json` is empty, and `render__model` ignores `$1`.

## Requires

No external dependencies (no binary, no fetch, no cache). Uses only the `CYAN` / `RESET` provided by core.sh.

## Safety notes

- Reads only the already-projected `CC_MODEL` env var; never touches the raw stdin JSON, never forks, never writes any state.
- When `CC_MODEL` is empty it does `return 0` without setting `REPLY`, so the segment is hidden.

## Example output

```
Opus 4.8 (1M context)
```

(Actually rendered in cyan, followed by `RESET`.)
