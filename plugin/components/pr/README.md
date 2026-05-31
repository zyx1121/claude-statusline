# pr

## What it shows

The PR for the current branch: `PR#<number>` followed by an icon colored by review state. The whole segment is hidden when there is no PR.

review state → icon / color mapping:

| state | icon | color |
|-------|------|-------|
| `approved` | `✓` | `BOLD_GREEN` |
| `changes_requested` | `✗` | `BOLD_RED` |
| `pending` | `·` | `YELLOW` |
| `draft` | `◌` | `DIM` |
| other / unknown | (no icon) | — |

When there is no icon, only `PR#<number>` is printed.

## Data sources

Pure read of the projected-stdin env, zero forks:

- `CC_PR_NUM` ← stdin `pr.number`
- `CC_PR_STATE` ← stdin `pr.review_state`

PR detection itself is done by the host before projecting stdin; this component does not run `gh` on its own.

## Config

None.

## Requires

No external binary / network.

## Safety notes

- An empty string means "no PR" (the new contract drops the old monolith's `"-"` sentinel), so the only guard is `[ -n "$CC_PR_NUM" ]`.
- Output is returned via `printf -v REPLY`, where the literal `\033` inside KEY/VAL/RESET is interpreted as a real ESC. Nothing is echoed to stdout.

## Example output

```
PR#161 ✓        # approved
PR#161 ·        # pending
PR#161          # unknown state, no icon
```
