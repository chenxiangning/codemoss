# Proposal: plugin-runtime-crash-handles

> Wave：1U（插座组装 · entry crash 后不得拿 handle）  
> 依赖：1T timeout 失败、1B Host crash 回滚

## Why

1T 已证明 required timeout 后不得拿 handle。crash 走另一条错误码 `activation-failed`。组合面尚未独立验收。1F 后崩溃的半激活插件不得继续读 workspace / 开 stream / 摸 store。

## 边界

1. FakeDriver crash 导致 activate 失败后，slot MUST `Failed`。
2. `query_read` / `open_stream` / `open_own_store` MUST `plugin-unavailable`。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-crash-handles-v1`
