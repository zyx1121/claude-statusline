# divider

## 顯示什麼

一條滿寬的水平分隔線 —— `─` 重複到終端寬度，用低調的分隔線顏色。它取代舊的
host-drawn `profile.rule`：以前是 host 在 top 與 middle 之間硬畫一條固定線，現在
divider 是一個普通的 line component，想在哪裡分隔就放進哪個 line slot。

## 資料來源

無。不讀任何 `CC_*` input —— 唯一用到的參數是 host 以 `$1` 傳入的終端欄數。

## 設定

無。

## 依賴

無外部依賴（無 binary、無網路、無 cache）。純 bash + `seq`。

## 安全性

- 不讀 stdin、不寫任何 state；只把自己的那一行印到 stdout。
- 屬 line widget，host 每次 render fork 一次，跟其他 line component 一樣。

## 範例輸出

```
────────────────────────────────────────────────
```

（實際以分隔線顏色渲染，滿終端寬度。）
