# Proposal: engine-claude-dual-run-flag

> OpenSpec change id: `engine-claude-dual-run-flag`  
> Wave：3E（第一根插头 · 默认关闭的门面流量）  
> 依赖：`engine-claude-compat-adapter`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)、[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

3D 门面能委托，但产品路径仍直调 `EngineManager.claude_manager`。若不先加 **默认 off** 的切流点，下一步 disable-not-delete 会一次性改所有调用方。3E 只让 flag on 时 `get_claude_session*` 经门面走，内部仍是同一份 Core `ClaudeSessionManager`。

## 目标与边界

1. `MOSSX_CLAUDE_COMPAT_FACADE` 默认关闭；仅 `1` / `true` 开启。
2. `ClaudeCompatAdapter::wrapping(Arc<ClaudeSessionManager>)` 不另建 session 表。
3. `EngineManager` 可注入 flag（测试不依赖进程环境）。
4. flag on：`get_claude_session` / `get_claude_session_for_provider` 经门面；返回的 `Arc` 与 `claude_manager` 同一份。
5. flag off：行为与 3D 前相同，不构造门面。
6. **不**出现第二个 live owner、不删 `engine/claude*`、不搬 history、不接 Host boot。

## 非目标

- 独立插件进程 / `.mossx-plugin`
- 替换 `builtin.claude` registry
- disable-not-delete
- Notes / 其他 CLI

## Capabilities

### New Capabilities

- `engine-claude-dual-run-flag-v1`：默认关闭的 Claude 门面切流

## 验收标准

1. 未设环境变量时 flag 为 false。
2. wrapping 两次 get 与底层 manager 指针相等。
3. `EngineManager::new_with_claude_compat(true)` 经门面仍 `Arc::ptr_eq` 到 `claude_manager`。
4. `EngineManager::new()` 默认不启用门面。
5. `src-tauri/src/engine/claude.rs` / `engine/claude/` 无行为 diff。
6. `openspec validate` 通过。
