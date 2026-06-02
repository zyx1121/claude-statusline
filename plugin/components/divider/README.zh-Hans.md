# divider

## 显示什么

一条满宽的水平分隔线 —— `─` 重复到终端宽度，用低调的分隔线颜色。它取代旧的
host-drawn `profile.rule`：以前是 host 在 top 与 middle 之间硬画一条固定线，现在
divider 是一个普通的 line component，想在哪里分隔就放进哪个 line slot。

## 数据来源

无。不读任何 `CC_*` input —— 唯一用到的参数是 host 以 `$1` 传入的终端列数。

## 配置

无。

## 依赖

无外部依赖（无 binary、无网络、无 cache）。纯 bash + `seq`。

## 安全性

- 不读 stdin、不写任何 state；只把自己的那一行打印到 stdout。
- 属 line widget，host 每次 render fork 一次，跟其他 line component 一样。

## 示例输出

```
────────────────────────────────────────────────
```

（实际以分隔线颜色渲染，满终端宽度。）
