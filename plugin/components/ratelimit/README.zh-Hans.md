# ratelimit

## 显示内容

单个时段的用量上限仪表 — 5 小时的会话上限，或 7 天的每周上限 — 以百分比加上重置倒计时呈现（`5h 22% 2h30m`）。百分比达 ≥80% 时转为红色。在同一个 profile 中添加两次（搭配不同的 `window` 配置），即可并排显示两个时段。

## 数据来源

- 仅来自 Claude Code 的 stdin JSON — `rate_limits.five_hour` / `rate_limits.seven_day`（`used_percentage` + `resets_at`）。不联网、不缓存。

## 配置

| 键 | 类型 | 默认值 | 含义 |
|-----|------|---------|---------|
| `window` | string（`5h` \| `7d`） | `5h` | 要显示哪一个用量上限时段。 |

## 依赖

- `bash`（进程内 segment；零 fork）

## 安全须知

- 仅读取投影后的 `rate_limits.*` stdin 字段。
- 不联网、不写入文件系统、不接触任何密钥信息。

## 输出示例

```
5h 22% 2h30m
7d 38% 4d
```
