# Proposal: engine-claude-history-native-resolve-facade

> OpenSpec change id: `engine-claude-history-native-resolve-facade`  
> Wave：3AI（第一根插头 · native continuation resolve 走默认 off 门面）  
> 依赖：`engine-claude-history-catalog-delete-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AH 把 catalog delete 接到门面。`native_continuation/commands.rs` 仍有两处直调 `resolve_claude_session_file_with_config`：source path 与 bootstrap evidence。这两处会绕过已收口的 history 门面。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `resolve_history_session_file` 到同一份 `resolve_claude_session_file_with_config`。
2. `EngineManager` MUST 提供 `resolve_claude_history_session_file`，经 `claude_owner()` 分发。
3. `native_continuation/commands.rs` 两处 MUST 经该入口，MUST NOT 直调 `claude_history::resolve_claude_session_file_with_config`。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-native-resolve-facade-v1`
