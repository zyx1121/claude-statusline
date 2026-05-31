# cost

## What it shows

本 session 累计花费（美金），格式 `$%.2f`（例如 `$1.27`）。数值以 accent 色（`VAL`）显示。

## Data sources

- `CC_COST` — 由 loader 从 stdin JSON 的 `cost.total_cost_usd` 投影而来。

## Config

无。config-less segment，`$1` 接到的 JSON 会被忽略。

## Requires

无外部依赖。只用 core.sh 的 `VAL` / `RESET` palette 变量。

## Safety notes

- 空字符串、`"0"`、旧 sentinel `"-"` 一律 `return 0`（不设 `REPLY`），所以只有花费大于 0 才会显示。
- 不写 stdout、不 fork、不碰文件系统。

## Example output

```
$1.27
```
