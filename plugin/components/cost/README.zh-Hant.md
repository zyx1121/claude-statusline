# cost

## What it shows

本 session 累計花費（美金），格式 `$%.2f`（例如 `$1.27`）。數值以 accent 色（`VAL`）顯示。

## Data sources

- `CC_COST` — 由 loader 從 stdin JSON 的 `cost.total_cost_usd` 投影而來。

## Config

無。config-less segment，`$1` 接到的 JSON 會被忽略。

## Requires

無外部依賴。只用 core.sh 的 `VAL` / `RESET` palette 變數。

## Safety notes

- 空字串、`"0"`、舊 sentinel `"-"` 一律 `return 0`（不設 `REPLY`），所以只有花費大於 0 才會顯示。
- 不寫 stdout、不 fork、不碰檔案系統。

## Example output

```
$1.27
```
