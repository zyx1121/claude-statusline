# news — 新闻跑马灯 (line widget)

由右向左滚动的单行新闻跑马灯，置于 statusline 最顶端 (`slot: top`)。

## What it shows

一行按 CJK 宽度对齐的 Google News 标题环，每个 tick 向左推进一格 (right-to-left scroll)。标题以 `_safe(session)` 为种子，再加上 cache 的整点小时数做 per-session 洗牌排序：同一小时内稳定、不同 session 顺序不同、每小时重新洗牌。颜色为冷色调浅灰 (`\033[38;2;168;178;194m`)。没有缓存数据时输出整行空白 (以保持版面高度)。

## Data sources

- Google News RSS (keyless)，`hl=en-US&gl=US&ceid=US:en`。
- `--fetch` 模式拉取所配置的各 topic feed (`top` = top stories，其余 = `<keyword> when:1d` 搜索)，清洗标题 (去掉末尾的 ` - <source>`)、去重，atomic 写入 cache。
- render 模式只读 cache；当 cache 的小时数或 topics 发生变动时，会 fire 一个 detached `--fetch`，并先用现有 cache 绘制 — 永不阻塞网络。
- Fetch 由 render path 自行触发 (`self_managed`，约每小时)；`fetch.ttl` 为 3600。

## Config

| 键 | 类型 | 默认 | 说明 |
|-----|------|---------|---------|
| `lang` | string | `en-US` | Google News 语系——决定服务哪个语言/地区。可选 `en-US`、`en-GB`、`zh-TW`、`zh-HK`、`zh-CN`、`ja`、`ko`、`fr`、`de`。 |
| `topics` | string | `top,world,technology,business` | 逗号分隔的 topics（不含空格）。`top` = Google News 头条，其余字符串作为搜索关键字。会覆盖 `topics.default`。 |

未设 `topics` config 时，topics 来自 `topics.default` 文件（一行一个、`#` 为注释）。示例：`lang=zh-TW` + `topics=top,國際,科技,AI` → 繁体中文台湾新闻。

## Requires

- `python3` (pure stdlib，无第三方依赖)。
- 对外网络：`news.google.com`。

## Safety notes

- 所有 cache / lock / per-session state 文件都写在 `STATUSLINE_STATE` (loader 提供的 per-component state 目录，位于 git repo 之外)；standalone 运行时 fallback 到 `~/.claude`。
- Fetch 有 `LOCK` + `FETCH_COOLDOWN`(120s) 防止重复 spawn。
- 过期的 per-session state 文件 (`.statusline-news.*.state.json`) 会按 `SESSION_TTL_DAYS`(3 天) 偶尔 prune。
- Cache 写入采用 tmp + `os.replace` atomic，render tick 不会读到写到一半的状态。
- 不读取任何 stdin 字段 (`stdin_fields: []`)；只接受 `<cols>` 与 `--session <sid>`。

## Example output

```
US debt ceiling deal clears Senate · Oil prices close higher · AI chip demand stays strong · ...
```

(实际为冷灰色、随 tick 向左滚动的单行视窗。)
