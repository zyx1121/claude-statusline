# git

`row2` segment，顯示目前 workspace 的 Git 倉庫狀態。

## What it shows

依序組出最多四段，用標準分隔符 ` · ` 串成單一 segment：

- `(branch)` — 目前分支名（MAGENTA）；detached HEAD 時 fallback 成 short SHA。
- `dirty <elapsed>` — 有未提交變更時顯示，數字是距離 HEAD commit 的經過時間（`Ns` / `Nm` / `Nh` / `Nd`）。取不到 commit 時間時顯示 `—`。
- `ahead <N>` — 領先 upstream 但尚未 push 的 commit 數，`N > 0` 才出現。
- `commits <N>` — 本地午夜以來 authored 的 commit 數，`N > 0` 才出現。

`(branch)` 用 MAGENTA；其餘走 KEY/VAL（灰底 + 暖色數值）。沒有任何一段時整個 segment 隱藏（不設 `$REPLY`）。

## Data sources

- `CC_PROJECT_DIR`（projected stdin，對應 `workspace.project_dir`）— 倉庫根目錄。
- `git` CLI，全程帶 `GIT_OPTIONAL_LOCKS=0`（`symbolic-ref` / `rev-parse` / `status --porcelain` / `log` / `rev-list`），避免 statusline 每 tick 去碰 `.git` 的 optional lock。

## Config

無。`$1`（config JSON）不使用。

## Requires

- `git` binary（`requires.bin`）。

## Safety notes

- 只在 `[ -n "$CC_PROJECT_DIR" ] && [ -d "$CC_PROJECT_DIR/.git" ]` 成立時才執行任何 git 指令；其餘狀況直接 `return 0`。
- 所有 git 呼叫 `2>/dev/null`，倉庫異常（無 upstream、空倉庫等）時對應段落自動省略，不報錯。
- `GIT_OPTIONAL_LOCKS=0` 確保唯讀，不會替倉庫建立 lock 檔。

## Example output

```
(main) · dirty 0s · ahead 1 · commits 3
```

clean 倉庫（無 dirty / 無 ahead）：

```
(dev) · commits 1
```
