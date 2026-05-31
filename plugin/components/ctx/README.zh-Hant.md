# ctx

## 顯示內容

以百分比顯示目前的 context window 使用量（`ctx 16%`），以行內 segment 呈現。數值會四捨五入到整數，並在 ≥80% 時轉為紅色，讓你一眼就能看出快要接近上限。若沒有可用的使用量數值，這個 segment 不會顯示任何內容。

## 資料來源

- 僅來自 Claude Code 的 stdin JSON — `context_window.used_percentage`。不連網、不快取。

## 設定

無。

## 需求

- `bash`（這是 in-process segment，零 fork）

## 安全性說明

- 只讀取單一個投影過來的 stdin 欄位（`context_window.used_percentage`），其餘一概不讀。
- 不連網、不寫檔、不碰任何機密。

## 輸出範例

```
ctx 16%
```
