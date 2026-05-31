# nowplaying

## What it shows

正在播放的曲目，格式为 `♪ <name> — <artist>`（紫色音符 + base 色文字），截断到 44 个字符。只有当 Apple Music 或 Spotify 正在 **playing** 时才显示；player 未打开、暂停、或读取不到曲目信息时整个 segment 隐藏。

## Data sources

- `pgrep -x Spotify` / `pgrep -x Music` — 检测哪个 player 在运行（Spotify 优先）。
- `osascript` 对该 player 发送 AppleEvent 查询 `player state` 与 `current track` 的 `name` / `artist`。
- 不读取任何 stdin (`CC_*`) 字段（`inputs: []`）。

## Config

无。`component.json` 的 `config` 为空。

## Requires

- macOS，且需要为终端 / Claude Code host process 授予 **Automation (AppleEvents/TCC)** 权限以控制 Music / Spotify。
- `requires.macos: ["AppleEvents"]`。

## Safety notes

- **pgrep gate 必须保留**：先用 `pgrep` 确认 player 正在运行才调用 `osascript`。没有它的话，osascript 会在没有任何 player 时触发 AppleEvents/TCC 授权弹窗、甚至把已停止的 app 拉起来。
- app 名称用 **literal**（`"Spotify"` / `"Music"`）而非变量带入 tell block — 这样 scripting dictionary 才能在编译期解析；变量名做不到。
- 所有 osascript 错误都用 `2>/dev/null` 吞掉并返回空字符串，渲染端见空即隐藏，不会把错误输出到 statusline。

## Example output

```
♪ Bohemian Rhapsody — Queen
```
