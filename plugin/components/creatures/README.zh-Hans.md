# creatures

一个 line widget — 在 status line 上放一只只 Seer 宝可怪走来走去的微型世界。纯本机动画，不碰网络。

## What it shows

多行（默认 10 行）octant block（每格 2×4 sub-pixel、每格两色）渲染的动画舞台。每次 status line refresh = 一个 tick：creatures 左右踱步，碰到边缘或彼此会转身（不重叠），活一阵子后消失、换别的出现。同时最多几只共用画面。物种抽自完整 dex（种类 1–500），lazy load — 每 tick 只读当下在画面上的那几只。另有常驻 resident（默认 132 = 百变怪，永不消失），以及 `ground="grass"` 时让 creatures 站在上面的一条纯绿色草地带。输出允许任意多行（不像 segment 只返回单一字符串）。

## Data sources

- `STATUSLINE_CONFIG/assets/` — sprite store：`index.json`（dex 索引 + sx/sy）、`octant.txt`（octant glyph 表）、`<dex>.json` 或 `<dex>.json.gz`（各物种 sprite，lazy load）。loader 不必传 `--data`，默认就指到这里。
- `--session <id>`：per-session 世界，每个 Claude Code session 各有自己的 creatures（state 文件以 session id 命名）。
- 无任何 stdin `CC_*` 字段、无网络 — 动画状态全来自本机 state 文件。

## Config

loader 把 config scalar 转成 `--<key> <value>` flag 传入。

| key | type | default | 说明 |
|-----|------|---------|------|
| `ground` | string | `grass` | creatures 下方的草地带样式。`grass` 画一条纯绿色草地让 creatures 站在上面；其他值 = 不画地面（creatures 贴底）。|
| `resident` | number | `132` | 常驻物种的 dex 编号，永不过期、一直在踱步。默认 132（百变怪）。|

## Requires

- `python3`（纯 stdlib，无第三方包）。

## Safety notes

- `capabilities.network = []`、`exec = false` — 不开网络、不 shell out。
- 只写 `$STATE_DIR`（`STATUSLINE_STATE`，在 git repo 之外）：per-session state 文件 `.statusline-creatures.<safe-session>.state.json`。session id 经 `[^A-Za-z0-9_-]` 过滤 + 截断到 64 字符后才并进文件名，避免 path traversal。
- 闲置超过 3 天的 per-session state 文件会被偶发（每 tick ~1% 概率）清掉。
- sprite assets 走 `STATUSLINE_CONFIG`（in-repo），standalone 运行时 fallback 到 `Path(__file__).parent`；state 走 `STATUSLINE_STATE`，fallback 到 `~/.claude`。

## Example output

10 行 octant block 动画，每格带 24-bit 前景/背景色 ANSI。一只百变怪站在草地上、旁边偶有别的物种路过，画面逐 tick 移动。属视觉动画，无法用纯文字忠实呈现——直接运行：

```sh
STATUSLINE_STATE=/tmp/creatures STATUSLINE_CONFIG=$PWD \
  python3 render.py 120 --session demo --ground grass --resident 132
```
