# git

`row2` segment，显示当前 workspace 的 Git 仓库状态。

## What it shows

按顺序拼出最多四段，用标准分隔符 ` · ` 串成单一 segment：

- `(branch)` — 当前分支名（MAGENTA）；detached HEAD 时 fallback 成 short SHA。
- `dirty <elapsed>` — 存在未提交改动时显示，数字是距离 HEAD commit 的经过时间（`Ns` / `Nm` / `Nh` / `Nd`）。取不到 commit 时间时显示 `—`。
- `ahead <N>` — 领先 upstream 但尚未 push 的 commit 数，`N > 0` 才出现。
- `commits <N>` — 本地午夜以来的 commit 数，`N > 0` 才出现。

`(branch)` 用 MAGENTA；其余走 KEY/VAL（灰底标签 + 暖色数值）。没有任何一段时整个 segment 隐藏（不设 `$REPLY`）。

## Data sources

- `CC_PROJECT_DIR`（projected stdin，对应 `workspace.project_dir`）— 仓库根目录。
- `git` CLI，全程带 `GIT_OPTIONAL_LOCKS=0`（`symbolic-ref` / `rev-parse` / `status --porcelain` / `log` / `rev-list`），避免 statusline 每个 tick 去碰 `.git` 的 optional lock。

## Config

无。`$1`（config JSON）不使用。

## Requires

- `git` binary（`requires.bin`）。

## Safety notes

- 仅在 `[ -n "$CC_PROJECT_DIR" ] && [ -d "$CC_PROJECT_DIR/.git" ]` 成立时才执行任何 git 命令；其余情况直接 `return 0`。
- 所有 git 调用带 `2>/dev/null`，仓库异常（无 upstream、空仓库等）时对应段落自动省略，不报错。
- `GIT_OPTIONAL_LOCKS=0` 确保只读，不会给仓库创建 lock 文件。

## Example output

```
(main) · dirty 0s · ahead 1 · commits 3
```

clean 仓库（无 dirty / 无 ahead）：

```
(dev) · commits 1
```
