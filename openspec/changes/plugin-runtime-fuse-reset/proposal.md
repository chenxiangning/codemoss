# Proposal: plugin-runtime-fuse-reset

> Wave：1L（插座组装 · fuse 后 reset 恢复）  
> 依赖：1J fuse_plugin、2D disable 后 reset

## Why

1J 证明 fuse 后不得再 activate。合同还要求 reset 后 generation 前进、handle 可重新授予。若不先在组合面证明，1F 后 fused 插件会永远死锁。

## 边界

1. `reset_plugin` 暴露 Host.reset。
2. fuse → reset → activate 后 query / store / stream MUST 成功。
3. 新 generation 不得等于 fuse 前的 generation。
4. 不进 boot，不删产品代码。

## Capabilities

- `plugin-runtime-fuse-reset-v1`
