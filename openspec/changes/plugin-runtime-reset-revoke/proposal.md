# Proposal: plugin-runtime-reset-revoke

> Wave：1Z（插座组装 · reset 必须撤销旧 stream）  
> 依赖：1Y Ready swap 撤 stream、1L fuse-reset

## Why

1Y 已在 Ready 再激活时撤旧 stream。`reset_plugin` 目前只复位 Host 槽位，DataPlane 上的旧 stream 会留下。1F 后 reset 不得让旧 generation 继续占着 plane。

## 边界

1. Ready Notes 打开 stream 后 `reset_plugin` MUST 撤销该 stream。
2. reset 后旧 generation 的 query / stream MUST 失败。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-reset-revoke-v1`
