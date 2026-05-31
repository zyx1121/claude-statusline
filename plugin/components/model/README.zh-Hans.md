# model

## What it shows

当前使用中的模型显示名称（`model.display_name`），以 cyan 色呈现。位于 row1 最前面（order=10）。

## Data sources

- `CC_MODEL` — 由 loader 从 stdin JSON 的 `model.display_name` 投影而来。空字符串表示没有模型信息，此时 segment 不输出。

## Config

无。`component.json` 的 `config` 为空对象，`render__model` 忽略 `$1`。

## Requires

无外部依赖（无 binary、无 fetch、无 cache）。仅使用 core.sh 提供的 `CYAN` / `RESET`。

## Safety notes

- 仅读取已投影的 `CC_MODEL` 环境变量，不接触原始 stdin JSON、不 fork、不写入任何 state。
- `CC_MODEL` 为空时执行 `return 0` 而不设置 `REPLY`，segment 隐藏。

## Example output

```
Opus 4.8 (1M context)
```

（实际以 cyan 着色，后接 `RESET`。）
