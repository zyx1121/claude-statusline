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

| 鍵 | 型別 | 預設 | 說明 |
|-----|------|---------|---------|
| `lang` | string | `en-US` | Google News 語系——決定服務哪個語言/地區。可選 `en-US`、`en-GB`、`zh-TW`、`zh-HK`、`zh-CN`、`ja`、`ko`、`fr`、`de`。 |
| `topics` | string | `top,world,technology,business` | 逗號分隔的 topics（不含空白）。`top` = Google News 頭條，其餘字串當搜尋關鍵字。會覆蓋 `topics.default`。 |

未設 `topics` config 時，topics 來自 `topics.default` 檔（一行一個、`#` 為註解）。範例：`lang=zh-TW` + `topics=top,國際,科技,AI` → 繁體中文台灣新聞。

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
