# Proposal: engine-claude-history-rewind-facade

> OpenSpec change id: `engine-claude-history-rewind-facade`  
> Wave：3X（第一根插头 · history rewind 走默认 off 门面）  
> 依赖：`engine-claude-history-delete-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3W 把 GUI delete 接到门面。`rewind_commands.rs::fork_claude_session_from_message` 仍直调 `claude_history::fork_claude_session_from_message_with_config`。这是 GUI 最后一条直调写路径。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `fork_history_session_from_message` 到同一份 `claude_history::fork_claude_session_from_message_with_config`。
2. `EngineManager` MUST 提供 `fork_claude_history_session_from_message`，经 `claude_owner()` 分发。
3. GUI `rewind_commands.rs::fork_claude_session_from_message` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. 本刀 MUST NOT 改 daemon / catalog。
5. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-rewind-facade-v1`
