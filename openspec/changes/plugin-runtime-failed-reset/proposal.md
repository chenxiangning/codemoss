# Proposal: plugin-runtime-failed-reset

> Wave：1V（插座组装 · Failed 后 reset 恢复 handle）  
> 依赖：1T timeout 失败、1L fuse-reset

## Why

1L 已证明 fuse 后 reset 可恢复。Failed 尚未独立验收。1F 后 timeout 的插件必须能 reset / 再激活，否则会永久死锁。

## 边界

1. timeout → reset → activate 后 query / stream / store MUST 成功。
2. 新 generation MUST 大于失败那次。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-failed-reset-v1`
