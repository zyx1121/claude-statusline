# news — 新聞跑馬燈 (line widget)

由右向左捲動的單行新聞跑馬燈，放在 statusline 最頂端 (`slot: top`)。

## What it shows

一行 CJK 寬度對齊的 Google News 標題環圈，每個 tick 向左推進一格 (right-to-left scroll)。標題以 `_safe(session)` 為種子、加上 cache 的整點小時數做 per-session 洗牌排序：同一小時內穩定、不同 session 不同序、每小時換序。顏色為冷調淺灰 (`\033[38;2;168;178;194m`)。沒有快取資料時輸出整行空白 (維持版面高度)。

## Data sources

- Google News RSS (keyless)，`hl=en-US&gl=US&ceid=US:en`。
- `--fetch` 模式拉取設定的各 topic feed (`top` = top stories，其餘 = `<keyword> when:1d` 搜尋)，清洗標題 (去掉尾端 ` - <source>`)、去重，atomic 寫入 cache。
- render 模式只讀 cache；當 cache 的小時數或 topics 有變動，會 fire 一個 detached `--fetch` 並先用現有 cache 繪製 — 永不阻塞網路。
- Fetch 由 render path 自行觸發 (`self_managed`，約每小時)；`fetch.ttl` 為 3600。

## Config

- `topics` (array) — topic 清單，預設 `["top", "world", "technology", "business"]`。
- 設定檔 `topics.default`：一行一個 topic，`#` 開頭為註解。`top` = Google News top stories，其餘字串當作 Google News 搜尋關鍵字。
- loader 透過 `STATUSLINE_CONFIG` 指向本 component 目錄，render.py 從該目錄讀 `topics.default`。

## Requires

- `python3` (pure stdlib，無第三方套件)。
- 對外網路：`news.google.com`。

## Safety notes

- 所有 cache / lock / per-session state 檔都寫在 `STATUSLINE_STATE` (loader 提供的 per-component state 目錄，位於 git repo 之外)；standalone 執行時 fallback 到 `~/.claude`。
- Fetch 有 `LOCK` + `FETCH_COOLDOWN`(120s) 防止重複 spawn。
- 過期的 per-session state 檔 (`.statusline-news.*.state.json`) 以 `SESSION_TTL_DAYS`(3 天) 偶發 prune。
- Cache 寫入採 tmp + `os.replace` atomic，render tick 不會讀到半寫狀態。
- 不讀任何 stdin 欄位 (`stdin_fields: []`)；只接 `<cols>` 與 `--session <sid>`。

## Example output

```
US debt ceiling deal clears Senate · Oil prices close higher · AI chip demand stays strong · ...
```

(實際為冷灰色、隨 tick 向左捲動的單行視窗。)
