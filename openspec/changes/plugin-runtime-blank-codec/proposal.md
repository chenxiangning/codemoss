# Proposal: plugin-runtime-blank-codec

> Wave：1AZ（插座组装 · 空白 codec 不得开流）  
> 依赖：1AB 未知 codec、1AX log-v1

## Why

1AB 已拒 `custom-pack`。空字符串 / 仅空白 codec 同样不在 V1 白名单，组合面尚未独立验收。1F 后不得用空白 codec 占 stream 槽。

## 边界

1. Ready Notes 用 `""` 或 `"   "` 开流 MUST `unknown-codec`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-blank-codec-v1`
