# Design: engine-claude-compat-adapter

## Decisions

### D1. 门面住在 `plugin_runtime`，不改 registry

生产 `EngineAdapterRegistry` 继续持有 `builtin.claude`。门面是 **下一层替换点的类型**，本刀不 `insert`。

### D2. 委托，不复制

- session：`ClaudeSessionManager::get_or_create_session`
- event：`BuiltinEngineAdapter::map_wire_event`

禁止把 history / spawn / stream 抄进 `plugin_runtime`。

### D3. 单一 owner 枚举

```text
CompatOwner::CoreClaude
```

3E 才允许出现第二个 owner 变体，且必须由 flag 选择，不能同时 active。

### D4. 不进 boot

仅被单测与后续 3E flag 调用。`lib.rs::run` 不构造该 adapter。
