# nowplaying

## What it shows

正在播放的曲目，格式 `♪ <name> — <artist>`（紫色音符 + base 色文字），截斷到 44 字元。只有當 Apple Music 或 Spotify 正在 **playing** 時才顯示；player 沒開、暫停、或抓不到曲目資訊則整個 segment 隱藏。

## Data sources

- `pgrep -x Spotify` / `pgrep -x Music` — 偵測哪個 player 在跑（Spotify 優先）。
- `osascript` 對該 player 下 AppleEvent 查 `player state` 與 `current track` 的 `name` / `artist`。
- 不讀任何 stdin (`CC_*`) 欄位（`inputs: []`）。

## Config

無。`component.json` 的 `config` 為空。

## Requires

- macOS，且需要對終端 / Claude Code host process 授予 **Automation (AppleEvents/TCC)** 權限去控制 Music / Spotify。
- `requires.macos: ["AppleEvents"]`。

## Safety notes

- **pgrep gate 必須保留**：先用 `pgrep` 確認 player 正在跑才呼叫 `osascript`。沒有它的話，osascript 會在沒有任何 player 時觸發 AppleEvents/TCC 授權彈窗、甚至把停掉的 app 拉起來。
- app 名稱用 **literal**（`"Spotify"` / `"Music"`）而非變數帶入 tell block — 這樣 scripting dictionary 才能在編譯期解析；變數名做不到。
- 所有 osascript 錯誤都 `2>/dev/null` 吞掉並回傳空字串，渲染端見空即隱藏，不會吐錯誤到 statusline。

## Example output

```
♪ Bohemian Rhapsody — Queen
```
