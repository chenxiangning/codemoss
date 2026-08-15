# Proposal: engine-claude-compat-adapter

> OpenSpec change id: `engine-claude-compat-adapter`  
> Wave：3D（第一根插头 · compatibility 门面）  
> 依赖：3A inventory、3B Manifest、3C Host 假激活  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)、[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

Inventory / Manifest / 假激活已绿，但产品路径仍直接握着 `ClaudeSessionManager`。若不先加 **单 owner 门面**，下一步 dual-run 会同时改 manager 与 Host。3D 只包一层 `ClaudeCompatAdapter`，内部仍调用现有 Core Claude。

## 目标与边界

1. `plugin_runtime::claude_compat::ClaudeCompatAdapter` 声明 `pluginId=com.mossx.engine.claude`。
2. session get/create **委托** `ClaudeSessionManager`，同一 workspace 返回同一 `Arc`。
3. wire event 映射委托现有 `BuiltinEngineAdapter`，不复制 parser。
4. **不**替换 `EngineAdapterRegistry` 里的 `builtin.claude`。
5. **不**接 App 启动链、不 dual-run、不删 `engine/claude*`、不搬 history。

## 非目标

- feature flag 双路径
- 独立仓库 / `.mossx-plugin`
- disable-not-delete
- Notes / 其他 CLI 门面

## Capabilities

### New Capabilities

- `engine-claude-compat-adapter-v1`：Core 内单 owner Claude 门面

## 验收标准

1. facade `plugin_id` 与 fixture 一致。
2. 两次 `get_or_create_session` 得到同一 `Arc`（证明未另起会话表）。
3. `EngineAdapterRegistry::with_builtins()` 仍只有一份 `claude`，`adapter_id` 仍为 `builtin.claude`。
4. `src-tauri/src/engine/claude.rs` 与 `engine/claude/` 无行为 diff。
5. `openspec validate` 通过。
