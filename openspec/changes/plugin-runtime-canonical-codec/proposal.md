# Proposal: plugin-runtime-canonical-codec

> Wave：1BH（插座组装 · 未 trim codec 不得开流）  
> 依赖：1AZ 空白 codec、1BE canonical 身份

## Why

空白 codec 已返回 `unknown-codec`。`" blob-v1 "` 同样不在白名单，但组合面尚未独立验收。1F 后不得用带空白的 codec 名占 stream。

## 边界

1. Ready Notes 用 `" blob-v1 "` 开流 MUST `unknown-codec`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-canonical-codec-v1`
