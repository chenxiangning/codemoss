# Proposal: plugin-runtime-failed-handles

> Wave：1T（插座组装 · 激活失败后不得拿 handle）  
> 依赖：1B Host timeout 回滚、1G PluginRuntime

## Why

Host 已在 required timeout 后把 slot 置 Failed 并回滚已启动 entry。组合面尚未独立验收 Failed 后 query / stream / store。1F 后半激活插件不得继续拿 handle。

## 边界

1. FakeDriver timeout 导致 activate 失败后，slot MUST `Failed`。
2. `query_read` / `open_stream` / `open_own_store` MUST `plugin-unavailable`。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-failed-handles-v1`
