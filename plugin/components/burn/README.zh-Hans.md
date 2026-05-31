# burn

## 显示内容

5h 用量预算的**爬升速率**（`%/h`），也就是当前 session 消耗这 5 小时额度的速度。输出形如 `burn 12%/h`：`burn` 用 KEY 色、数值用 VAL 色。只有在算出来的 burn rate `> 0` 时才显示，额度没有变化（或刚开 session）时整段隐藏。

## 数据来源

- `CC_FIVE_PCT` — 5h 窗口的 `used_percentage`（projected stdin，来自 `rate_limits.five_hour`）。
- `CC_SID` — session id，用来区分每个 session 各自的采样状态。
- Per-session 状态文件 `$STATE/burn.$CC_SID`，内容是 `<epoch> <pct> <rate>` 三列。每次 render 比较「当前的 pct」与「上次采样的 pct」，除以经过的秒数换算成每小时速率，仅在距上次采样 ≥ 60s 时才更新文件并重算速率（短于 60s 的 tick 沿用上次算好的 rate，以避免噪声）。负值会被夹成 0。

## 配置

无。此 segment 不接受任何 config。

## 依赖

- `awk`（速率换算）。
- loader-scope 变量 `$STATE` — per-machine 状态根目录（在 git repo 之外，由 loader 设为 `~/.claude/.statusline-state`）。

## 安全性说明

- 状态文件写在 `$STATE` 下，**不在** git-synced 的 runtime tree 内；文件名以 `CC_SID` 区分，session 之间不会互相污染。
- 只读取 projected stdin 的 `CC_FIVE_PCT` / `CC_SID`，看不到原始 CC JSON。
- 纯算术 + 文件读写，无网络、无外部进程（awk 除外）。

## 输出示例

```
burn 12%/h
```
