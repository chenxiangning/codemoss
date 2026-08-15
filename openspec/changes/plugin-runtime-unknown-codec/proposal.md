# Proposal: plugin-runtime-unknown-codec

> Wave：1AB（插座组装 · 组合面拒绝未知 codec）  
> 依赖：1E4 DataPlane `assert_known_codec`

## Why

DataPlane 已拒绝非 V1 codec。组合面尚未独立验收。1F 后 Ready 插件不得用 `custom-pack` 一类未冻结 codec 开流。

## 边界

1. Ready Notes `open_stream(..., "custom-pack")` MUST `unknown-codec`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-unknown-codec-v1`
