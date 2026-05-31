# pr

## What it shows

当前 branch 对应的 PR：`PR#<number>` 后面接一个按 review state 着色的 icon。没有 PR 时整段隐藏。

review state → icon / 颜色对照：

| state | icon | 颜色 |
|-------|------|------|
| `approved` | `✓` | `BOLD_GREEN` |
| `changes_requested` | `✗` | `BOLD_RED` |
| `pending` | `·` | `YELLOW` |
| `draft` | `◌` | `DIM` |
| 其他 / 未知 | （无 icon） | — |

无 icon 时只打印 `PR#<number>`。

## Data sources

纯读 projected-stdin env，零 fork：

- `CC_PR_NUM` ← stdin `pr.number`
- `CC_PR_STATE` ← stdin `pr.review_state`

PR 检测本身由 host 在投影 stdin 之前完成；本 component 不自己跑 `gh`。

## Config

无。

## Requires

无外部 binary / network。

## Safety notes

- 空字符串即「无 PR」（新 contract 已移除旧 monolith 的 `"-"` sentinel），故仅以 `[ -n "$CC_PR_NUM" ]` 把关。
- 通过 `printf -v REPLY` 返回，KEY/VAL/RESET 内的字面 `\033` 在此被解读成真正的 ESC。不 echo 到 stdout。

## Example output

```
PR#161 ✓        # approved
PR#161 ·        # pending
PR#161          # 未知 state，无 icon
```
