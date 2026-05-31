# burn

## What it shows

5h 用量預算的**爬升速率**（`%/h`），也就是這個 session 把 5 小時額度燒掉的速度。輸出形如 `burn 12%/h`：`burn` 用 base 灰、數值用 accent 色。只有在算出來的 burn rate `> 0` 時才顯示，額度沒在動（或剛開 session）時整段隱藏。

## Data sources

- `CC_FIVE_PCT` — 5h 視窗的 `used_percentage`（projected stdin，來自 `rate_limits.five_hour`）。
- `CC_SID` — session id，用來分隔每個 session 各自的取樣狀態。
- Per-session 狀態檔 `$STATE/burn.$CC_SID`，內容是 `<epoch> <pct> <rate>` 三欄。每次 render 比較「現在的 pct」與「上次取樣的 pct」，除以經過秒數換算成每小時，只在距上次取樣 ≥ 60s 時才更新檔案與重算速率（短於 60s 的 tick 沿用上次算好的 rate，避免雜訊）。負值會夾成 0。

## Config

無。此 segment 不接受任何 config。

## Requires

- `awk`（速率換算）。
- loader-scope 變數 `$STATE` — per-machine 狀態根目錄（在 git repo 之外，由 loader 設成 `~/.claude/.statusline-state`）。

## Safety notes

- 狀態檔寫在 `$STATE` 底下，**不在** git-synced 的 runtime tree 內；檔名以 `CC_SID` 區隔，session 之間不會互相污染。
- 只讀 projected stdin 的 `CC_FIVE_PCT` / `CC_SID`，看不到原始 CC JSON。
- 純算術 + 檔案讀寫，無網路、無外部行程（awk 除外）。

## Example output

```
burn 12%/h
```
