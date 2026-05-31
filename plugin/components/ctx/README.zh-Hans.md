# ctx

## 显示内容

以百分比显示当前的 context window 使用量（`ctx 16%`），以行内 segment 呈现。数值会四舍五入到整数，并在 ≥80% 时变为红色，让你一眼就能看出即将接近上限。若没有可用的使用量数值，该 segment 不会显示任何内容。

## 数据来源

- 仅来自 Claude Code 的 stdin JSON — `context_window.used_percentage`。不联网、不缓存。

## 配置

无。

## 依赖

- `bash`（这是 in-process segment，零 fork）

## 安全性说明

- 只读取单个投影过来的 stdin 字段（`context_window.used_percentage`），其余一概不读。
- 不联网、不写文件、不涉及任何密钥。

## 输出示例

```
ctx 16%
```
