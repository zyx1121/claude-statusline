# git

A `row2` segment that shows the Git repository state of the current workspace.

## What it shows

Assembles up to four pieces in order, joined into a single segment with the standard ` · ` separator:

- `(branch)` — the current branch name (MAGENTA); falls back to the short SHA when in detached HEAD.
- `dirty <elapsed>` — shown when there are uncommitted changes; the number is the time elapsed since the HEAD commit (`Ns` / `Nm` / `Nh` / `Nd`). Shows `—` when the commit time can't be read.
- `ahead <N>` — number of commits ahead of upstream that haven't been pushed; only appears when `N > 0`.
- `commits <N>` — number of commits since local midnight; only appears when `N > 0`.

`(branch)` uses MAGENTA; the rest use KEY/VAL (gray label + warm-toned value). When no piece is present, the whole segment is hidden (`$REPLY` is left unset).

## Data sources

- `CC_PROJECT_DIR` (projected stdin, maps to `workspace.project_dir`) — the repository root.
- The `git` CLI, always invoked with `GIT_OPTIONAL_LOCKS=0` (`symbolic-ref` / `rev-parse` / `status --porcelain` / `log` / `rev-list`), so the status line never touches `.git`'s optional locks on every tick.

## Config

None. `$1` (the config JSON) is not used.

## Requires

- The `git` binary (`requires.bin`).

## Safety notes

- Runs git commands only when `[ -n "$CC_PROJECT_DIR" ] && [ -d "$CC_PROJECT_DIR/.git" ]` holds; otherwise it `return 0`s immediately.
- Every git call uses `2>/dev/null`, so repository edge cases (no upstream, empty repo, etc.) simply omit the corresponding piece without erroring.
- `GIT_OPTIONAL_LOCKS=0` keeps access read-only — it never creates a lock file in the repository.

## Example output

```
(main) · dirty 0s · ahead 1 · commits 3
```

A clean repo (no dirty / no ahead):

```
(dev) · commits 1
```
