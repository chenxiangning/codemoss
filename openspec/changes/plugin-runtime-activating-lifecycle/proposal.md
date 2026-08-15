# Proposal: plugin-runtime-activating-lifecycle

> Wave：1AM（插座组装 · Activating 不得 fuse / disable）  
> 依赖：1AL Activating fail-closed

## Why

1AL 已锁 Activating 不得 activate / reset / query / stream / store。`Host::fuse` / `disable` 仍会覆盖半激活槽位，且不回滚 `inflight`。1F 后握手中途熔断或停用会留下脏并发计数。

## 边界

1. slot 为 `Activating` 时，`fuse_plugin` / `disable_plugin` MUST `activation-busy`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-activating-lifecycle-v1`
