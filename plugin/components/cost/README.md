# cost

## What it shows

The accumulated cost of the current session, in USD, formatted as `$%.2f` (e.g. `$1.27`). The value is rendered in the accent color (`VAL`).

## Data sources

- `CC_COST` — projected by the loader from `cost.total_cost_usd` in the stdin JSON.

## Config

None. This is a config-less segment; the JSON passed in `$1` is ignored.

## Requires

No external dependencies. Uses only the `VAL` / `RESET` palette variables from core.sh.

## Safety notes

- An empty string, `"0"`, or the legacy sentinel `"-"` all `return 0` (without setting `REPLY`), so the segment only renders once cost is greater than 0.
- Writes nothing to stdout, never forks, never touches the filesystem.

## Example output

```
$1.27
```
