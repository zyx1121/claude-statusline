# pr

## What it shows

當前 branch 對應的 PR：`PR#<number>` 後面接一個依 review state 上色的 icon。沒有 PR 時整段隱藏。

review state → icon / 顏色對照：

| state | icon | 顏色 |
|-------|------|------|
| `approved` | `✓` | `BOLD_GREEN` |
| `changes_requested` | `✗` | `BOLD_RED` |
| `pending` | `·` | `YELLOW` |
| `draft` | `◌` | `DIM` |
| 其他 / 未知 | （無 icon） | — |

無 icon 時只印 `PR#<number>`。

## Data sources

純讀 projected-stdin env，零 fork：

- `CC_PR_NUM` ← stdin `pr.number`
- `CC_PR_STATE` ← stdin `pr.review_state`

PR 偵測本身由 host 在投影 stdin 前完成；本 component 不自己跑 `gh`。

## Config

無。

## Requires

無外部 binary / network。

## Safety notes

- 空字串即「無 PR」（新 contract 已移除舊 monolith 的 `"-"` sentinel），故僅以 `[ -n "$CC_PR_NUM" ]` 把關。
- 透過 `printf -v REPLY` 回傳，KEY/VAL/RESET 內的字面 `\033` 在此被解讀成真正的 ESC。不 echo 到 stdout。

## Example output

```
PR#161 ✓        # approved
PR#161 ·        # pending
PR#161          # 未知 state，無 icon
```
