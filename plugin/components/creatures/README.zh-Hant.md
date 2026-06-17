# creatures

一個 line widget — 在 status line 上放一隻隻 Seer 寶可怪走來走去的微型世界。純本機動畫，不碰網路。

## What it shows

多列（預設 10 列）的動畫舞台，預設用 octant block（Unicode 16 Legacy Computing，U+1CD00…）以完整 2×4 sub-pixel 解析度算圖——一格一個 glyph、兩色，八個 sub-pixel 每個佔一格的 1/8。這需要會 custom-draw 這些 glyph 的終端（Ghostty、kitty、WezTerm、較新的 iTerm2）；設 `blocks="quadrant"` 則把每格折成 2×2 的 U+2580–259F Block Element，可在任何 monospace font 顯示（例如 Terminal.app），代價是垂直精度減半。每次 status line refresh = 一個 tick：creatures 左右踱步，碰到邊緣或彼此會轉身（不重疊），活一陣子後消失、換別的出現。同時最多幾隻共用畫面。物種抽自完整 dex（種類 1–500），lazy load — 每 tick 只讀當下在畫面上的那幾隻。另有常駐 resident（預設 132 = 百變怪，永不消失），以及 `ground="grass"` 時讓 creatures 站在上面的一條純綠色草地帶。輸出允許任意多列（unlike segment 只回單一字串）。

## Data sources

- `STATUSLINE_CONFIG/assets/` — sprite store：`index.json`（dex 索引 + sx/sy）、`<dex>.json` 或 `<dex>.json.gz`（各物種 sprite，lazy load）。loader 不必傳 `--data`，預設就指到這裡。（`octant.txt` — 256 個 glyph 的 octant 對照表——在 `octant` 模式由 terminal renderer 讀取，並與 web preview 的 pixel-decoder 共用同一份。）
- `--session <id>`：per-session 世界，每個 Claude Code session 各有自己的 creatures（state 檔以 session id 命名）。
- 無任何 stdin `CC_*` 欄位、無網路 — 動畫狀態全來自本機 state 檔。

## Config

loader 把 config scalar 轉成 `--<key> <value>` flag 傳入。

| key | type | default | 說明 |
|-----|------|---------|------|
| `ground` | string | `grass` | creatures 底下的草地帶樣式。`grass` 畫一條純綠色草地讓 creatures 站在上面；其他值 = 不畫地面（creatures 貼底）。|
| `resident` | number | `132` | 常駐物種的 dex 編號，永不過期、一直在踱步。預設 132（百變怪）。|
| `blocks` | string | `octant` | sub-pixel block 樣式。`octant`（預設）用 Unicode 16 octant glyph 畫出每格完整 2×4——需要會 custom-draw 的終端（Ghostty、kitty、WezTerm、較新的 iTerm2）。`quadrant` 折成 2×2 U+2580–259F block，可在任何 monospace font 顯示（例如 Terminal.app），垂直精度減半。|
| `exclude` | string | _(空)_ | 逗號分隔的 dex 編號，從隨機 spawn 池移除、永不亂入（例如 `79` 把呆呆獸趕走）。resident 是顯式指定、不受此影響。|

## Requires

- `python3`（純 stdlib，無第三方套件）。

## Safety notes

- `capabilities.network = []`、`exec = false` — 不開網路、不 shell out。
- 只寫 `$STATE_DIR`（`STATUSLINE_STATE`，在 git repo 之外）：per-session state 檔 `.statusline-creatures.<safe-session>.state.json`。session id 經 `[^A-Za-z0-9_-]` 過濾 + 截 64 字後才併進檔名，避免 path traversal。
- 閒置超過 3 天的 per-session state 檔會被偶發（每 tick ~1% 機率）清掉。
- sprite assets 走 `STATUSLINE_CONFIG`（in-repo），standalone 跑時 fallback 到 `Path(__file__).parent`；state 走 `STATUSLINE_STATE`，fallback 到 `~/.claude`。

## Example output

10 列 octant block 動畫（或加 `--blocks quadrant` 改用 2×2 quadrant block），每格帶 24-bit 前景/背景色 ANSI。一隻百變怪站在草地上、旁邊偶有別的物種路過，畫面逐 tick 移動。屬視覺動畫，無法用純文字忠實呈現——直接跑：

```sh
STATUSLINE_STATE=/tmp/creatures STATUSLINE_CONFIG=$PWD \
  python3 render.py 120 --session demo --ground grass --resident 132
```
