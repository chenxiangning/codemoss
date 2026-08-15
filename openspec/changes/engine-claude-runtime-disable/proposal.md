# Proposal: engine-claude-runtime-disable

> Wave：3G（第一根插头 · 组合面 disable）  
> 依赖：3F Host disable、1G PluginRuntime、2D store revoke

## Why

3F 只在 Host 单测里 disable Claude fixture。组合面必须再证：activate → open store/stream → disable 后 Broker / store / stream 全拒绝，且 `engine/claude.rs` 仍在。

## 边界

1. 走 `PluginRuntime`，不走产品 EngineManager。
2. disable 后 query / open_own_store / open_stream 均失败。
3. 产品 Claude 源码 MUST 仍存在。
4. 不迁 Notes，不进 boot。

## Capabilities

- `engine-claude-runtime-disable-v1`
