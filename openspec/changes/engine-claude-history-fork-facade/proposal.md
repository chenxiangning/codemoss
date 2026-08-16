# Proposal: engine-claude-history-fork-facade

> OpenSpec change id: `engine-claude-history-fork-facade`  
> Wave：3V（第一根插头 · history fork 走默认 off 门面）  
> 依赖：`engine-claude-history-hydrate-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3U 把 GUI hydrate 接到门面。`fork_claude_session` 仍直调 `claude_history::fork_claude_session_with_config`。读路径已收口，写路径不接就会留下绕过。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `fork_history_session` 到同一份 `claude_history::fork_claude_session_with_config`。
2. `EngineManager` MUST 提供 `fork_claude_history_session`，经 `claude_owner()` 分发。
3. GUI `session_history_commands.rs::fork_claude_session` MUST 经该入口，MUST NOT 直调 `claude_history::`。
4. 本刀 MUST NOT 改 `fork_claude_session_from_message`。
5. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-fork-facade-v1`
