# divider

## What it shows

A single full-width horizontal rule — `─` repeated to the terminal width, drawn in
the muted divider colour. It replaces the old host-drawn `profile.rule`: instead of
a fixed line the host injected between the top and middle slots, the divider is an
ordinary line component you place wherever you want a separator.

## Data sources

None. It reads no `CC_*` inputs — the only argument it uses is the terminal column
count the host passes as `$1`.

## Config

None.

## Requires

No external dependencies (no binary, no network, no cache). Pure bash + `seq`.

## Safety notes

- Reads nothing from stdin and writes no state; only prints its line to stdout.
- A line widget, so the host forks it once per render like any other line component.

## Example output

```
────────────────────────────────────────────────
```

(Rendered in the muted rule colour, spanning the full terminal width.)
