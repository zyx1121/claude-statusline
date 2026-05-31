# ratelimit

## 顯示內容

單一時段的用量上限儀表 — 5 小時的工作階段上限，或 7 天的每週上限 — 以百分比加上重置倒數呈現（`5h 22% 2h30m`）。百分比達 ≥80% 時轉為紅色。在同一個 profile 裡加入兩次（搭配不同的 `window` 設定），就能並排顯示兩個時段。

## 資料來源

- 僅來自 Claude Code 的 stdin JSON — `rate_limits.five_hour` / `rate_limits.seven_day`（`used_percentage` + `resets_at`）。不連網、不快取。

## 設定

| 鍵 | 型別 | 預設 | 意義 |
|-----|------|---------|---------|
| `window` | string（`5h` \| `7d`） | `5h` | 要顯示哪一個用量上限時段。 |

## 需求

- `bash`（行程內 segment；零 fork）

## 安全須知

- 只讀取投影過的 `rate_limits.*` stdin 欄位。
- 不連網、不寫入檔案系統、不接觸任何祕密資訊。

## 輸出範例

```
5h 22% 2h30m
7d 38% 4d
```
