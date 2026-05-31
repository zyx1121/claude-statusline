# model

## What it shows

目前使用中的模型顯示名稱（`model.display_name`），以 cyan 色呈現。放在 row1 最前面（order=10）。

## Data sources

- `CC_MODEL` — 由 loader 從 stdin JSON 的 `model.display_name` 投影而來。空字串代表沒有模型資訊，此時 segment 不輸出。

## Config

無。`component.json` 的 `config` 為空物件，`render__model` 忽略 `$1`。

## Requires

無外部依賴（無 binary、無 fetch、無 cache）。只用 core.sh 提供的 `CYAN` / `RESET`。

## Safety notes

- 純讀取已投影的 `CC_MODEL` env，不碰原始 stdin JSON、不 fork、不寫任何 state。
- `CC_MODEL` 空時 `return 0` 不設 `REPLY`，segment 隱藏。

## Example output

```
Opus 4.8 (1M context)
```

（實際以 cyan 著色，後接 `RESET`。）
